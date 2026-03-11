// utils/whatsapp.js
const twilio = require("twilio");
let client;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}
const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

async function sendWhatsApp(to, body) {
  if (!client) {
    console.log("[WhatsApp] Twilio not configured, skipping.");
    return;
  }
  const cleaned = to.replace(/\s+/g, "");
  // Add +91 country code if not present
  let withCountry = cleaned;
  if (!withCountry.startsWith("+") && !withCountry.startsWith("whatsapp:")) {
    withCountry = "+91" + withCountry;
  }
  const toFormatted = withCountry.startsWith("whatsapp:") ? withCountry : `whatsapp:${withCountry}`;
  try {
    const msg = await client.messages.create({ from: FROM, to: toFormatted, body });
    console.log(`[WhatsApp] Sent to ${toFormatted}: ${msg.sid}`);
    return msg;
  } catch (err) {
    console.error("[WhatsApp] Send failed:", err.message);
  }
}

// Called from routes/jobs.js as: notifyJobStatus(job, status)
async function notifyJobStatus(job, status) {
  if (!job.phone_number) return;
  const messages = {
    printing:
      `🖨️ *CampusCopy* — Printing started!\n\n` +
      `📄 ${job.file_name} is printing now.\n` +
      `Head to the print counter — it'll be ready shortly!`,
    done:
      `✅ *CampusCopy* — Your print is ready!\n\n` +
      `📄 *File:* ${job.file_name}\n` +
      `📋 *Pages:* ${job.pages} × ${job.copies} cop${job.copies > 1 ? "ies" : "y"}\n` +
      `🏷️ *Job ID:* ${job.id.slice(0, 8).toUpperCase()}\n\n` +
      `Show this message at the counter to collect. 🖨️`,
    failed:
      `❌ *CampusCopy* — Print failed.\n\n` +
      `📄 ${job.file_name} could not be printed.\n` +
      `Please contact the print operator or try again.`,
  };
  const msg = messages[status];
  if (msg) await sendWhatsApp(job.phone_number, msg);
}

module.exports = { sendWhatsApp, notifyJobStatus };