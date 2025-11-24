const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendOTPEmail } = require("../utils/emailService");

const OTP_EXPIRY_MINUTES = 5;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function ensureAdminSeeded() {
  let admin = await Admin.findOne();

  if (!admin) {
    const email = requireEnv("ADMIN_EMAIL");
    const password = requireEnv("ADMIN_PASSWORD");
    const passwordHash = await bcrypt.hash(password, 12);

    admin = await Admin.create({ email: email.toLowerCase(), passwordHash });
    return admin;
  }

  const envEmail = process.env.ADMIN_EMAIL;
  if (envEmail && admin.email !== envEmail.toLowerCase()) {
    admin.email = envEmail.toLowerCase();
    await admin.save();
  }

  return admin;
}

function signToken(payload, expiresIn = "12h") {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn });
}

const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const admin = await ensureAdminSeeded();

  if (admin.email !== email.toLowerCase()) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = signToken({ sub: admin._id, role: "admin" });
  res.json({ success: true, token });
});

const sendForgotPasswordOtp = asyncHandler(async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const admin = await ensureAdminSeeded();

  if (admin.email !== email.toLowerCase()) {
    return res.status(404).json({ success: false, message: "Admin not found" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  admin.otpHash = otpHash;
  admin.otpExpiresAt = otpExpiresAt;
  await admin.save();

  // Send OTP via email
  try {
    await sendOTPEmail(admin.email, otp);
    res.json({ success: true, message: "OTP sent to your email successfully" });
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP email. Please try again later.",
    });
  }
});

const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });
  }

  const admin = await ensureAdminSeeded();

  if (admin.email !== email.toLowerCase()) {
    return res.status(404).json({ success: false, message: "Admin not found" });
  }

  if (!admin.otpHash || !admin.otpExpiresAt || admin.otpExpiresAt < new Date()) {
    return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
  }

  const isValid = await bcrypt.compare(otp, admin.otpHash);
  if (!isValid) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  admin.otpHash = undefined;
  admin.otpExpiresAt = undefined;
  await admin.save();

  const resetToken = signToken({ sub: admin._id, action: "reset-password" }, "15m");

  res.json({ success: true, resetToken });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ success: false, message: "Token and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }

  const secret = requireEnv("JWT_SECRET");
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid or expired token" });
  }

  if (payload.action !== "reset-password") {
    return res.status(400).json({ success: false, message: "Invalid token" });
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin) {
    return res.status(404).json({ success: false, message: "Admin not found" });
  }

  admin.passwordHash = await bcrypt.hash(password, 12);
  await admin.save();

  res.json({ success: true, message: "Password updated successfully" });
});

module.exports = {
  loginAdmin,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
};


