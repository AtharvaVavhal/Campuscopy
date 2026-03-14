const Razorpay = require('razorpay');
const crypto = require('crypto');

// Default client using env keys
const defaultClient = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// createOrder accepts optional per-college keys — falls back to env defaults
const createOrder = async ({ amount, currency = 'INR', receipt }, keyId, keySecret) => {
  const client = (keyId && keySecret)
    ? new Razorpay({ key_id: keyId, key_secret: keySecret })
    : defaultClient;

  const order = await client.orders.create({
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