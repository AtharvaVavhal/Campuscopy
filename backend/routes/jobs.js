// routes/jobs.js
// Changes in this version (Phase 1):
//   1. POST /api/jobs/upload  — saves phone number from FormData to DB
//   2. PATCH /:id/status      — sends WhatsApp notification on printing/done/failed
//   3. GET  /by-phone/:phone  — order history lookup (already in frontend)

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");
const authMiddleware = require("../middleware/auth");
const { notifyJobStatus } = require("../utils/whatsapp");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, Word, and images are allowed."));
    }
  },
});

// ─── POST /api/jobs/upload ────────────────────────────────────────────────────
// Creates a new print job. Saves phone number so WhatsApp notifications work.
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const {
      printer_id,
      pages,
      copies = 1,
      color = false,
      double_sided = false,
      phone = "",        // ← from app.html FormData field "phone"
    } = req.body;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!printer_id)  return res.status(400).json({ error: "No printer selected" });

    const pricePerPage = color === "true" ? 5 : 1;
    const multiplier   = double_sided === "true" ? 0.8 : 1;
    const cost         = (parseInt(pages) * parseInt(copies) * pricePerPage * multiplier).toFixed(2);

    const jobId = uuidv4();

    // ✅ phone_number saved here — used later for WhatsApp notification
    const result = await db.query(
      `INSERT INTO jobs
         (id, file_name, printer_id, pages, copies, color, double_sided, cost, status, phone_number, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW())
       RETURNING *`,
      [
        jobId,
        req.file.originalname,
        printer_id,
        parseInt(pages),
        parseInt(copies),
        color === "true",
        double_sided === "true",
        cost,
        phone.trim() || null,   // null if student left it blank
      ]
    );

    res.status(201).json({ job: result.rows[0] });
  } catch (err) {
    console.error("Job creation error:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// ─── GET /api/jobs/:id ────────────────────────────────────────────────────────
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
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// ─── GET /api/jobs/by-phone/:phone ───────────────────────────────────────────
// Order history — used by the history screen in app.html
router.get("/by-phone/:phone", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, "");
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.phone_number LIKE $1
       ORDER BY j.created_at DESC
       LIMIT 50`,
      ["%" + phone.replace(/^\+?91/, "")]   // match last 10 digits regardless of prefix
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── GET /api/jobs (admin) ────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       ORDER BY j.created_at DESC
       LIMIT 100`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// ─── PATCH /api/jobs/:id/status (admin) ──────────────────────────────────────
// Updates job status, emits socket event, and sends WhatsApp notification.
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "paid", "queued", "printing", "done", "failed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const result = await db.query(
      `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING *, (SELECT name FROM printers WHERE id = jobs.printer_id) AS printer_name`,
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Job not found" });

    const job = result.rows[0];

    // 1. Emit socket event → student's browser updates instantly
    const io = req.app.get("io");
    io.to(`job:${job.id}`).emit("job_update", {
      id: job.id,
      status: job.status,
      updated_at: job.updated_at,
    });

    if (job.printer_id) {
      io.to(`printer:${job.printer_id}`).emit("queue_update", {
        jobId: job.id,
        status: job.status,
      });
    }

    // 2. Send WhatsApp notification (printing / done / failed only)
    //    Runs async — never delays the HTTP response
    notifyJobStatus(job, status);

    res.json({ job });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;