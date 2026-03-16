// routes/payments.js

const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const { createPaymentOrder, webhook, refundPayment } = require("../controllers/paymentController");

// POST /api/payments/create-order
router.post("/create-order", createPaymentOrder);

// POST /api/payments/webhook  (raw body — see server.js middleware)
router.post("/webhook", webhook);

// POST /api/payments/refund  (admin only)
router.post("/refund", auth, refundPayment);

module.exports = router;