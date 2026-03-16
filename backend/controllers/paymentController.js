// controllers/paymentController.js

const db     = require("../config/db");
const Coupon = require("../models/coupon");
const { createOrder, createRefund, verifyWebhookSignature } = require("../utils/razorpay");
const { postPaymentQueue, notificationsQueue } = require("../queues/queues");

// ─── POST /api/payments/create-order ─────────────────────────
async function createPaymentOrder(req, res) {
  const { job_id, coupon_code, loyalty_points = 0, phone } = req.body;
  if (!job_id) return res.status(400).json({ error: "job_id is required" });

  try {
    const { rows } = await db.query(
      `SELECT j.*, c.razorpay_key_id, c.razorpay_key_secret
       FROM jobs j
       LEFT JOIN colleges c ON c.id::text = j.college_id::text
       WHERE j.id = $1::uuid`,
      [job_id]
    );
    const job = rows[0];
    if (!job)                     return res.status(404).json({ error: "Job not found" });
    if (job.status !== "pending") return res.status(400).json({ error: "Job is not pending" });

    // Use college-specific Razorpay keys if set, otherwise fall back to env
    const rzpKeyId     = job.razorpay_key_id     || process.env.RAZORPAY_KEY_ID;
    const rzpKeySecret = job.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

    let finalAmount = parseFloat(job.cost);

    // Apply coupon
    if (coupon_code) {
      const result = await Coupon.validate(coupon_code, finalAmount);
      if (result.valid) {
        finalAmount = result.final_amount;
        await db.query(
          `UPDATE jobs SET coupon_id = $1, discount_amount = $2 WHERE id = $3::uuid`,
          [result.id, result.discount_amount, job_id]
        );
      }
    }

    // Apply loyalty points (10 pts = ₹1, min 50, max 50% of bill)
    const pts = parseInt(loyalty_points) || 0;
    if (pts >= 50) {
      const loyaltyDiscount = Math.min(
        parseFloat((pts * 0.10).toFixed(2)),
        parseFloat((finalAmount * 0.5).toFixed(2))
      );
      finalAmount = Math.max(parseFloat((finalAmount - loyaltyDiscount).toFixed(2)), 1);
      await db.query(
        `UPDATE jobs SET loyalty_points_used = $1 WHERE id = $2::uuid`,
        [pts, job_id]
      );
    }

    // Save phone if provided and not already set
    if (phone) {
      await db.query(
        `UPDATE jobs SET phone_number = $1 WHERE id = $2::uuid AND phone_number IS NULL`,
        [phone, job_id]
      );
    }

    const { createOrder } = require("../utils/razorpay");
    const order = await createOrder({ amount: finalAmount, receipt: job_id }, rzpKeyId, rzpKeySecret);

    await db.query(
      `UPDATE jobs SET razorpay_order_id = $1 WHERE id = $2::uuid`,
      [order.id, job_id]
    );

    res.json({
      order_id:     order.id,
      amount:       order.amount,
      currency:     order.currency,
      key_id:       rzpKeyId,
      final_amount: finalAmount,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: err.message || "Order creation failed" });
  }
}

// ─── POST /api/payments/webhook ──────────────────────────────
async function webhook(req, res) {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody   = req.body;

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("Webhook: invalid signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (event.event === "payment.authorized") {
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id;

    try {
      const { rows } = await db.query(
        `SELECT * FROM jobs WHERE razorpay_order_id = $1`,
        [orderId]
      );
      const job = rows[0];
      if (!job) {
        console.warn("Webhook: job not found for order", orderId);
        return res.json({ ok: true });
      }

      // Enqueue post-payment processing (mark paid, coupon, loyalty points).
      // BullMQ retries up to 3x with exponential backoff if anything fails.
      await postPaymentQueue.add('process-payment', {
        jobId:   job.id,
        orderId: orderId,
      }, {
        jobId: `payment-${job.id}`, // deduplication — safe to re-receive same webhook
      });

      // Enqueue WhatsApp notification for payment confirmation
      if (job.phone_number) {
        await notificationsQueue.add('whatsapp', {
          jobId:  job.id,
          status: 'paid',
        });
      }

      // Enqueue email notification for payment confirmation
      if (job.email) {
        await notificationsQueue.add('email', {
          jobId:  job.id,
          status: 'paid',
        });
      }

      console.log(`✅ Payment webhook received: job ${job.id} queued for processing`);
    } catch (err) {
      console.error("Webhook enqueue error:", err);
    }
  }

  if (event.event === "payment.failed") {
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id;

    try {
      const { rows } = await db.query(
        `SELECT * FROM jobs WHERE razorpay_order_id = $1`,
        [orderId]
      );
      const job = rows[0];
      if (!job) {
        console.warn("Webhook: job not found for failed order", orderId);
        return res.json({ ok: true });
      }

      // Only mark failed if still pending — don't overwrite a paid job
      await db.query(
        `UPDATE jobs SET status = 'failed', updated_at = NOW()
         WHERE id = $1::uuid AND status = 'pending'`,
        [job.id]
      );

      const io = req.app.get("io");
      if (io) {
        io.to(`job:${job.id}`).emit("job_update", { id: job.id, status: "failed" });
      }

      console.log(`❌ Payment failed: job ${job.id} — ${payment.error_description || 'unknown reason'}`);
    } catch (err) {
      console.error("Webhook payment.failed error:", err);
    }
  }

  res.json({ ok: true });
}

// ─── GET analytics (admin) ────────────────────────────────────
async function getAnalytics(req, res) {
  try {
    const { rows: summary } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'done')                           AS total_done,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'), 0)            AS total_revenue,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'
          AND created_at >= NOW() - INTERVAL '30 days'), 0)              AS revenue_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS jobs_30d
      FROM jobs
    `);

    const { rows: daily } = await db.query(`
      SELECT DATE(created_at) AS date,
             COUNT(*) FILTER (WHERE status = 'done') AS jobs,
             COALESCE(SUM(cost) FILTER (WHERE status = 'done'), 0) AS revenue
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const { rows: printers } = await db.query(`
      SELECT p.name, COUNT(j.id) AS job_count, COALESCE(SUM(j.cost),0) AS revenue
      FROM jobs j
      JOIN printers p ON p.id = j.printer_id
      WHERE j.status = 'done'
      GROUP BY p.name
      ORDER BY job_count DESC LIMIT 5
    `);

    res.json({ summary: summary[0], daily, printers });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}

// ─── POST /api/payments/refund (admin only) ───────────────────
async function refundPayment(req, res) {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: "job_id is required" });

  try {
    // Fetch job with college Razorpay keys
    const { rows } = await db.query(
      `SELECT j.*, c.razorpay_key_id, c.razorpay_key_secret
       FROM jobs j
       LEFT JOIN colleges c ON c.id::text = j.college_id::text
       WHERE j.id = $1::uuid`,
      [job_id]
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Only refund jobs that were paid
    const REFUNDABLE = ['paid', 'failed', 'cancelled'];
    if (!REFUNDABLE.includes(job.status)) {
      return res.status(400).json({
        error: `Job status '${job.status}' is not refundable. Must be one of: ${REFUNDABLE.join(', ')}`
      });
    }

    if (!job.razorpay_order_id) {
      return res.status(400).json({ error: "No Razorpay order found for this job — nothing to refund" });
    }

    // Fetch the payment ID from Razorpay using the order ID
    const rzpKeyId     = job.razorpay_key_id     || process.env.RAZORPAY_KEY_ID;
    const rzpKeySecret = job.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

    const Razorpay = require('razorpay');
    const client = new Razorpay({ key_id: rzpKeyId, key_secret: rzpKeySecret });

    const payments = await client.orders.fetchPayments(job.razorpay_order_id);
    const captured = payments.items?.find(p => p.status === 'captured');

    if (!captured) {
      return res.status(400).json({ error: "No captured payment found for this order — cannot refund" });
    }

    // Issue full refund
    const refund = await createRefund(captured.id, rzpKeyId, rzpKeySecret);

    // Mark job cancelled and record refund ID
    await db.query(
      `UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1::uuid`,
      [job_id]
    );

    // Emit socket update
    const io = req.app.get("io");
    if (io) {
      io.to(`job:${job_id}`).emit("job_update", { id: job_id, status: "cancelled" });
    }

    console.log(`💸 Refund issued: job ${job_id} → Razorpay refund ${refund.id}`);

    return res.json({
      message: "Refund issued successfully",
      refund_id: refund.id,
      amount_refunded: refund.amount / 100,
      job_id,
    });
  } catch (err) {
    console.error("Refund error:", err);
    return res.status(500).json({ error: err.error?.description || err.message || "Refund failed" });
  }
}

module.exports = { createPaymentOrder, webhook, getAnalytics, refundPayment };