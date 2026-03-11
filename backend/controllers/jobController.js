const { emitJobStatus } = require('../utils/socket');
const { notifyPrintReady } = require('../utils/whatsapp');
const pool = require('../config/db');
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const pdfParse = require("pdf-parse");
const Job = require("../models/job");

// Auto-count PDF pages
const getPdfPageCount = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.numpages;
  } catch (err) {
    console.error("PDF parse error:", err.message);
    return null;
  }
};

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
      phone = "",
    } = req.body;

    // Auto-count pages from PDF if not provided
    let pageCount = parseInt(pages);
    if (!pageCount || isNaN(pageCount)) {
      const autoCount = await getPdfPageCount(req.file.path);
      if (!autoCount) {
        return res.status(400).json({ error: "Could not read PDF page count. Please enter pages manually." });
      }
      pageCount = autoCount;
    }

    if (!printer_id) {
      return res.status(400).json({ error: "printer_id is required" });
    }

    const cost = calculateCost({
      pages: pageCount,
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
      pages: pageCount,
      copies: parseInt(copies),
      color: color === "true" || color === true,
      double_sided: double_sided === "true" || double_sided === true,
      cost,
      qr_token,
      phone_number: phone || null,
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

    // Send WhatsApp notification when print is ready
    if (status === 'done' && job.phone_number) {
      // Fetch printer name/location for the message
      try {
        const { rows } = await pool.query(
          'SELECT name, location FROM printers WHERE id = $1',
          [job.printer_id]
        );
        const printer = rows[0] || { name: 'Printer', location: null };
        notifyPrintReady({
          phone: job.phone_number,
          fileName: job.file_name,
          printerName: printer.name,
          printerLocation: printer.location,
          cost: job.cost,
        }).catch(err => console.error('[WhatsApp] Background send error:', err.message));
      } catch (err) {
        console.error('[WhatsApp] Printer lookup error:', err.message);
      }
    }

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

// GET /api/jobs/by-phone/:phone
const getOrderHistory = async (req, res) => {
  try {
    let phone = req.params.phone;
    // Normalise: if 10 digits, prepend +91
    phone = phone.replace(/[\s\-().]/g, '');
    if (/^[6-9]\d{9}$/.test(phone)) phone = '+91' + phone;
    else if (/^\d{10,12}$/.test(phone)) phone = '+' + phone;

    const jobs = await Job.listByPhone(phone);
    return res.json({ jobs, phone });
  } catch (err) {
    console.error('Order history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { uploadJob, getJob, getJobsByPrinter, updateJobStatus, serveFile, getOrderHistory };