// routes/printers.js
const express = require("express");
const crypto  = require("crypto");
const pool    = require("../config/db");
const auth    = require("../middleware/auth");

const router = express.Router();

// ── Bridge auth: validates x-api-key against DB ───────────────
async function bridgeAuth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "Missing API key" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM printers WHERE api_key = $1 LIMIT 1", [key]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid API key" });
    req._apiKey    = key;
    req._printerId = rows[0].id;
    next();
  } catch {
    return res.status(500).json({ error: "Auth error" });
  }
}

// ════════════════════════════════════════════════════════════════
// PUBLIC
// ════════════════════════════════════════════════════════════════

// GET /api/printers — list all printers (student PWA uses this to populate dropdown)
router.get("/", async (req, res) => {
  try {
    const { college_id } = req.query;
    let query  = "SELECT id, name, location, is_online, last_heartbeat FROM printers";
    const params = [];
    if (college_id) {
      params.push(college_id);
      query += " WHERE college_id = $1";
    }
    query += " ORDER BY name";
    const { rows } = await pool.query(query, params);
    return res.json({ printers: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/printers/:id — single printer (public, no secrets)
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, location, is_online, last_heartbeat, college_id
       FROM printers WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Printer not found" });
    return res.json({ printer: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════
// ADMIN — CRUD (JWT required)
// ════════════════════════════════════════════════════════════════

// GET /api/printers/admin/list — all printers for this college (includes api_key for display)
router.get("/admin/list", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, location, mac_address, is_online,
              last_heartbeat, created_at,
              -- mask api_key: only show last 8 chars
              CONCAT('...', RIGHT(api_key, 8)) AS api_key_hint
       FROM printers
       WHERE college_id = $1
       ORDER BY name`,
      [req.user.college_id]
    );
    return res.json({ printers: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/printers/admin/create — manually add a printer (admin-initiated, not bridge auto-register)
router.post("/admin/create", auth, async (req, res) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const api_key = crypto.randomBytes(32).toString("hex");
    const { rows } = await pool.query(
      `INSERT INTO printers (college_id, name, location, api_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, location, api_key, created_at`,
      [req.user.college_id, name, location || "Unknown", api_key]
    );
    // Return full api_key once — admin must copy it for the bridge .env
    return res.status(201).json({ printer: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/printers/admin/:id — update name/location
router.patch("/admin/:id", auth, async (req, res) => {
  const { name, location } = req.body;
  const updates = [];
  const params  = [];

  if (name     !== undefined) { params.push(name);     updates.push(`name = $${params.length}`); }
  if (location !== undefined) { params.push(location); updates.push(`location = $${params.length}`); }

  if (updates.length === 0)
    return res.status(400).json({ error: "No fields to update" });

  params.push(req.params.id, req.user.college_id);
  try {
    const { rows } = await pool.query(
      `UPDATE printers SET ${updates.join(", ")}
       WHERE id = $${params.length - 1} AND college_id = $${params.length}
       RETURNING id, name, location, is_online, last_heartbeat`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Printer not found" });
    return res.json({ printer: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/printers/admin/:id — remove printer (only if no active jobs)
router.delete("/admin/:id", auth, async (req, res) => {
  try {
    // Block deletion if printer has active jobs
    const activeRes = await pool.query(
      `SELECT COUNT(*) FROM jobs
       WHERE printer_id = $1 AND status IN ('paid','queued','printing')`,
      [req.params.id]
    );
    if (parseInt(activeRes.rows[0].count) > 0)
      return res.status(409).json({ error: "Cannot delete printer with active jobs" });

    const { rows } = await pool.query(
      `DELETE FROM printers
       WHERE id = $1 AND college_id = $2
       RETURNING id, name`,
      [req.params.id, req.user.college_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Printer not found" });
    return res.json({ deleted: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/printers/admin/:id/regenerate-key — rotate api_key
router.post("/admin/:id/regenerate-key", auth, async (req, res) => {
  try {
    const api_key = crypto.randomBytes(32).toString("hex");
    const { rows } = await pool.query(
      `UPDATE printers SET api_key = $1
       WHERE id = $2 AND college_id = $3
       RETURNING id, name, api_key`,
      [api_key, req.params.id, req.user.college_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Printer not found" });
    // Return full key once so admin can update bridge .env
    return res.json({ printer: rows[0], message: "API key rotated. Update your bridge .env now." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ════════════════════════════════════════════════════════════════
// BRIDGE — auto-register + heartbeat + stats
// ════════════════════════════════════════════════════════════════

// POST /api/printers/register — bridge calls this on startup
router.post("/register", async (req, res) => {
  const { mac_address, name, location } = req.body;
  if (!mac_address) return res.status(400).json({ error: "mac_address required" });

  try {
    // Already registered? Return existing creds
    const existing = await pool.query(
      "SELECT id, api_key, name FROM printers WHERE mac_address = $1 LIMIT 1",
      [mac_address]
    );
    if (existing.rows[0]) {
      return res.json({
        printer_id: existing.rows[0].id,
        api_key:    existing.rows[0].api_key,
        name:       existing.rows[0].name,
        registered: false,
      });
    }

    // New printer
    const api_key = crypto.randomBytes(32).toString("hex");
    const college = await pool.query("SELECT id FROM colleges ORDER BY created_at LIMIT 1");
    const college_id = college.rows[0]?.id || null;

    const { rows } = await pool.query(
      `INSERT INTO printers (college_id, name, location, mac_address, api_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, api_key, name`,
      [college_id, name || "New Printer", location || "Unknown", mac_address, api_key]
    );
    return res.status(201).json({
      printer_id: rows[0].id,
      api_key:    rows[0].api_key,
      name:       rows[0].name,
      registered: true,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/printers/:id/heartbeat — bridge pings every 30s
router.post("/:id/heartbeat", bridgeAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE printers
       SET is_online = true, last_heartbeat = NOW()
       WHERE id = $1 AND api_key = $2
       RETURNING id, name, is_online, last_heartbeat`,
      [req.params.id, req._apiKey]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid printer ID or API key" });

    // Emit to admin dashboard
    const io = req.app.get("io");
    if (io) io.to("printer:" + req.params.id).emit("printer_heartbeat", rows[0]);

    return res.json({ printer: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/printers/:id/stats — bridge fetches daily counters
router.get("/:id/stats", bridgeAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'done'   AND updated_at >= CURRENT_DATE) AS done_today,
         COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= CURRENT_DATE) AS failed_today,
         COUNT(*) FILTER (WHERE status IN ('paid','queued','printing'))            AS queue_length
       FROM jobs WHERE printer_id = $1`,
      [req.params.id]
    );
    return res.json({
      done_today:   parseInt(rows[0].done_today),
      failed_today: parseInt(rows[0].failed_today),
      queue_length: parseInt(rows[0].queue_length),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/printers/:id/offline — bridge calls on clean shutdown
router.post("/:id/offline", bridgeAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE printers SET is_online = false WHERE id = $1 AND api_key = $2",
      [req.params.id, req._apiKey]
    );
    const io = req.app.get("io");
    if (io) io.to("printer:" + req.params.id).emit("printer_offline", { id: req.params.id });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;