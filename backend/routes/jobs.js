// routes/jobs.js

const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const QRCode  = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const jwt     = require("jsonwebtoken");
const db      = require("../config/db");
const authMiddleware  = require("../middleware/auth");
const studentAuth     = require("../middleware/studentAuth");
const upload  = require("../middleware/upload");
const { notifyJobStatus } = require("../utils/whatsapp");
const { sendPush, buildPayload } = require("../utils/push");
const { notificationsQueue } = require("../queues/queues");

// ─── Bridge auth: validates x-api-key against DB ─────────────
async function bridgeAuth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "Missing API key" });
  try {
    const { rows } = await db.query(
      "SELECT id FROM printers WHERE api_key = $1 LIMIT 1", [key]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid API key" });
    req._printerId = rows[0].id;
    next();
  } catch {
    return res.status(500).json({ error: "Auth error" });
  }
}

// ─── Combined: JWT admin OR valid bridge API key ──────────────
function adminOrBridgeAuth(req, res, next) {
  if (req.headers["x-api-key"]) return bridgeAuth(req, res, next);
  return authMiddleware(req, res, next);
}

// ─── POST /api/jobs/upload ────────────────────────────────────
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const {
      printer_id,
      pages,
      copies      = 1,
      color       = false,
      double_sided = false,
      phone       = "",
      email       = "",
      priority    = false,
      page_from   = null,
      page_to     = null,
    } = req.body;

    if (!req.file)   return res.status(400).json({ error: "No file uploaded" });
    if (!printer_id) return res.status(400).json({ error: "No printer selected" });

    const parsedPages  = parseInt(pages);
    const parsedCopies = parseInt(copies);
    if (!parsedPages  || parsedPages  < 1) return res.status(400).json({ error: "Invalid page count" });
    if (!parsedCopies || parsedCopies < 1) return res.status(400).json({ error: "Invalid copies count" });

    const isColor       = color        === "true" || color        === true;
    const isDoubleSided = double_sided === "true" || double_sided === true;
    const isPriority    = priority     === "true" || priority     === true;

    const pageFrom = page_from ? parseInt(page_from) : null;
    const pageTo   = page_to   ? parseInt(page_to)   : null;

    const pricePerPage = isColor ? 5 : 1;
    const multiplier   = isDoubleSided ? 0.8 : 1;
    const priorityFee  = isPriority ? 5 : 0;
    const cost = (parsedPages * parsedCopies * pricePerPage * multiplier + priorityFee).toFixed(2);

    const printerRow = await db.query(
      "SELECT college_id FROM printers WHERE id = $1",
      [printer_id]
    );
    const college_id = printerRow.rows[0]?.college_id || null;

    const qr_token = uuidv4();
    const qr_code  = await QRCode.toDataURL(JSON.stringify({ qr_token }));

    const jobId = uuidv4();

    const result = await db.query(
      `INSERT INTO jobs
         (id, college_id, printer_id, file_name, file_path, pages, copies, color, double_sided,
          cost, priority, page_from, page_to, status, phone_number, email, qr_token, qr_code, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16,$17,NOW(),NOW())
       RETURNING *`,
      [
        jobId, college_id, printer_id,
        req.file.originalname, req.file.path,
        parsedPages, parsedCopies,
        isColor, isDoubleSided, cost, isPriority,
        pageFrom, pageTo,
        phone.trim() || null,
        email.trim().toLowerCase() || null,
        qr_token, qr_code,
      ]
    );

    const job = result.rows[0];

    const io = req.app.get("io");
    if (io) {
      io.emit("queue_update", { jobId: job.id, status: "pending" });
    }

    res.status(201).json({ job });

  } catch (err) {
    console.error("Job creation error:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// ─── GET /api/jobs (admin) ────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const college_id = req.user?.college_id;
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.college_id = $1
       ORDER BY j.priority DESC, j.created_at ASC
       LIMIT 100`,
      [college_id]
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// ─── GET /api/jobs/by-phone/:phone ───────────────────────────
// Accepts both admin JWT and student JWT.
// Students can only query their own phone number.
router.get("/by-phone/:phone", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Authentication required" });

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const phone = decodeURIComponent(req.params.phone).replace(/\s/g, "");
  const last10 = phone.replace(/^\+?91/, "").slice(-10);

  // Students can only see their own orders
  if (decoded.role === "student") {
    const studentLast10 = decoded.phone.replace(/^\+?91/, "").slice(-10);
    if (studentLast10 !== last10) {
      return res.status(403).json({ error: "You can only view your own orders" });
    }
  }

  try {
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name, p.location AS printer_location
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.phone_number LIKE $1
       ORDER BY j.created_at DESC LIMIT 50`,
      ["%" + last10]
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── GET /api/jobs/printer/:printer_id (print bridge) ────────
router.get("/printer/:printer_id", bridgeAuth, async (req, res) => {
  if (req._printerId !== req.params.printer_id) {
    return res.status(403).json({ error: "Printer ID mismatch" });
  }
  try {
    const result = await db.query(
      `SELECT * FROM jobs
       WHERE printer_id = $1 AND status IN ('pending','paid','queued','printing')
       ORDER BY priority DESC, created_at ASC`,
      [req.params.printer_id]
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch printer jobs" });
  }
});

// ─── GET /api/jobs/qr/:token (counter verification) ──────────
router.get("/qr/:token", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.qr_token = $1`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Invalid QR token" });

    // BUG FIX: strip internal fields before returning to unauthenticated callers
    const { file_path, razorpay_order_id, coupon_id, ...safeJob } = result.rows[0];
    res.json({ job: safeJob });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── GET /api/jobs/:id ────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name, p.location AS printer_location
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Job not found" });

    // BUG FIX: strip sensitive/internal fields before returning to unauthenticated callers
    const { file_path, razorpay_order_id, coupon_id, ...safeJob } = result.rows[0];
    res.json({ job: safeJob });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// ─── GET /api/jobs/:id/file (print bridge downloads PDF) ─────
router.get("/:id/file", bridgeAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM jobs WHERE id = $1", [req.params.id]);
    const job = result.rows[0];
    if (!job) return res.status(404).json({ error: "Job not found" });

    // BUG FIX: ensure the requesting bridge owns this job's printer
    if (job.printer_id !== req._printerId) {
      return res.status(403).json({ error: "This job does not belong to your printer" });
    }

    if (!fs.existsSync(job.file_path)) return res.status(404).json({ error: "File not found on disk" });
    res.download(job.file_path, job.file_name);
  } catch (err) {
    res.status(500).json({ error: "File download failed" });
  }
});

// ─── PATCH /api/jobs/:id/status (admin / print bridge) ───────
router.patch("/:id/status", adminOrBridgeAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["pending", "paid", "queued", "printing", "done", "failed", "cancelled"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const result = await db.query(
      `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING *, (SELECT name FROM printers WHERE id = jobs.printer_id) AS printer_name`,
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Job not found" });

    const job = result.rows[0];

    const io = req.app.get("io");
    if (io) {
      io.to(`job:${job.id}`).emit("job_update", {
        id: job.id, status: job.status, updated_at: job.updated_at,
      });
      if (job.printer_id) {
        io.to(`printer:${job.printer_id}`).emit("queue_update", {
          jobId: job.id, status: job.status,
        });
      }
    }

    // ── Enqueue notifications (WhatsApp + email + push) with retries ─
    const NOTIFY_STATUSES = ['printing', 'done', 'failed'];
    if (NOTIFY_STATUSES.includes(status)) {
      if (job.phone_number) {
        notificationsQueue.add('whatsapp', { jobId: job.id, status })
          .catch(err => console.error('[queue] WhatsApp enqueue error:', err.message));
      }
      if (job.email) {
        notificationsQueue.add('email', { jobId: job.id, status })
          .catch(err => console.error('[queue] Email enqueue error:', err.message));
      }
      notificationsQueue.add('push', { jobId: job.id, status })
        .catch(err => console.error('[queue] Push enqueue error:', err.message));
    }

    // ── Clean up uploaded PDF once the job reaches a terminal state ──
    const TERMINAL_STATUSES = ['done', 'failed', 'cancelled'];
    if (TERMINAL_STATUSES.includes(status) && job.file_path) {
      fs.unlink(job.file_path, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error(`[cleanup] Failed to delete ${job.file_path}:`, err.message);
        } else if (!err) {
          console.log(`[cleanup] Deleted ${job.file_path}`);
        }
      });
    }

    res.json({ job });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;