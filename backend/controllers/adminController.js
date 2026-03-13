// controllers/adminController.js
const pool = require("../config/db");

// ── GET /api/admin/stats ──────────────────────────────────────
// Dashboard overview card numbers
async function getStats(req, res) {
  const college_id = req.user.college_id;
  try {
    const { rows } = await pool.query(
      `SELECT
        COUNT(*)                                                    AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'done')                    AS completed_jobs,
        COUNT(*) FILTER (WHERE status IN ('paid','queued','printing')) AS active_jobs,
        COUNT(*) FILTER (WHERE status = 'failed')                  AS failed_jobs,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'), 0)      AS total_revenue,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'
          AND created_at >= NOW() - INTERVAL '30 days'), 0)        AS revenue_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS jobs_30d,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)         AS jobs_today,
        COALESCE(SUM(cost) FILTER (WHERE status = 'done'
          AND created_at >= CURRENT_DATE), 0)                      AS revenue_today
       FROM jobs
       WHERE college_id = $1`,
      [college_id]
    );

    // Active printer count
    const printerRes = await pool.query(
      `SELECT
        COUNT(*)                                              AS total_printers,
        COUNT(*) FILTER (WHERE is_online = true
          AND last_heartbeat > NOW() - INTERVAL '2 minutes') AS online_printers
       FROM printers WHERE college_id = $1`,
      [college_id]
    );

    // Revenue by day for last 14 days (for sparkline)
    const chartRes = await pool.query(
      `SELECT
        DATE(created_at)           AS day,
        COUNT(*)                   AS jobs,
        COALESCE(SUM(cost), 0)    AS revenue
       FROM jobs
       WHERE college_id = $1
         AND status = 'done'
         AND created_at >= NOW() - INTERVAL '14 days'
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [college_id]
    );

    return res.json({
      stats:   { ...rows[0], ...printerRes.rows[0] },
      chart:   chartRes.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── GET /api/admin/jobs ───────────────────────────────────────
// Paginated job list with optional status/date filters
async function listJobs(req, res) {
  const college_id = req.user.college_id;
  const { status, date, printer_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const params  = [college_id];
    const filters = ["j.college_id = $1"];

    if (status) {
      params.push(status);
      filters.push(`j.status = $${params.length}`);
    }
    if (date) {
      params.push(date);
      filters.push(`DATE(j.created_at) = $${params.length}`);
    }
    if (printer_id) {
      params.push(printer_id);
      filters.push(`j.printer_id = $${params.length}`);
    }

    const where = filters.join(" AND ");

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM jobs j WHERE ${where}`,
      params
    );

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT j.*,
              p.name     AS printer_name,
              p.location AS printer_location
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE ${where}
       ORDER BY j.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      jobs:  rows,
      total: parseInt(countRes.rows[0].count),
      page:  parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── PATCH /api/admin/jobs/:id/status ─────────────────────────
async function updateJobStatus(req, res) {
  const college_id = req.user.college_id;
  const { id }     = req.params;
  const { status } = req.body;

  const VALID = ["pending","paid","queued","printing","done","failed"];
  if (!VALID.includes(status))
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID.join(", ")}` });

  try {
    const { rows } = await pool.query(
      `UPDATE jobs
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND college_id = $3
       RETURNING *`,
      [status, id, college_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Job not found" });

    // Emit socket event so PWA updates in real time
    const io = req.app.get("io");
    if (io) io.to("job:" + id).emit("job_update", { status, job: rows[0] });

    return res.json({ job: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── GET /api/admin/settings ───────────────────────────────────
async function getSettings(req, res) {
  const college_id = req.user.college_id;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, razorpay_key_id, platform_fee_pct, status
       FROM colleges WHERE id = $1 LIMIT 1`,
      [college_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "College not found" });
    // Never return razorpay_key_secret in response
    return res.json({ settings: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── PATCH /api/admin/settings ─────────────────────────────────
async function updateSettings(req, res) {
  const college_id = req.user.college_id;
  const { name, email, razorpay_key_id, razorpay_key_secret, platform_fee_pct } = req.body;

  // Build dynamic SET clause — only update fields that were provided
  const updates = [];
  const params  = [];

  if (name              !== undefined) { params.push(name);               updates.push(`name = $${params.length}`); }
  if (email             !== undefined) { params.push(email);              updates.push(`email = $${params.length}`); }
  if (razorpay_key_id   !== undefined) { params.push(razorpay_key_id);   updates.push(`razorpay_key_id = $${params.length}`); }
  if (razorpay_key_secret !== undefined) { params.push(razorpay_key_secret); updates.push(`razorpay_key_secret = $${params.length}`); }
  if (platform_fee_pct  !== undefined) { params.push(platform_fee_pct);  updates.push(`platform_fee_pct = $${params.length}`); }

  if (updates.length === 0)
    return res.status(400).json({ error: "No fields to update" });

  params.push(college_id);
  try {
    const { rows } = await pool.query(
      `UPDATE colleges SET ${updates.join(", ")} WHERE id = $${params.length}
       RETURNING id, name, email, razorpay_key_id, platform_fee_pct, status`,
      params
    );
    return res.json({ settings: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── GET /api/admin/analytics ──────────────────────────────────
// Daily revenue + job count for last N days (default 30)
async function getAnalytics(req, res) {
  const college_id = req.user.college_id;
  const days = Math.min(parseInt(req.query.days) || 30, 365);

  try {
    // Daily breakdown
    const dailyRes = await pool.query(
      `SELECT
         DATE(created_at)                                AS day,
         COUNT(*)                                        AS total_jobs,
         COUNT(*) FILTER (WHERE status = 'done')        AS done_jobs,
         COALESCE(SUM(cost) FILTER (WHERE status='done'),0) AS revenue,
         COALESCE(SUM(pages * copies)
           FILTER (WHERE status = 'done'), 0)           AS pages_printed
       FROM jobs
       WHERE college_id = $1
         AND created_at >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [college_id, days]
    );

    // Top printers by jobs done
    const printerRes = await pool.query(
      `SELECT p.name, p.location,
              COUNT(*) FILTER (WHERE j.status = 'done') AS jobs_done,
              COALESCE(SUM(j.cost) FILTER (WHERE j.status = 'done'), 0) AS revenue
       FROM jobs j
       JOIN printers p ON p.id = j.printer_id
       WHERE j.college_id = $1
         AND j.created_at >= NOW() - ($2 || ' days')::INTERVAL
       GROUP BY p.id, p.name, p.location
       ORDER BY jobs_done DESC
       LIMIT 10`,
      [college_id, days]
    );

    // Job type breakdown (color vs B&W, single vs double sided)
    const typeRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE color = true)       AS color_jobs,
         COUNT(*) FILTER (WHERE color = false)      AS bw_jobs,
         COUNT(*) FILTER (WHERE double_sided = true) AS double_sided_jobs,
         COUNT(*) FILTER (WHERE priority = true)    AS priority_jobs
       FROM jobs
       WHERE college_id = $1
         AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
      [college_id, days]
    );

    return res.json({
      daily:    dailyRes.rows,
      printers: printerRes.rows,
      breakdown: typeRes.rows[0],
      period_days: days,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  getStats,
  listJobs,
  updateJobStatus,
  getSettings,
  updateSettings,
  getAnalytics,
};