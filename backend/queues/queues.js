// queues/queues.js
// Instantiates the three BullMQ Queue objects.
// Import from here to enqueue jobs — never instantiate Queue directly elsewhere.

const { Queue } = require('bullmq');
const { getConnection } = require('./connection');

const connection = getConnection();

// ── 1. Post-payment queue ─────────────────────────────────────
// Handles everything that must happen after a payment is confirmed:
// marking the job paid, recording coupon use, and awarding loyalty points.
// Decoupled from the webhook so a DB hiccup doesn't leave jobs in a broken state.
const postPaymentQueue = new Queue('post-payment', {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff: { type: 'exponential', delay: 2000 }, // 2s → 4s → 8s
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
  },
});

// ── 2. Notifications queue ────────────────────────────────────
// Handles WhatsApp messages and web push notifications.
// Most likely to fail transiently (Twilio rate limits, network), so gets more retries.
// Never blocks the main request/response cycle.
const notificationsQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 }, // 3s → 6s → 12s → 24s → 48s
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 500 },
  },
});

// ── 3. Stale jobs queue ───────────────────────────────────────
// Repeatable maintenance queue. Runs every 60 minutes to:
//   • Cancel pending jobs older than 2 hours (abandoned checkout)
//   • Delete expired OTP sessions
const staleJobsQueue = new Queue('stale-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 50 },
  },
});

module.exports = { postPaymentQueue, notificationsQueue, staleJobsQueue };