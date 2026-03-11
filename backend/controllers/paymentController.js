const pool = require('../config/db');
const { createOrder, verifyWebhookSignature } = require('../utils/razorpay');
const Coupon = require('../models/coupon');

const POINTS_TO_RUPEES = 0.10;
const MAX_REDEEM_PERCENT = 50;

const createPaymentOrder = async (req, res) => {
  try {
    const { job_id, coupon_code, loyalty_points, phone } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [job_id]);
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'pending') return res.status(400).json({ error: 'Job is not pending' });

    let finalAmount = parseFloat(job.cost);
    let discountAmount = 0;
    let couponResult = null;
    let loyaltyDiscount = 0;
    let loyaltyPointsUsed = 0;

    if (coupon_code) {
      couponResult = await Coupon.validate(coupon_code, finalAmount);
      if (couponResult.valid) {
        discountAmount = couponResult.discount_amount;
        finalAmount = couponResult.final_amount;
      }
    }

    const phoneNum = phone || job.phone_number;
    if (loyalty_points && parseInt(loyalty_points) > 0 && phoneNum) {
      const pts = parseInt(loyalty_points);
      const normPhone = phoneNum.replace(/\D/g, '');
      const { rows: bal } = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN type='earn'   THEN points ELSE 0 END), 0)::int AS earned,
           COALESCE(SUM(CASE WHEN type='redeem' THEN points ELSE 0 END), 0)::int AS redeemed
         FROM loyalty_transactions WHERE phone_number LIKE $1`,
        ['%' + normPhone.replace(/^91/, '')]
      );
      const balance = parseInt(bal[0].earned) - parseInt(bal[0].redeemed);
      if (pts <= balance) {
        const maxDiscount = parseFloat((finalAmount * MAX_REDEEM_PERCENT / 100).toFixed(2));
        const requested   = parseFloat((pts * POINTS_TO_RUPEES).toFixed(2));
        loyaltyDiscount   = Math.min(requested, maxDiscount);
        loyaltyPointsUsed = Math.round(loyaltyDiscount / POINTS_TO_RUPEES);
        finalAmount = Math.max(parseFloat((finalAmount - loyaltyDiscount).toFixed(2)), 1);
      }
    }

    const order = await createOrder({ amount: finalAmount, currency: 'INR', receipt: job.id });

    await pool.query(
      `INSERT INTO payments (college_id, job_id, razorpay_order_id, amount, phone_number, loyalty_points_used)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [job.college_id, job.id, order.id, finalAmount,
       phoneNum || null, loyaltyPointsUsed > 0 ? loyaltyPointsUsed : null]
    );

    if (couponResult?.valid) {
      await Coupon.recordUse(couponResult.coupon_id, job.id, discountAmount);
    }

    return res.json({
      order_id: order.id, amount: order.amount, currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID, job_id: job.id,
      original_amount: parseFloat(job.cost),
      discount_amount: discountAmount,
      loyalty_discount: loyaltyDiscount,
      loyalty_points_used: loyaltyPointsUsed,
      final_amount: finalAmount,
      coupon_applied: couponResult?.valid ? couponResult.code : null,
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const isValid = verifyWebhookSignature(req.body, signature);
    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });

    const event = JSON.parse(req.body.toString());
    if (event.event === 'payment.captured') {
      const orderId   = event.payload.payment.entity.order_id;
      const paymentId = event.payload.payment.entity.id;

      const { rows } = await pool.query(
        'UPDATE payments SET status = $1, razorpay_payment_id = $2 WHERE razorpay_order_id = $3 RETURNING *',
        ['paid', paymentId, orderId]
      );

      if (rows[0]) {
        await pool.query('UPDATE jobs SET status = $1 WHERE id = $2', ['paid', rows[0].job_id]);

        if (rows[0].loyalty_points_used && rows[0].phone_number) {
          const { rows: jobRows } = await pool.query(
            'SELECT college_id FROM jobs WHERE id = $1', [rows[0].job_id]
          );
          pool.query(
            `INSERT INTO loyalty_transactions (phone_number, college_id, job_id, type, points, description)
             VALUES ($1, $2, $3, 'redeem', $4, $5)`,
            [rows[0].phone_number, jobRows[0]?.college_id || 'college1', rows[0].job_id,
             rows[0].loyalty_points_used,
             `Redeemed ${rows[0].loyalty_points_used} pts for Rs.${(rows[0].loyalty_points_used * POINTS_TO_RUPEES).toFixed(0)} off`]
          ).catch(err => console.error('[Loyalty] Redeem confirm error:', err.message));
        }
      }
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createPaymentOrder, webhook };