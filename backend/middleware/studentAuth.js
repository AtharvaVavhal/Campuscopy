// middleware/studentAuth.js
// Verifies a student JWT (phone-based, issued after OTP verification).
// Sets req.student = { phone, role: 'student' }

const jwt = require("jsonwebtoken");

function studentAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "student") {
      return res.status(403).json({ error: "Student token required" });
    }
    req.student = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = studentAuth;