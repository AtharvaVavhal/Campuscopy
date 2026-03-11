const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

/**
 * Send a WhatsApp message via Twilio.
 * @param {string} to - Phone number e.g. "+919876543210"
 * @param {string} message - Message text
 * @returns {Promise<boolean>} - true if sent, false if failed
 */
async function sendWhatsApp(to, message) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('[WhatsApp] Twilio credentials not set — skipping notification');
    return false;
  }

  // Normalise phone number to E.164 with whatsapp: prefix
  const normalised = normalisePhone(to);
  if (!normalised) {
    console.warn('[WhatsApp] Invalid phone number:', to);
    return false;
  }

  try {
    const msg = await client.messages.create({
      from: FROM,
      to: 'whatsapp:' + normalised,
      body: message,
    });
    console.log('[WhatsApp] Sent to', normalised, '— SID:', msg.sid);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Send error:', err.message);
    return false;
  }
}

/**
 * Normalise phone to E.164 (+91XXXXXXXXXX).
 * Handles: "9876543210", "+919876543210", "919876543210", "+91 98765 43210"
 */
function normalisePhone(raw) {
  if (!raw) return null;
  // Strip spaces, dashes, parentheses
  let digits = raw.replace(/[\s\-().]/g, '');
  // Already E.164
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  // Strip leading +
  if (digits.startsWith('+')) digits = digits.slice(1);
  // Indian number without country code (10 digits starting with 6-9)
  if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
  // With country code prefix
  if (/^\d{11,15}$/.test(digits)) return '+' + digits;
  return null;
}

/**
 * Send the "print ready" notification.
 */
async function notifyPrintReady({ phone, fileName, printerName, printerLocation, cost }) {
  const location = printerLocation ? `${printerName} (${printerLocation})` : printerName;
  const message =
    `✅ *Your print is ready!*\n\n` +
    `📄 *File:* ${fileName}\n` +
    `🖨️ *Printer:* ${location}\n` +
    `💰 *Amount paid:* ₹${cost}\n\n` +
    `Show your QR code at the counter to collect your prints.\n\n` +
    `— CampusCopy, VIT Pune`;

  return sendWhatsApp(phone, message);
}

module.exports = { sendWhatsApp, notifyPrintReady };