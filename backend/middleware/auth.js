const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Full JWT auth for admin dashboard
const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// API key auth for print bridge
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'No API key provided' });
  try {
    const { rows } = await pool.query('SELECT * FROM printers WHERE api_key = $1 LIMIT 1', [apiKey]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid API key' });
    req.printer = rows[0];
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Accept either JWT or API key
const authOrApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) return apiKeyAuth(req, res, next);
  return auth(req, res, next);
};

module.exports = auth;
module.exports.apiKeyAuth = apiKeyAuth;
module.exports.authOrApiKey = authOrApiKey;
