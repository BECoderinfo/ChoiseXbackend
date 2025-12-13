const express = require("express");
const {
  signup,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  sendForgotPasswordOTP,
  verifyOTP,
  resetPassword,
  refreshAccessToken,
} = require("../controllers/userAuth.controller");
const authenticateUser = require("../middleware/userAuth");

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password/send-otp", sendForgotPasswordOTP);
router.post("/forgot-password/verify-otp", verifyOTP);
router.post("/forgot-password/reset", resetPassword);

// Protected routes (require authentication)
router.post("/logout", authenticateUser, logout);
router.get("/me", authenticateUser, getCurrentUser);
router.put("/profile", authenticateUser, updateProfile);
router.post("/change-password", authenticateUser, changePassword);

module.exports = router;


