// utils/whatsapp.js
// Lazy-initialises the Twilio client so the server doesn't crash on startup
// if TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not yet set in the environment.

const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

function getClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.startsWith("AC...") || sid === "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
    return null; // Twilio not configured — skip silently
  }
  return require("twilio")(sid, token);
}

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return "+" + digits;
  if (digits.length === 10) return "+91" + digits;
  if (digits.startsWith("0") && digits.length === 11) return "+91" + digits.slice(1);
  return "+" + digits;
}

const TEMPLATES = {
  printing: (job) =>
    `🖨️ *CampusCopy Update*\n\nYour file *${job.file_name}* is now printing!\n\nJob ID: ${job.id.slice(0, 8).toUpperCase()}\nPrinter: ${job.printer_name || "Ground Floor"}\n\nWe'll message you again when it's ready for pickup.`,

  done: (job) =>
    `✅ *CampusCopy — Ready for Pickup!*\n\nYour print is done! 🎉\n\nFile: *${job.file_name}*\nPages: ${job.pages} · Copies: ${job.copies}\nPrinter: ${job.printer_name || "Ground Floor"}\n\n📍 Show your Job ID at the counter: *${job.id.slice(0, 8).toUpperCase()}*`,

  failed: (job) =>
    `❌ *CampusCopy — Print Failed*\n\nSorry, your print job for *${job.file_name}* could not be completed.\n\nPlease visit the print counter or upload again at campuscopy.pages.dev`,
};

async function notifyJobStatus(job, status) {
  if (!job.phone_number) return;
  const template = TEMPLATES[status];
  if (!template) return;

  const client = getClient();
  if (!client) {
    console.log("[WhatsApp] Twilio not configured — skipping notification");
    return;
  }

  const to   = normalisePhone(job.phone_number);
  const body = template(job);

  try {
    const msg = await client.messages.create({ from: FROM, to: `whatsapp:${to}`, body });
    console.log(`[WhatsApp] Sent ${status} to ${to} — SID: ${msg.sid}`);
  } catch (err) {
    console.error(`[WhatsApp] Failed to send to ${to}:`, err.message);
  }
}

module.exports = { notifyJobStatus };