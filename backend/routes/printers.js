const express = require('express');
const crypto  = require('crypto');
const pool    = require('../config/db');

const router = express.Router();

// ── Auth middleware (bridge requests only) ────────────────────
function bridgeAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  req._apiKey = key;
  next();
}

// ── Public — list all printers ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, location, is_online, last_heartbeat FROM printers ORDER BY name'
    );
    return res.json({ printers: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bridge — auto-register by MAC address ─────────────────────
// POST /api/printers/register
// Body: { mac_address, name, location }
// Returns: { printer_id, api_key } — save these in .env
router.post('/register', async (req, res) => {
  const { mac_address, name, location } = req.body;

  if (!mac_address) return res.status(400).json({ error: 'mac_address required' });

  try {
    // Check if printer already registered by MAC
    const existing = await pool.query(
      'SELECT id, api_key, name FROM printers WHERE mac_address = $1 LIMIT 1',
      [mac_address]
    );

    if (existing.rows[0]) {
      // Already registered — return existing credentials
      return res.json({
        printer_id: existing.rows[0].id,
        api_key:    existing.rows[0].api_key,
        name:       existing.rows[0].name,
        registered: false, // was already registered
      });
    }

    // New printer — generate api_key and insert
    const api_key = crypto.randomBytes(32).toString('hex');

    // Use the first college in the DB (avoids hardcoded UUID that may not exist)
    const college = await pool.query('SELECT id FROM colleges ORDER BY created_at LIMIT 1');
    const college_id = college.rows[0]?.id || null;

    const { rows } = await pool.query(
      `INSERT INTO printers (college_id, name, location, mac_address, api_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, api_key, name`,
      [college_id, name || 'New Printer', location || 'Unknown', mac_address, api_key]
    );

    return res.status(201).json({
      printer_id: rows[0].id,
      api_key:    rows[0].api_key,
      name:       rows[0].name,
      registered: true, // freshly registered
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bridge — heartbeat ────────────────────────────────────────
// POST /api/printers/:id/heartbeat
// Header: x-api-key
router.post('/:id/heartbeat', bridgeAuth, async (req, res) => {
  try {
    // Verify api_key matches this printer
    const { rows } = await pool.query(
      `UPDATE printers
       SET is_online = true, last_heartbeat = NOW()
       WHERE id = $1 AND api_key = $2
       RETURNING id, name, is_online, last_heartbeat`,
      [req.params.id, req._apiKey]
    );

    if (!rows[0]) return res.status(401).json({ error: 'Invalid printer ID or API key' });
    return res.json({ printer: rows[0] });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bridge — today's done/failed counts ──────────────────────
// GET /api/printers/:id/stats
// Header: x-api-key
router.get('/:id/stats', bridgeAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'done'   AND updated_at >= CURRENT_DATE) AS done_today,
         COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= CURRENT_DATE) AS failed_today
       FROM jobs
       WHERE printer_id = $1`,
      [req.params.id]
    );
    return res.json({
      done_today:   parseInt(rows[0].done_today,   10),
      failed_today: parseInt(rows[0].failed_today, 10),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Public — get job by QR token ─────────────────────────────
// (handled in routes/jobs.js via /api/jobs/qr/:token)

module.exports = router;