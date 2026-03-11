const pool = require("../config/db");

const Job = {
  async create({ college_id, printer_id, file_path, file_name, pages, copies, color, double_sided, cost, qr_token, phone_number }) {
    const { rows } = await pool.query(
      `INSERT INTO jobs 
        (college_id, printer_id, file_path, file_name, pages, copies, color, double_sided, cost, qr_token, phone_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [college_id, printer_id, file_path, file_name, pages, copies, color, double_sided, cost, qr_token, phone_number || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      "SELECT * FROM jobs WHERE id = $1 LIMIT 1",
      [id]
    );
    return rows[0] || null;
  },

  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE jobs SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  },

  async listByPrinter(printer_id) {
    const { rows } = await pool.query(
      `SELECT * FROM jobs 
       WHERE printer_id = $1 
       ORDER BY created_at DESC`,
      [printer_id]
    );
    return rows;
  },

  async findByQrToken(qr_token) {
    const { rows } = await pool.query(
      "SELECT * FROM jobs WHERE qr_token = $1 LIMIT 1",
      [qr_token]
    );
    return rows[0] || null;
  },

  async listByPhone(phone_number) {
    const { rows } = await pool.query(
      `SELECT j.*, p.name as printer_name, p.location as printer_location
       FROM jobs j
       LEFT JOIN printers p ON j.printer_id = p.id
       WHERE j.phone_number = $1
       ORDER BY j.created_at DESC
       LIMIT 20`,
      [phone_number]
    );
    return rows;
  },
};

module.exports = Job;

