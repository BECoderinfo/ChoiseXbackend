const express = require("express");
const {
  loginAdmin,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot-password/reset", resetPassword);

module.exports = router;


