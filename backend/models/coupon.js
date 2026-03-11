const pool = require('../config/db');

const Coupon = {
  async findByCode(code) {
    const { rows } = await pool.query(
      'SELECT * FROM coupons WHERE code = $1 LIMIT 1',
      [code.toUpperCase().trim()]
    );
    return rows[0] || null;
  },

  // Validate a coupon against a job cost, returns discount amount or error
  async validate(code, jobCost) {
    const coupon = await this.findByCode(code);

    if (!coupon) return { valid: false, error: 'Invalid coupon code' };
    if (!coupon.is_active) return { valid: false, error: 'Coupon is no longer active' };
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
      return { valid: false, error: 'Coupon has expired' };
    if (coupon.uses_left !== null && coupon.uses_left <= 0)
      return { valid: false, error: 'Coupon has been fully used' };
    if (jobCost < coupon.min_order)
      return { valid: false, error: `Minimum order ₹${coupon.min_order} required` };

    const discount = coupon.discount_type === 'percent'
      ? parseFloat((jobCost * coupon.discount_value / 100).toFixed(2))
      : Math.min(parseFloat(coupon.discount_value), jobCost);

    const finalAmount = parseFloat((jobCost - discount).toFixed(2));

    return {
      valid: true,
      coupon_id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: discount,
      final_amount: Math.max(finalAmount, 1), // min ₹1
    };
  },

  async recordUse(coupon_id, job_id, saved_amount) {
    // Insert use record
    await pool.query(
      'INSERT INTO coupon_uses (coupon_id, job_id, saved_amount) VALUES ($1, $2, $3)',
      [coupon_id, job_id, saved_amount]
    );
    // Decrement uses_left if not unlimited
    await pool.query(
      'UPDATE coupons SET uses_left = uses_left - 1 WHERE id = $1 AND uses_left IS NOT NULL',
      [coupon_id]
    );
  },

  async create({ college_id, code, discount_type, discount_value, min_order, uses_left, expires_at }) {
    const { rows } = await pool.query(
      `INSERT INTO coupons (college_id, code, discount_type, discount_value, min_order, uses_left, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [college_id || 'college1', code.toUpperCase().trim(), discount_type, discount_value,
       min_order || 0, uses_left || null, expires_at || null]
    );
    return rows[0];
  },

  async listAll(college_id) {
    const { rows } = await pool.query(
      `SELECT c.*, COUNT(cu.id)::int as total_uses, COALESCE(SUM(cu.saved_amount), 0) as total_saved
       FROM coupons c
       LEFT JOIN coupon_uses cu ON c.id = cu.coupon_id
       WHERE c.college_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [college_id]
    );
    return rows;
  },
};

module.exports = Coupon;