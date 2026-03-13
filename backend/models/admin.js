// routes/admin.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const {
  getStats,
  listJobs,
  updateJobStatus,
  getSettings,
  updateSettings,
  getAnalytics,
} = require("../controllers/adminController");

// All admin routes require JWT auth
router.use(auth);

// ── Dashboard ─────────────────────────────────────────────────
router.get("/stats",     getStats);
router.get("/analytics", getAnalytics);

// ── Jobs ──────────────────────────────────────────────────────
router.get("/jobs",               listJobs);
router.patch("/jobs/:id/status",  updateJobStatus);

// ── Settings ──────────────────────────────────────────────────
router.get("/settings",   getSettings);
router.patch("/settings", updateSettings);

module.exports = router;