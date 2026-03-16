// __tests__/helpers/setup.js
// Shared test utilities — mock DB, build app, sign tokens

const jwt = require('jsonwebtoken');

// ── JWT helpers ───────────────────────────────────────────────
const SECRET = 'test_secret_key';
process.env.JWT_SECRET = SECRET;
process.env.NODE_ENV   = 'test';
process.env.RAZORPAY_KEY_ID      = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET  = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret';

function adminToken(overrides = {}) {
  return jwt.sign(
    { id: 'admin-uuid-1', email: 'admin@test.com', role: 'admin', college_id: 'college-uuid-1', ...overrides },
    SECRET,
    { expiresIn: '1h' }
  );
}

function superAdminToken() {
  return adminToken({ role: 'superadmin' });
}

function studentToken(phone = '+919876543210') {
  return jwt.sign({ phone, role: 'student' }, SECRET, { expiresIn: '1h' });
}

// ── Mock DB query factory ─────────────────────────────────────
// Usage: mockQuery({ rows: [...] }) or mockQuery(new Error('fail'))
function mockQuery(result) {
  if (result instanceof Error) return jest.fn().mockRejectedValue(result);
  return jest.fn().mockResolvedValue(result);
}

// Chain multiple query responses in order
function mockQuerySequence(...results) {
  const fn = jest.fn();
  results.forEach((r, i) => {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  });
  return fn;
}

module.exports = { adminToken, superAdminToken, studentToken, mockQuery, mockQuerySequence, SECRET };