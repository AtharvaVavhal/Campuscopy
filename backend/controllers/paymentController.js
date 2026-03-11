// controllers/paymentController.js

const db     = require("../config/db");
const Coupon = require("../models/coupon");
const { createOrder, verifyWebhookSignature } = require("../utils/razorpay");

// ─── POST /api/payments/create-order ─────────────────────────
async function createPaymentOrder(req, res) {
  const { job_id, coupon_code, loyalty_points = 0, phone } = req.body;
  if (!job_id) return res.status(400).json({ error: "job_id is required" });

  try {
    const { rows } = await db.query("SELECT * FROM jobs WHERE id = $1", [job_id]);
    const job = rows[0];
    if (!job)                    return res.status(404).json({ error: "Job not found" });
    if (job.status !== "pending") return res.status(400).json({ error: "Job is not pending" });

    let finalAmount = parseFloat(job.cost);

    // Apply coupon
    if (coupon_code) {
      const coupon = await Coupon.findByCode(coupon_code);
      if (coupon && coupon.uses_left > 0) {
        const { discount_amount, final_amount } = Coupon.calcDiscount(coupon, finalAmount);
        finalAmount = final_amount;
        await db.query(
          `UPDATE jobs SET coupon_id = $1, discount_amount = $2 WHERE id = $3`,
          [coupon.id, discount_amount, job_id]
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
        `UPDATE jobs SET loyalty_points_used = $1 WHERE id = $2`,
        [pts, job_id]
      );
    }

    // Save phone if provided and not already set
    if (phone) {
      await db.query(
        `UPDATE jobs SET phone_number = $1 WHERE id = $2 AND phone_number IS NULL`,
        [phone, job_id]
      );
    }

const order = await createOrder({ amount: finalAmount, receipt: job_id });

    await db.query(
      `UPDATE jobs SET razorpay_order_id = $1 WHERE id = $2`,
      [order.id, job_id]
    );

    res.json({
      order_id:     order.id,
      amount:       order.amount,   // paise
      currency:     order.currency,
      key_id:       process.env.RAZORPAY_KEY_ID,
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
  const rawBody   = req.body; // Buffer — express.raw() in server.js

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

  if (event.event === "payment.captured") {
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

      // Mark paid
      await db.query(
        `UPDATE jobs SET status = 'paid', updated_at = NOW() WHERE id = $1`,
        [job.id]
      );

      // Socket broadcast
      const io = req.app.get("io");
      if (io) {
        io.to(`job:${job.id}`).emit("job_update", { id: job.id, status: "paid" });
        io.emit("queue_update", { jobId: job.id, status: "paid" });
      }

      // Record coupon use
      if (job.coupon_id) {
        await Coupon.recordUse(job.coupon_id, job.id, job.discount_amount || 0);
      }

      // Loyalty: deduct redeemed points
      if (job.loyalty_points_used > 0 && job.phone_number) {
        await db.query(
          `INSERT INTO loyalty_points (phone, delta, reason, job_id, created_at)
           VALUES ($1, $2, 'redeemed', $3, NOW())`,
          [job.phone_number, -job.loyalty_points_used, job.id]
        );
      }

      // Loyalty: earn 1 pt per ₹1 spent
      if (job.phone_number) {
        const ptsEarned = Math.floor(parseFloat(job.cost));
        await db.query(
          `INSERT INTO loyalty_points (phone, delta, reason, job_id, created_at)
           VALUES ($1, $2, 'earned', $3, NOW())`,
          [job.phone_number, ptsEarned, job.id]
        );
      }

      console.log(`✅ Payment captured: job ${job.id}`);
    } catch (err) {
      console.error("Webhook processing error:", err);
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

module.exports = { createPaymentOrder, webhook, getAnalytics };