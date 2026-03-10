const { emitJobStatus } = require('../utils/socket');
const path = require("path");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const Job = require("../models/job");

// Cost calculation
// B&W: ₹1 per page, Color: ₹5 per page, Double sided: 0.8x multiplier
const calculateCost = ({ pages, copies, color, double_sided }) => {
  const pricePerPage = color ? 5 : 1;
  const multiplier = double_sided ? 0.8 : 1;
  return parseFloat((pages * copies * pricePerPage * multiplier).toFixed(2));
};

// POST /api/jobs/upload
const uploadJob = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const {
      college_id = "college1",
      printer_id,
      pages,
      copies = 1,
      color = false,
      double_sided = false,
    } = req.body;

    if (!pages || isNaN(pages)) {
      return res.status(400).json({ error: "pages is required and must be a number" });
    }

    if (!printer_id) {
      return res.status(400).json({ error: "printer_id is required" });
    }

    const cost = calculateCost({
      pages: parseInt(pages),
      copies: parseInt(copies),
      color: color === "true" || color === true,
      double_sided: double_sided === "true" || double_sided === true,
    });

    const qr_token = uuidv4();

    const job = await Job.create({
      college_id,
      printer_id,
      file_path: req.file.path,
      file_name: req.file.originalname,
      pages: parseInt(pages),
      copies: parseInt(copies),
      color: color === "true" || color === true,
      double_sided: double_sided === "true" || double_sided === true,
      cost,
      qr_token,
    });

    // Generate QR code as base64 image
    const qrCodeImage = await QRCode.toDataURL(qr_token);

    return res.status(201).json({
      message: "Job created successfully",
      job: {
        id: job.id,
        file_name: job.file_name,
        pages: job.pages,
        copies: job.copies,
        color: job.color,
        double_sided: job.double_sided,
        cost: job.cost,
        status: job.status,
        qr_token: job.qr_token,
        qr_code: qrCodeImage,
        created_at: job.created_at,
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/jobs/:id
const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json({ job });
  } catch (err) {
    console.error("Get job error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/jobs/printer/:printerId
const getJobsByPrinter = async (req, res) => {
  try {
    const jobs = await Job.listByPrinter(req.params.printerId);
    return res.json({ jobs });
  } catch (err) {
    console.error("List jobs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// PATCH /api/jobs/:id/status
const updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "paid", "queued", "printing", "done", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const job = await Job.updateStatus(req.params.id, status);
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Emit socket event
    const io = req.app.get("io");
    if (io) emitJobStatus(io, job);

    return res.json({ job });
  } catch (err) {
    console.error("Update status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// GET /api/jobs/:id/file
const serveFile = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.sendFile(require('path').resolve(job.file_path));
  } catch (err) {
    console.error('Serve file error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { uploadJob, getJob, getJobsByPrinter, updateJobStatus, serveFile };
