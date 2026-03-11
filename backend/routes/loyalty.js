const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

const POINTS_PER_PAGE = 1;
const POINTS_TO_RUPEES = 0.10;
const MIN_REDEEM = 50;
const MAX_REDEEM_PERCENT = 50;

router.get('/:phone', async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, '');
    const { rows } = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type='earn'   THEN points ELSE 0 END), 0)::int AS total_earned,
         COALESCE(SUM(CASE WHEN type='redeem' THEN points ELSE 0 END), 0)::int AS total_redeemed
       FROM loyalty_transactions
       WHERE phone_number LIKE $1`,
      ['%' + phone.replace(/^\+?91/, '')]
    );
    const earned   = parseInt(rows[0].total_earned);
    const redeemed = parseInt(rows[0].total_redeemed);
    const balance  = earned - redeemed;

    const { rows: txns } = await db.query(
      `SELECT lt.*, j.file_name
       FROM loyalty_transactions lt
       LEFT JOIN jobs j ON lt.job_id = j.id
       WHERE lt.phone_number LIKE $1
       ORDER BY lt.created_at DESC
       LIMIT 10`,
      ['%' + phone.replace(/^\+?91/, '')]
    );

    return res.json({
      balance,
      total_earned: earned,
      total_redeemed: redeemed,
      rupee_value: parseFloat((balance * POINTS_TO_RUPEES).toFixed(2)),
      min_redeem: MIN_REDEEM,
      transactions: txns,
    });
  } catch (err) {
    console.error('Loyalty balance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/redeem', async (req, res) => {
  try {
    const { phone, job_id, points_to_use } = req.body;
    if (!phone || !job_id || !points_to_use)
      return res.status(400).json({ error: 'phone, job_id, points_to_use required' });

    const pts = parseInt(points_to_use);
    if (isNaN(pts) || pts < MIN_REDEEM)
      return res.status(400).json({ error: `Minimum ${MIN_REDEEM} points required to redeem` });

    const normalised = phone.replace(/\D/g, '');
    const { rows: bal } = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type='earn'   THEN points ELSE 0 END), 0)::int AS earned,
         COALESCE(SUM(CASE WHEN type='redeem' THEN points ELSE 0 END), 0)::int AS redeemed
       FROM loyalty_transactions WHERE phone_number LIKE $1`,
      ['%' + normalised.replace(/^91/, '')]
    );
    const balance = parseInt(bal[0].earned) - parseInt(bal[0].redeemed);
    if (pts > balance)
      return res.status(400).json({ error: `Not enough points. You have ${balance} pts` });

    const { rows: jobRows } = await db.query(
      'SELECT cost, college_id FROM jobs WHERE id = $1 LIMIT 1', [job_id]
    );
    if (!jobRows[0]) return res.status(404).json({ error: 'Job not found' });

    const jobCost = parseFloat(jobRows[0].cost);
    const maxDiscount = parseFloat((jobCost * MAX_REDEEM_PERCENT / 100).toFixed(2));
    const requestedDiscount = parseFloat((pts * POINTS_TO_RUPEES).toFixed(2));
    const discount = Math.min(requestedDiscount, maxDiscount);
    const actualPoints = Math.round(discount / POINTS_TO_RUPEES);
    const finalAmount = Math.max(parseFloat((jobCost - discount).toFixed(2)), 1);

    return res.json({
      valid: true,
      points_used: actualPoints,
      discount_amount: discount,
      original_amount: jobCost,
      final_amount: finalAmount,
      balance_after: balance - actualPoints,
      message: `${actualPoints} pts → ₹${discount} off`,
    });
  } catch (err) {
    console.error('Loyalty redeem error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/confirm-redeem', async (req, res) => {
  try {
    const { phone, job_id, points_used, college_id } = req.body;
    if (!phone || !job_id || !points_used)
      return res.status(400).json({ error: 'Missing fields' });

    await db.query(
      `INSERT INTO loyalty_transactions (phone_number, college_id, job_id, type, points, description)
       VALUES ($1, $2, $3, 'redeem', $4, $5)`,
      [phone, college_id || 'college1', job_id, points_used,
       `Redeemed ${points_used} pts for Rs.${(points_used * POINTS_TO_RUPEES).toFixed(0)} off`]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Confirm redeem error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/summary', auth, async (req, res) => {
  try {
    const college_id = req.admin?.college_id || 'college1';

    const { rows: topStudents } = await db.query(
      `SELECT
         phone_number,
         SUM(CASE WHEN type='earn'   THEN points ELSE 0 END)::int AS earned,
         SUM(CASE WHEN type='redeem' THEN points ELSE 0 END)::int AS redeemed,
         (SUM(CASE WHEN type='earn'  THEN points ELSE 0 END) -
          SUM(CASE WHEN type='redeem'THEN points ELSE 0 END))::int AS balance
       FROM loyalty_transactions
       WHERE college_id = $1
       GROUP BY phone_number
       ORDER BY earned DESC
       LIMIT 20`,
      [college_id]
    );

    const { rows: totals } = await db.query(
      `SELECT
         COUNT(DISTINCT phone_number)::int  AS total_members,
         COALESCE(SUM(CASE WHEN type='earn'   THEN points ELSE 0 END), 0)::int AS total_earned,
         COALESCE(SUM(CASE WHEN type='redeem' THEN points ELSE 0 END), 0)::int AS total_redeemed
       FROM loyalty_transactions WHERE college_id = $1`,
      [college_id]
    );

    return res.json({
      summary: totals[0],
      top_students: topStudents,
      points_to_rupees: POINTS_TO_RUPEES,
      points_per_page: POINTS_PER_PAGE,
    });
  } catch (err) {
    console.error('Loyalty admin summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.POINTS_PER_PAGE = POINTS_PER_PAGE;
module.exports.POINTS_TO_RUPEES = POINTS_TO_RUPEES;