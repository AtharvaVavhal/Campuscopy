const pool = require("../config/db");

const Admin = {
  async findByEmail(email) {
    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE email = $1 LIMIT 1",
      [email]
    );
    return rows[0] || null;
  },

  async create({ college_id, name, email, password_hash }) {
    const { rows } = await pool.query(
      `INSERT INTO admins (college_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, college_id, name, email, created_at`,
      [college_id, name, email, password_hash]
    );
    return rows[0];
  },

  async updateLastLogin(id) {
    await pool.query(
      "UPDATE admins SET last_login = NOW() WHERE id = $1",
      [id]
    );
  },
};

module.exports = Admin;
