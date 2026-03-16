const pool = require('../config/db');
const Coupon = require('../models/coupon');

// POST /api/coupons/validate
// Public — student validates a code before paying
const validateCoupon = async (req, res) => {
  try {
    const { code, job_id } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code is required' });
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    const { rows } = await pool.query('SELECT cost FROM jobs WHERE id = $1 LIMIT 1', [job_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Job not found' });

    const result = await Coupon.validate(code, parseFloat(rows[0].cost));
    if (!result.valid) return res.status(400).json({ error: result.error });

    return res.json({
      valid: true,
      code: result.code,
      discount_type: result.discount_type,
      discount_value: result.discount_value,
      discount_amount: result.discount_amount,
      original_amount: parseFloat(rows[0].cost),
      final_amount: result.final_amount,
    });
  } catch (err) {
    console.error('Validate coupon error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/coupons — admin creates a coupon
const createCoupon = async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_order, uses_left, expires_at } = req.body;
    if (!code || !discount_type || !discount_value)
      return res.status(400).json({ error: 'code, discount_type, discount_value are required' });

    // ✅ FIX BUG13: auth middleware sets req.user, not req.admin
    const coupon = await Coupon.create({
      college_id: req.user?.college_id || 'college1',
      code, discount_type, discount_value, min_order, uses_left, expires_at,
    });
    return res.status(201).json({ coupon });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Coupon code already exists' });
    console.error('Create coupon error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/coupons — admin lists all coupons
const listCoupons = async (req, res) => {
  try {
    const college_id = req.user?.college_id || 'college1';
    const coupons = await Coupon.listAll(college_id);
    return res.json({ coupons });
  } catch (err) {
    console.error('List coupons error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { validateCoupon, createCoupon, listCoupons };