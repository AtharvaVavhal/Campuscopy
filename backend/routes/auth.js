// middleware/auth.js

const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  // NOTE: x-api-key is intentionally NOT accepted here — that header is only
  // for the per-printer bridgeAuth middleware in routes/jobs.js.
  // Allowing it here would let any bridge key bypass all admin JWT checks.

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = auth;