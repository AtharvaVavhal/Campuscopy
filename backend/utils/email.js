// utils/email.js
// Sends transactional emails via Resend (https://resend.com).
// Gracefully skips if RESEND_API_KEY is not set — same pattern as whatsapp.js.
//
// Required env vars:
//   RESEND_API_KEY  — from resend.com dashboard
//   RESEND_FROM     — verified sender, e.g. "CampusCopy <noreply@yourcollege.edu>"
//                     defaults to "CampusCopy <onboarding@resend.dev>" for testing

const { Resend } = require('resend');

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM || 'CampusCopy <onboarding@resend.dev>';

// ── Generic send ──────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping.');
    return;
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[Email] Send failed:', error.message);
      return;
    }
    console.log(`[Email] Sent to ${to}: ${data.id}`);
    return data;
  } catch (err) {
    console.error('[Email] Send error:', err.message);
  }
}

// ── Job status email templates ────────────────────────────────
const STATUS_CONFIG = {
  printing: {
    subject: '🖨️ Your print is being processed — CampusCopy',
    color:   '#a78bfa',
    emoji:   '🖨️',
    heading: 'Printing Started',
    body:    (job) => `Your file <strong>${escHtml(job.file_name)}</strong> is printing now. Head to the print counter — it'll be ready shortly!`,
    cta:     null,
  },
  done: {
    subject: '✅ Your print is ready for pickup — CampusCopy',
    color:   '#34d399',
    emoji:   '✅',
    heading: 'Ready for Pickup!',
    body:    (job) => `
      Your print job is complete and waiting at the counter.<br><br>
      <strong>File:</strong> ${escHtml(job.file_name)}<br>
      <strong>Pages:</strong> ${job.pages} × ${job.copies} cop${job.copies > 1 ? 'ies' : 'y'}<br>
      <strong>Job ID:</strong> ${job.id.slice(0, 8).toUpperCase()}<br><br>
      Show this email or your QR code at the counter to collect.
    `,
    cta: null,
  },
  failed: {
    subject: '❌ Print job failed — CampusCopy',
    color:   '#f87171',
    emoji:   '❌',
    heading: 'Print Failed',
    body:    (job) => `Unfortunately, your file <strong>${escHtml(job.file_name)}</strong> could not be printed. Please contact the print operator or try uploading again.`,
    cta:     null,
  },
  paid: {
    subject: '💰 Payment confirmed — CampusCopy',
    color:   '#34d399',
    emoji:   '💰',
    heading: 'Payment Confirmed',
    body:    (job) => `
      Your payment of <strong>₹${job.cost}</strong> has been received.<br><br>
      <strong>File:</strong> ${escHtml(job.file_name)}<br>
      <strong>Pages:</strong> ${job.pages} × ${job.copies} cop${job.copies > 1 ? 'ies' : 'y'}<br>
      <strong>Type:</strong> ${job.color ? 'Color' : 'B&W'}${job.double_sided ? ' · Double-sided' : ''}<br><br>
      Your job has been added to the print queue. We'll email you again when it's ready.
    `,
    cta: null,
  },
};

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(job, config) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(config.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#16161f;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header bar -->
        <tr><td style="background:${config.color};padding:4px 0;"></td></tr>

        <!-- Logo + emoji -->
        <tr><td style="padding:32px 36px 0;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">${config.emoji}</div>
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:800;letter-spacing:1px;color:#eeeef5;">
            CampusCopy
          </div>
        </td></tr>

        <!-- Heading -->
        <tr><td style="padding:20px 36px 0;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:${config.color};">${config.heading}</div>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:20px 36px;">
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0;"/>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:0 36px 28px;font-size:14px;color:rgba(238,238,245,0.7);line-height:1.8;">
          ${config.body(job)}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 36px 32px;text-align:center;font-size:12px;color:rgba(238,238,245,0.25);line-height:1.7;border-top:1px solid rgba(255,255,255,0.06);">
          This email was sent by CampusCopy on behalf of your college print shop.<br/>
          Job ID: ${job.id.slice(0, 8).toUpperCase()}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main: notify by status ────────────────────────────────────
async function notifyJobStatusByEmail(job, status) {
  if (!job.email) return;
  const config = STATUS_CONFIG[status];
  if (!config) return;

  await sendEmail({
    to:      job.email,
    subject: config.subject,
    html:    buildHtml(job, config),
  });
}

module.exports = { sendEmail, notifyJobStatusByEmail };