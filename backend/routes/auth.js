const express = require("express");
const { body } = require("express-validator");
const { login, register, me } = require("../controllers/authController");
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

router.post(
  "/register",
  [
    body("college_id").notEmpty(),
    body("name").notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  validate,
  (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Registration disabled in production" });
    }
    next();
  },
  register
);

router.get("/me", auth, me);

module.exports = router;
