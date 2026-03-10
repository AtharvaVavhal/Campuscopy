const pool = require('../config/db');
const { createOrder, verifyWebhookSignature } = require('../utils/razorpay');

const createPaymentOrder = async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [job_id]);
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'pending') return res.status(400).json({ error: 'Job is not pending' });

    const order = await createOrder({ amount: job.cost, currency: 'INR', receipt: job.id });

    await pool.query(
      'INSERT INTO payments (college_id, job_id, razorpay_order_id, amount) VALUES ($1, $2, $3, $4)',
      [job.college_id, job.id, order.id, job.cost]
    );

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      job_id: job.id,
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
      const orderId = event.payload.payment.entity.order_id;
      const paymentId = event.payload.payment.entity.id;

      const { rows } = await pool.query(
        'UPDATE payments SET status = $1, razorpay_payment_id = $2 WHERE razorpay_order_id = $3 RETURNING *',
        ['paid', paymentId, orderId]
      );

      if (rows[0]) {
        await pool.query('UPDATE jobs SET status = $1 WHERE id = $2', ['paid', rows[0].job_id]);
      }
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createPaymentOrder, webhook };
