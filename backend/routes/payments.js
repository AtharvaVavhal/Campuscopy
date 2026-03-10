const express = require('express');
const { createPaymentOrder, webhook } = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-order', createPaymentOrder);
router.post('/webhook', webhook);

module.exports = router;
