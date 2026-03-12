// routes/colleges.js — Phase 3 SaaS endpoints
const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const auth     = require('../middleware/auth');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── POST /api/colleges/signup ─────────────────────────────────
// Public — new shop owner registers their college
router.post('/signup', async (req, res) => {
  const {
    college_name, college_email,
    admin_name, admin_email, admin_password,
    razorpay_key_id, razorpay_key_secret,
    printer_name, printer_location,
  } = req.body;

  if (!college_name || !admin_email || !admin_password || !admin_name) {
    return res.status(400).json({ error: 'college_name, admin_name, admin_email and admin_password are required' });
  }
  if (admin_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check if email already registered
    const existing = await client.query(
      'SELECT id FROM admins WHERE email = $1', [admin_email.toLowerCase()]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Create college
    const collegeId = uuidv4();
    await client.query(
      `INSERT INTO colleges (id, name, email, razorpay_key_id, razorpay_key_secret, platform_fee_pct, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 3.0, 'active', NOW())`,
      [collegeId, college_name.trim(), college_email?.trim() || null,
       razorpay_key_id?.trim() || null, razorpay_key_secret?.trim() || null]
    );

    // Create admin
    const passwordHash = await bcrypt.hash(admin_password, 10);
    const adminId = uuidv4();
    await client.query(
      `INSERT INTO admins (id, college_id, name, email, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [adminId, collegeId, admin_name.trim(), admin_email.toLowerCase().trim(), passwordHash]
    );

    // Create default printer
    const printerId = uuidv4();
    await client.query(
      `INSERT INTO printers (id, college_id, name, location, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [printerId, collegeId,
       printer_name?.trim() || 'Main Printer',
       printer_location?.trim() || 'Ground Floor']
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'College registered successfully!',
      college_id: collegeId,
      printer_id: printerId,
      login_email: admin_email.toLowerCase().trim(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    client.release();
  }
});

// ── GET /api/colleges/settings ────────────────────────────────
// Admin — get own college settings
router.get('/settings', auth, async (req, res) => {
  try {
    const adminRow = await db.query(
      'SELECT college_id FROM admins WHERE id = $1', [req.user?.id]
    );
    const college_id = adminRow.rows[0]?.college_id;
    if (!college_id) return res.status(404).json({ error: 'College not found' });

    const { rows } = await db.query(
      `SELECT id, name, email, razorpay_key_id, platform_fee_pct, status, created_at
       FROM colleges WHERE id = $1`, [college_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'College not found' });

    // Get printers for this college
    const { rows: printers } = await db.query(
      'SELECT * FROM printers WHERE college_id = $1 ORDER BY created_at', [college_id]
    );

    return res.json({ college: rows[0], printers });
  } catch (err) {
    console.error('Settings fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/colleges/settings ─────────────────────────────
// Admin — update college settings
router.patch('/settings', auth, async (req, res) => {
  try {
    const adminRow = await db.query(
      'SELECT college_id FROM admins WHERE id = $1', [req.user?.id]
    );
    const college_id = adminRow.rows[0]?.college_id;
    if (!college_id) return res.status(404).json({ error: 'College not found' });

    const { name, email, razorpay_key_id, razorpay_key_secret } = req.body;

    const { rows } = await db.query(
      `UPDATE colleges
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           razorpay_key_id = COALESCE($3, razorpay_key_id),
           razorpay_key_secret = COALESCE($4, razorpay_key_secret)
       WHERE id = $5 RETURNING id, name, email, razorpay_key_id, platform_fee_pct, status`,
      [name || null, email || null, razorpay_key_id || null, razorpay_key_secret || null, college_id]
    );

    return res.json({ college: rows[0], message: 'Settings updated' });
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/colleges/all (super admin only) ──────────────────
router.get('/all', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
         COUNT(DISTINCT a.id)::int AS admin_count,
         COUNT(DISTINCT j.id)::int AS total_jobs,
         COALESCE(SUM(j.cost) FILTER (WHERE j.status='done'), 0) AS total_revenue
       FROM colleges c
       LEFT JOIN admins a ON a.college_id = c.id
       LEFT JOIN jobs j ON j.college_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    return res.json({ colleges: rows });
  } catch (err) {
    console.error('List colleges error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
