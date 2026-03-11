// routes/payments.js

const express = require("express");
const router  = express.Router();
const { createPaymentOrder, webhook } = require("../controllers/paymentController");

// POST /api/payments/create-order
router.post("/create-order", createPaymentOrder);

// POST /api/payments/webhook  (raw body — see server.js middleware)
router.post("/webhook", webhook);

module.exports = router;