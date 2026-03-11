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

module.exports = { login, register, me };