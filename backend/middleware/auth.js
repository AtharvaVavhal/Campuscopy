// middleware/auth.js

const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  // Allow print bridge via API key
  const apiKey = req.headers["x-api-key"];
  if (apiKey && process.env.PRINT_BRIDGE_API_KEY && apiKey === process.env.PRINT_BRIDGE_API_KEY) {
    req.user = { role: "bridge" };
    return next();
  }

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
