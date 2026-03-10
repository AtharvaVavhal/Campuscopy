const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = async ({ amount, currency = 'INR', receipt }) => {
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt,
  });
  return order;
};

const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = { createOrder, verifyWebhookSignature };
