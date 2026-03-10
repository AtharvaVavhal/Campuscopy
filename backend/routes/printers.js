const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Public — list all printers
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, location, is_online, last_heartbeat FROM printers ORDER BY name');
    return res.json({ printers: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Bridge — heartbeat
router.post('/:id/heartbeat', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE printers SET is_online = true, last_heartbeat = NOW() WHERE id = $1 RETURNING id, name, is_online, last_heartbeat',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Printer not found' });
    return res.json({ printer: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Public — get job by QR token
router.get('/qr/:token', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE qr_token = $1 LIMIT 1', [req.params.token]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json({ job: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
