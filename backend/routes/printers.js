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

    // Use VIT college_id as default (from schema seed)
    const DEFAULT_COLLEGE_ID = '00000000-0000-0000-0000-000000000001';

    const { rows } = await pool.query(
      `INSERT INTO printers (college_id, name, location, mac_address, api_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, api_key, name`,
      [DEFAULT_COLLEGE_ID, name || 'New Printer', location || 'Unknown', mac_address, api_key]
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

// ── Public — get job by QR token ─────────────────────────────
router.get('/qr/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE qr_token = $1 LIMIT 1',
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json({ job: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;