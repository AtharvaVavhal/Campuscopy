const express = require('express');
const auth = require('../middleware/auth');
const { validateCoupon, createCoupon, listCoupons } = require('../controllers/couponController');

const router = express.Router();

router.post('/validate', validateCoupon);           // Public — student
router.post('/', auth, createCoupon);               // Admin only
router.get('/', auth, listCoupons);                 // Admin only

module.exports = router;