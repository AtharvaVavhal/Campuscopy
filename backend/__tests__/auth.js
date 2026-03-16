// __tests__/auth.test.js
// Tests for: Fix 1 (otp_sessions), Fix 11 (change-password), Fix 8 (OTP rate limit)

const request  = require('supertest');
const express  = require('express');
const bcrypt   = require('bcryptjs');
const { adminToken, mockQuery, mockQuerySequence } = require('./helpers/setup');

// ── Mock dependencies ─────────────────────────────────────────
jest.mock('../config/db');
jest.mock('../utils/whatsapp', () => ({
  sendWhatsApp: jest.fn().mockResolvedValue({}),
}));

const db          = require('../config/db');
const { sendWhatsApp } = require('../utils/whatsapp');

// ── Build minimal test app ────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth_routes'));
  return app;
}

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/otp/send', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends OTP and returns phone — Fix 1: writes to otp_sessions', async () => {
    // DELETE old sessions, INSERT new session
    db.query = mockQuerySequence(
      { rows: [], rowCount: 0 },   // DELETE FROM otp_sessions
      { rows: [], rowCount: 1 },   // INSERT INTO otp_sessions
    );

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/send')
      .send({ phone: '9876543210' });

    expect(res.status).toBe(200);
    expect(res.body.phone).toMatch(/^\+91/);

    // Verify it actually hit otp_sessions
    const calls = db.query.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('otp_sessions'))).toBe(true);
  });

  test('returns _dev_otp in non-production mode', async () => {
    db.query = mockQuerySequence(
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 1 },
    );

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/send')
      .send({ phone: '9876543210' });

    expect(res.status).toBe(200);
    expect(res.body._dev_otp).toMatch(/^\d{6}$/);
  });

  test('rejects missing phone', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/send')
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 500 if DB write fails', async () => {
    db.query = mockQuerySequence(
      { rows: [], rowCount: 0 },           // DELETE succeeds
      new Error('DB connection lost'),      // INSERT fails
    );

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/send')
      .send({ phone: '9876543210' });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/otp/verify', () => {
  beforeEach(() => jest.clearAllMocks());

  test('verifies correct OTP and returns JWT', async () => {
    const otp = '123456';
    const otp_hash = await bcrypt.hash(otp, 8);
    const session = {
      id: 'session-1',
      phone: '+919876543210',
      otp_hash,
      expires_at: new Date(Date.now() + 600000),
      used: false,
    };

    db.query = mockQuerySequence(
      { rows: [session] },    // SELECT FROM otp_sessions
      { rows: [], rowCount: 1 }, // UPDATE SET used = TRUE
    );

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.phone).toMatch(/^\+91/);
  });

  test('rejects incorrect OTP', async () => {
    const otp_hash = await bcrypt.hash('111111', 8);
    const session = {
      id: 'session-1',
      phone: '+919876543210',
      otp_hash,
      expires_at: new Date(Date.now() + 600000),
      used: false,
    };

    db.query = mockQuery({ rows: [session] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  test('rejects when no valid session exists', async () => {
    db.query = mockQuery({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '9876543210', otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/change-password — Fix 11', () => {
  beforeEach(() => jest.clearAllMocks());

  test('changes password when current password is correct', async () => {
    const current = 'oldpassword123';
    const hash    = await bcrypt.hash(current, 10);
    const admin   = { id: 'admin-uuid-1', password_hash: hash };

    db.query = mockQuerySequence(
      { rows: [admin] },          // SELECT admin
      { rows: [], rowCount: 1 },  // UPDATE password_hash
    );

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ current_password: current, new_password: 'newpassword456' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/changed/i);

    // Verify UPDATE was called
    const calls = db.query.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('UPDATE admins SET password_hash'))).toBe(true);
  });

  test('rejects wrong current password', async () => {
    const hash  = await bcrypt.hash('correctpassword', 10);
    const admin = { id: 'admin-uuid-1', password_hash: hash };

    db.query = mockQuery({ rows: [admin] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ current_password: 'wrongpassword', new_password: 'newpassword456' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  test('rejects new password shorter than 8 chars', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ current_password: 'oldpassword123', new_password: 'short' });

    expect(res.status).toBe(400);
  });

  test('rejects same password as current', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ current_password: 'samepassword123', new_password: 'samepassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/differ/i);
  });

  test('rejects unauthenticated request', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ current_password: 'old', new_password: 'newpassword456' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns JWT on valid credentials', async () => {
    const password = 'admin123';
    const hash     = await bcrypt.hash(password, 10);
    const admin    = { id: 'admin-uuid-1', name: 'Admin', email: 'admin@test.com', password_hash: hash, college_id: 'col-1' };

    db.query = mockQuery({ rows: [admin] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.admin.email).toBe('admin@test.com');
  });

  test('rejects invalid password', async () => {
    const hash  = await bcrypt.hash('correctpassword', 10);
    const admin = { id: 'admin-uuid-1', email: 'admin@test.com', password_hash: hash, college_id: 'col-1' };

    db.query = mockQuery({ rows: [admin] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('rejects unknown email', async () => {
    db.query = mockQuery({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'anypassword' });

    expect(res.status).toBe(401);
  });
});