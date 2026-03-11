// utils/push.js
// Sends browser push notifications via VAPID (web-push)

const webpush = require('web-push');

// VAPID keys — set these in your .env / Render environment
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'admin@campuscopy.in'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Send a push notification to a single subscription object.
 * @param {{ endpoint, keys: { p256dh, auth } }} subscription
 * @param {{ title, body, icon?, badge?, url? }} payload
 */
async function sendPush(subscription, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('[push] VAPID not configured, skipping.');
    return;
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 60 * 60 } // 1 hour TTL
    );
    console.log('[push] Sent to', subscription.endpoint.slice(0, 40) + '...');
  } catch (err) {
    // 410 Gone = subscription expired/unsubscribed, caller should delete it
    if (err.statusCode === 410) {
      console.log('[push] Subscription expired (410), should be removed.');
      throw err; // re-throw so route can clean up DB
    }
    console.error('[push] Send failed:', err.message);
  }
}

/**
 * Build the right notification payload based on job status.
 */
function buildPayload(job, status) {
  const jobIdShort = (job.id || '').slice(0, 8).toUpperCase();

  const payloads = {
    printing: {
      title: '🖨️ Printing Started!',
      body: `${job.file_name} is printing now. Head to the counter!`,
      url: `/app.html#status-${job.id}`,
    },
    done: {
      title: '✅ Your Print is Ready!',
      body: `${job.file_name} · Job #${jobIdShort} · Collect at the counter now.`,
      url: `/app.html#status-${job.id}`,
    },
    failed: {
      title: '❌ Print Failed',
      body: `${job.file_name} could not be printed. Please contact the operator.`,
      url: `/app.html#status-${job.id}`,
    },
  };

  return payloads[status] || null;
}

module.exports = { sendPush, buildPayload };