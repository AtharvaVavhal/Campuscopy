// routes/jobs.js

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const { v4: uuidv4 } = require("uuid");
const db      = require("../config/db");
const authMiddleware  = require("../middleware/auth");
const { notifyJobStatus } = require("../utils/whatsapp");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename:    (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    allowed.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error("Invalid file type"));
  },
});

// ─── POST /api/jobs/upload ────────────────────────────────────────────────────
// ─── POST /api/jobs/upload ────────────────────────────────────────────────────
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const {
      printer_id,
      pages,
      copies = 1,
      color = false,
      double_sided = false,
      phone = "",
      priority = false
    } = req.body;

    if (!req.file)   return res.status(400).json({ error: "No file uploaded" });
    if (!printer_id) return res.status(400).json({ error: "No printer selected" });

    // convert string values to boolean
    const isColor = color === "true" || color === true;
    const isDoubleSided = double_sided === "true" || double_sided === true;
    const isPriority = priority === "true" || priority === true;

    const pricePerPage = isColor ? 5 : 1;
    const multiplier   = isDoubleSided ? 0.8 : 1;
    const cost         = (parseInt(pages) * parseInt(copies) * pricePerPage * multiplier).toFixed(2);

    // Look up college_id from the printer
    const printerRow = await db.query(
      "SELECT college_id FROM printers WHERE id = $1",
      [printer_id]
    );

    const college_id = printerRow.rows[0]?.college_id || null;

    const jobId = uuidv4();

    const result = await db.query(
      `INSERT INTO jobs
       (id, college_id, printer_id, file_name, pages, copies, color, double_sided, cost, priority, status, phone_number, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,NOW(),NOW())
       RETURNING *`,
      [
        jobId,
        college_id,
        printer_id,
        req.file.originalname,
        parseInt(pages),
        parseInt(copies),
        isColor,
        isDoubleSided,
        cost,
        isPriority,
        phone.trim() || null,
      ]
    );

    res.status(201).json({ job: result.rows[0] });

  } catch (err) {
    console.error("Job creation error:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// ─── GET /api/jobs/by-phone/:phone ───────────────────────────────────────────
router.get("/by-phone/:phone", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, "");
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       WHERE j.phone_number LIKE $1
       ORDER BY j.created_at DESC LIMIT 50`,
      ["%" + phone.replace(/^\+?91/, "")]
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
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

// ─── GET /api/jobs (admin) ────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name
       FROM jobs j
       LEFT JOIN printers p ON p.id = j.printer_id
       ORDER BY j.priority DESC, j.created_at ASC
 LIMIT 100`
    );
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// ─── PATCH /api/jobs/:id/status (admin) ──────────────────────────────────────
router.patch("/:id/status", authMiddleware, async (req, res) => {
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

    // Socket — instant update to student browser
    const io = req.app.get("io");
    io.to(`job:${job.id}`).emit("job_update", {
      id: job.id, status: job.status, updated_at: job.updated_at,
    });
    if (job.printer_id) {
      io.to(`printer:${job.printer_id}`).emit("queue_update", {
        jobId: job.id, status: job.status,
      });
    }

    // WhatsApp notification (async — never blocks response)
    notifyJobStatus(job, status);

    res.json({ job });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
  
});

module.exports = router;