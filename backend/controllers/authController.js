// controllers/authController.js

const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const db     = require("../config/db");

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query(
      `SELECT * FROM admins WHERE email = $1 LIMIT 1`,
      [email]
    );
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: "admin", college_id: admin.college_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, college_id: admin.college_id } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
}

// POST /api/auth/register  (dev only)
async function register(req, res) {
  const { college_id, name, email, password } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO admins (college_id, name, email, password_hash, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, college_id`,
      [college_id, name, email, password_hash]
    );
    res.status(201).json({ admin: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Email already registered" });
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: req.user });
}

// ── OTP helpers ──────────────────────────────────────────────
const crypto = require("crypto");
const { sendWhatsApp } = require("../utils/whatsapp");

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12
    ? "+" + digits
    : "+91" + digits.slice(-10);
}

// POST /api/auth/otp/send
async function sendOtp(req, res) {
  const phone = normalisePhone(req.body.phone);
  const otp   = String(Math.floor(100000 + Math.random() * 900000));

  try {
    const otp_hash  = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Invalidate old OTPs for this phone
    await db.query(`DELETE FROM otp_sessions WHERE phone = $1`, [phone]);

    await db.query(
      `INSERT INTO otp_sessions (phone, otp_hash, expires_at) VALUES ($1, $2, $3)`,
      [phone, otp_hash, expiresAt]
    );

    // Deliver via WhatsApp (Twilio sandbox). Falls back gracefully if not configured.
    await sendWhatsApp(
      phone,
      `🔐 *CampusCopy* — Your verification code is:\n\n*${otp}*\n\nValid for 10 minutes. Do not share this code.`
    );

    // In dev mode, return OTP in response for testing
    const resp = { message: "OTP sent via WhatsApp", phone };
    if (process.env.NODE_ENV !== "production") resp._dev_otp = otp;
    res.json(resp);
  } catch (err) {
    console.error("sendOtp error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

// POST /api/auth/otp/verify
async function verifyOtp(req, res) {
  const phone = normalisePhone(req.body.phone);
  const { otp } = req.body;

  try {
    const { rows } = await db.query(
      `SELECT * FROM otp_sessions
       WHERE phone = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    const session = rows[0];
    if (!session) return res.status(400).json({ error: "OTP expired or not found. Request a new one." });

    const valid = await bcrypt.compare(otp, session.otp_hash);
    if (!valid) return res.status(400).json({ error: "Incorrect OTP" });

    // Mark used
    await db.query(`UPDATE otp_sessions SET used = TRUE WHERE id = $1`, [session.id]);

    const token = jwt.sign(
      { phone, role: "student" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ token, phone });
  } catch (err) {
    console.error("verifyOtp error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
}

module.exports = { login, register, me, sendOtp, verifyOtp };