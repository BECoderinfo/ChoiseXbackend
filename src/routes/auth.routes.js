const express = require("express");
const {
  loginAdmin,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  refreshAccessToken,
  logoutAdmin,
} = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", authenticate, logoutAdmin);
router.post("/forgot-password/send-otp", sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot-password/reset", resetPassword);

module.exports = router;


