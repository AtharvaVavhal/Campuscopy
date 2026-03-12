// routes/jobs.js

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const QRCode  = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const db      = require("../config/db");
const authMiddleware  = require("../middleware/auth");
const { notifyJobStatus } = require("../utils/whatsapp");
const { sendPush, buildPayload } = require("../utils/push");

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

// ─── Multer ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = process.env.MULTER_DEST || "./uploads";
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

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
          cost, priority, page_from, page_to, status, phone_number, qr_token, qr_code, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16,NOW(),NOW())
       RETURNING *`,
      [
        jobId, college_id, printer_id,
        req.file.originalname, req.file.path,
        parsedPages, parsedCopies,
        isColor, isDoubleSided, cost, isPriority,
        pageFrom, pageTo,
        phone.trim() || null, qr_token, qr_code,
      ]
    );

    const job = result.rows[0];

    // ✅ Notify admin dashboard of new job instantly
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

// ─── GET /api/jobs/by-phone/:phone ───────────────────────────
router.get("/by-phone/:phone", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, "");
    const result = await db.query(
      `SELECT j.*, p.name AS printer_name, p.location AS printer_location
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

// ─── GET /api/jobs/printer/:printer_id (print bridge) ────────
router.get("/printer/:printer_id", bridgeAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM jobs
       WHERE printer_id = $1 AND status IN ('paid','queued','printing')
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
    res.json({ job: result.rows[0] });
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
    res.json({ job: result.rows[0] });
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

    // Socket — instant update to student browser and admin dashboard
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

    // WhatsApp notification (async — never blocks response)
    if (job.phone_number) notifyJobStatus(job, status);

    // Push notification
    const pushPayload = buildPayload(job, status);
    if (pushPayload) {
      db.query('SELECT * FROM push_subscriptions WHERE job_id = $1', [job.id])
        .then(async ({ rows: subs }) => {
          for (const sub of subs) {
            try {
              await sendPush(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                pushPayload
              );
            } catch (err) {
              if (err.statusCode === 410) {
                db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
              }
            }
          }
        })
        .catch(err => console.error('[push] DB error:', err.message));
    }

    res.json({ job });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;