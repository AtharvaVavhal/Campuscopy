const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: admin.id, college_id: admin.college_id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    Admin.updateLastLogin(admin.id).catch(console.error);

    return res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        college_id: admin.college_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const register = async (req, res) => {
  try {
    const { college_id, name, email, password } = req.body;

    const existing = await Admin.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ college_id, name, email, password_hash });

    return res.status(201).json({ message: "Admin created", admin });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const me = async (req, res) => {
  return res.json({ admin: req.admin });
};

module.exports = { login, register, me };
