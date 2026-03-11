// routes/push.js

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { sendPush, buildPayload } = require('../utils/push');

// ── GET /api/push/vapid-public-key ────────────────────────────
// PWA calls this on load to get the public key for subscribing
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
  res.json({ publicKey: key });
});

// ── POST /api/push/subscribe ──────────────────────────────────
// Called after student pays — saves their push subscription linked to job_id
router.post('/subscribe', async (req, res) => {
  try {
    const { job_id, phone, subscription } = req.body;

    if (!job_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'job_id and valid subscription object required' });
    }

    // Upsert — if same endpoint subscribes again for a job, update it
    await db.query(
      `INSERT INTO push_subscriptions (job_id, phone, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (job_id, endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [job_id, phone || null, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[push] Subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ── POST /api/push/notify/:jobId ──────────────────────────────
// Internal — called from routes/jobs.js when status changes
// Not exposed publicly; called server-side only
router.post('/notify/:jobId', async (req, res) => {
  const { status } = req.body;
  const { jobId }  = req.params;

  try {
    // Get job details for message
    const { rows: jobRows } = await db.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    const job = jobRows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const payload = buildPayload(job, status);
    if (!payload) return res.json({ ok: true, skipped: true }); // no push for this status

    // Get all subscriptions for this job
    const { rows: subs } = await db.query(
      'SELECT * FROM push_subscriptions WHERE job_id = $1',
      [jobId]
    );

    if (!subs.length) return res.json({ ok: true, sent: 0 });

    let sent = 0;
    const expired = [];

    for (const sub of subs) {
      try {
        await sendPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410) expired.push(sub.id);
      }
    }

    // Clean up expired subscriptions
    if (expired.length) {
      await db.query('DELETE FROM push_subscriptions WHERE id = ANY($1)', [expired]);
    }

    res.json({ ok: true, sent, expired: expired.length });
  } catch (err) {
    console.error('[push] Notify error:', err);
    res.status(500).json({ error: 'Notification failed' });
  }
});

module.exports = router;