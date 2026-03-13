// models/job.js

const pool = require("../config/db");

const Job = {
  // ─── Create ──────────────────────────────────────────────
  async create({ college_id, printer_id, file_path, file_name, pages, copies, color, double_sided, cost, priority, page_from, page_to, qr_token, qr_code, phone_number }) {
    const { v4: uuidv4 } = require("uuid");
    const { rows } = await pool.query(
      `INSERT INTO jobs
         (id, college_id, printer_id, file_path, file_name, pages, copies, color, double_sided,
          cost, priority, page_from, page_to, qr_token, qr_code, phone_number, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',NOW(),NOW())
       RETURNING *`,
      [
        uuidv4(), college_id, printer_id, file_path, file_name,
        pages, copies, color, double_sided, cost,
        priority || false, page_from || null, page_to || null,
        qr_token || null, qr_code || null, phone_number || null,
      ]
    );
    return rows[0];
  },

  // ─── Find by ID ──────────────────────────────────────────
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT j.*, p.name AS printer_name, p.location AS printer_location
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // ─── Update status ───────────────────────────────────────
  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0] || null;
  },

  // ─── Mark paid (saves razorpay order id) ─────────────────
  async markPaid(id, razorpay_order_id) {
    const { rows } = await pool.query(
      `UPDATE jobs SET status = 'paid', razorpay_order_id = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [razorpay_order_id, id]
    );
    return rows[0] || null;
  },

  // ─── List by printer (print bridge) ─────────────────────
  async listByPrinter(printer_id) {
    const { rows } = await pool.query(
      `SELECT * FROM jobs
       WHERE printer_id = $1
       ORDER BY priority DESC, created_at ASC`,
      [printer_id]
    );
    return rows;
  },

  // ─── Find by QR token ────────────────────────────────────
  async findByQrToken(qr_token) {
    const { rows } = await pool.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.qr_token = $1 LIMIT 1`,
      [qr_token]
    );
    return rows[0] || null;
  },

  // ─── List by phone (order history) ──────────────────────
  async listByPhone(phone_number) {
    // Normalise to bare 10-digit number so the index can be used
    const bare = phone_number.replace(/^\+?91/, "").replace(/\D/g, "");
    const { rows } = await pool.query(
      `SELECT j.*, p.name AS printer_name, p.location AS printer_location
       FROM jobs j
       LEFT JOIN printers p ON j.printer_id = p.id
       WHERE RIGHT(j.phone_number, 10) = $1
       ORDER BY j.created_at DESC
       LIMIT 20`,
      [bare.slice(-10)]
    );
    return rows;
  },

  // ─── List all (admin) ────────────────────────────────────
  async listAll({ status, limit = 100 } = {}) {
    let query = `
      SELECT j.*, p.name AS printer_name
      FROM jobs j
      LEFT JOIN printers p ON p.id = j.printer_id
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE j.status = $${params.length}`;
    }
    query += ` ORDER BY j.priority DESC, j.created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    const { rows } = await pool.query(query, params);
    return rows;
  },

  // ─── Analytics ───────────────────────────────────────────
  async analytics() {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'done')                           AS total_done,
        COUNT(*) FILTER (WHERE status NOT IN ('done','failed','pending')) AS active_jobs,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'), 0)            AS total_revenue,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'
          AND created_at >= NOW() - INTERVAL '30 days'), 0)              AS revenue_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS jobs_30d
      FROM jobs
    `);
    return rows[0];
  },
};

module.exports = Job;