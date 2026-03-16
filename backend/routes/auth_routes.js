const express = require("express");
const { body } = require("express-validator");
const { login, register, me, sendOtp, verifyOtp, changePassword } = require("../controllers/authController");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validate,
  login
);

// ✅ FIX BUG02: /register is admin-only at all times. Must supply a valid JWT.
router.post(
  "/register",
  auth,
  [
    body("college_id").notEmpty(),
    body("name").notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  validate,
  register
);

router.get("/me", auth, me);

// POST /api/auth/change-password  { current_password, new_password }
router.post(
  "/change-password",
  auth,
  [
    body("current_password").notEmpty().withMessage("Current password is required"),
    body("new_password").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
  ],
  validate,
  changePassword
);

// ── Student OTP login ─────────────────────────────────────────
// POST /api/auth/otp/send   { phone: "9876543210" }
router.post(
  "/otp/send",
  [body("phone").notEmpty().withMessage("Valid phone number required")],
  validate,
  sendOtp
);

// POST /api/auth/otp/verify  { phone: "9876543210", otp: "123456" }
router.post(
  "/otp/verify",
  [
    body("phone").isMobilePhone("any"),
    body("otp").isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  validate,
  verifyOtp
);

module.exports = router;