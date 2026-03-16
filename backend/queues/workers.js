// queues/workers.js
// BullMQ Worker definitions for all three queues.
// Call startWorkers() once from server.js after the DB connection is ready.

const { Worker } = require('bullmq');
const { getConnection } = require('./connection');
const db       = require('../config/db');
const Coupon   = require('../models/coupon');
const { notifyJobStatus, sendWhatsApp } = require('../utils/whatsapp');
const { sendPush, buildPayload }        = require('../utils/push');

// ══════════════════════════════════════════════════════════════
// QUEUE 1 — post-payment
// Job name: 'process-payment'
// Data:     { jobId, orderId }
// ══════════════════════════════════════════════════════════════
async function processPayment(bullJob) {
  const { jobId, orderId } = bullJob.data;
  console.log(`[post-payment] Processing job ${jobId}`);

  // 1. Fetch the job row
  const { rows } = await db.query(
    `SELECT * FROM jobs WHERE id = $1::uuid`,
    [jobId]
  );
  const job = rows[0];
  if (!job) throw new Error(`Job ${jobId} not found`);

  // 2. Mark paid (idempotent — safe to re-run on retry)
  await db.query(
    `UPDATE jobs SET status = 'paid', updated_at = NOW()
     WHERE id = $1::uuid AND status = 'pending'`,
    [jobId]
  );

  // 3. Record coupon use
  if (job.coupon_id) {
    await Coupon.recordUse(job.coupon_id, jobId, job.discount_amount || 0);
  }

  // 4. Deduct loyalty points if used
  if (job.loyalty_points_used > 0 && job.phone_number) {
    await db.query(
      `INSERT INTO loyalty_transactions
         (phone_number, college_id, job_id, type, points, description)
       VALUES ($1, $2, $3::uuid, 'redeem', $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        job.phone_number,
        job.college_id || 'college1',
        jobId,
        job.loyalty_points_used,
        `Redeemed ${job.loyalty_points_used} pts for ₹${(job.loyalty_points_used * 0.10).toFixed(0)} off`,
      ]
    );
  }

  // 5. Award earned loyalty points
  if (job.phone_number) {
    const amountPaid = parseFloat(job.cost) - parseFloat(job.discount_amount || 0);
    const ptsEarned  = Math.floor(Math.max(amountPaid, 0));
    if (ptsEarned > 0) {
      await db.query(
        `INSERT INTO loyalty_transactions
           (phone_number, college_id, job_id, type, points, description)
         VALUES ($1, $2, $3::uuid, 'earn', $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          job.phone_number,
          job.college_id || 'college1',
          jobId,
          ptsEarned,
          `Earned ${ptsEarned} pts for printing ${job.file_name}`,
        ]
      );
    }
  }

  console.log(`[post-payment] ✅ Completed job ${jobId}`);
  return { jobId, status: 'paid' };
}

// ══════════════════════════════════════════════════════════════
// QUEUE 2 — notifications
// Job names:
//   'whatsapp'  — data: { jobId, status }
//   'push'      — data: { jobId, status }
// ══════════════════════════════════════════════════════════════
async function processNotification(bullJob) {
  const { jobId, status } = bullJob.data;

  // Fetch fresh job data every time — status may have changed
  const { rows } = await db.query(
    `SELECT j.*, p.name AS printer_name
     FROM jobs j
     LEFT JOIN printers p ON p.id = j.printer_id
     WHERE j.id = $1::uuid`,
    [jobId]
  );
  const job = rows[0];
  if (!job) {
    console.warn(`[notifications] Job ${jobId} not found — skipping`);
    return; // don't throw — job may have been deleted, not worth retrying
  }

  if (bullJob.name === 'whatsapp') {
    if (!job.phone_number) return;
    await notifyJobStatus(job, status);
    console.log(`[notifications] WhatsApp sent for job ${jobId} → ${status}`);
  }

  if (bullJob.name === 'push') {
    const payload = typeof buildPayload === 'function' ? buildPayload(job, status) : null;
    if (!payload) return;

    const { rows: subs } = await db.query(
      `SELECT * FROM push_subscriptions WHERE job_id = $1`,
      [jobId]
    );

    const expired = [];
    for (const sub of subs) {
      try {
        await sendPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 410) expired.push(sub.id);
        else throw err; // re-throw so BullMQ retries
      }
    }

    if (expired.length) {
      await db.query(
        `DELETE FROM push_subscriptions WHERE id = ANY($1)`,
        [expired]
      );
    }
    console.log(`[notifications] Push sent for job ${jobId} → ${status} (${subs.length} subs)`);
  }
}

// ══════════════════════════════════════════════════════════════
// QUEUE 3 — stale-jobs (repeatable)
// Job name: 'cleanup'
// No data payload — sweeps the whole DB
// ══════════════════════════════════════════════════════════════
async function processStaleJobs() {
  const TWO_HOURS_AGO = `NOW() - INTERVAL '2 hours'`;

  // 1. Cancel pending jobs older than 2 hours (abandoned checkouts)
  const { rowCount: cancelledCount } = await db.query(
    `UPDATE jobs
     SET status = 'cancelled', updated_at = NOW()
     WHERE status = 'pending'
     AND created_at < ${TWO_HOURS_AGO}`
  );
  if (cancelledCount > 0) {
    console.log(`[stale-jobs] Cancelled ${cancelledCount} abandoned pending job(s)`);
  }

  // 2. Delete expired, used OTP sessions (keep last 24h for debugging)
  const { rowCount: otpCount } = await db.query(
    `DELETE FROM otp_sessions
     WHERE (expires_at < NOW() OR used = TRUE)
     AND created_at < NOW() - INTERVAL '24 hours'`
  );
  if (otpCount > 0) {
    console.log(`[stale-jobs] Deleted ${otpCount} expired OTP session(s)`);
  }

  console.log(`[stale-jobs] ✅ Sweep complete`);
  return { cancelledCount, otpCount };
}

// ══════════════════════════════════════════════════════════════
// Start all workers + register the repeatable stale-jobs schedule
// ══════════════════════════════════════════════════════════════
async function startWorkers(io) {
  const connection = getConnection();

  // ── Worker 1: post-payment ──────────────────────────────────
  const postPaymentWorker = new Worker(
    'post-payment',
    processPayment,
    { connection, concurrency: 5 }
  );

  postPaymentWorker.on('completed', (job, result) => {
    console.log(`[post-payment] Job ${job.id} completed`);
    // Emit socket update so PWA immediately reflects paid status
    if (io && result?.jobId) {
      io.to(`job:${result.jobId}`).emit('job_update', { id: result.jobId, status: 'paid' });
      io.emit('queue_update', { jobId: result.jobId, status: 'paid' });
    }
  });

  postPaymentWorker.on('failed', (job, err) => {
    console.error(`[post-payment] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  // ── Worker 2: notifications ─────────────────────────────────
  const notificationsWorker = new Worker(
    'notifications',
    processNotification,
    { connection, concurrency: 10 }
  );

  notificationsWorker.on('failed', (job, err) => {
    console.error(`[notifications] ${job?.name} job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  // ── Worker 3: stale-jobs ────────────────────────────────────
  const staleJobsWorker = new Worker(
    'stale-jobs',
    processStaleJobs,
    { connection, concurrency: 1 }
  );

  staleJobsWorker.on('failed', (job, err) => {
    console.error(`[stale-jobs] Sweep failed: ${err.message}`);
  });

  // Register repeatable schedule — runs every 60 minutes
  // Uses the staleJobsQueue imported here to avoid circular deps
  const { staleJobsQueue } = require('./queues');
  await staleJobsQueue.add(
    'cleanup',
    {},
    {
      repeat: { every: 60 * 60 * 1000 }, // every 60 minutes
      jobId:  'stale-jobs-repeatable',    // stable ID prevents duplicate schedules on restart
    }
  );

  console.log('✅ BullMQ workers started (post-payment, notifications, stale-jobs)');

  return { postPaymentWorker, notificationsWorker, staleJobsWorker };
}

module.exports = { startWorkers };