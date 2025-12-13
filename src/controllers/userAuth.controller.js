const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendOTPEmail, sendWelcomeEmail } = require("../utils/emailService");
const { setAccessTokenCookie, setRefreshTokenCookie, clearAllAuthCookies } = require("../utils/cookieHelper");
const { generateTokenPair, verifyRefreshToken } = require("../utils/tokenHelper");

const OTP_EXPIRY_MINUTES = 5;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Signup - Create new user account
const signup = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User with this email already exists",
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim(),
    passwordHash,
  });

  // Generate token pair
  const payload = { sub: user._id.toString(), role: "user" };
  const { accessToken, refreshToken } = generateTokenPair(payload);

  // Store refresh token in database
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  user.refreshToken = refreshToken;
  user.refreshTokenExpiresAt = refreshTokenExpiresAt;
  await user.save();

  // Set HTTP-only cookies
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(user.email, user.name).catch(console.error);

  // Return user data (without password)
  res.status(201).json({
    success: true,
    message: "Account created successfully",
    accessToken,
    refreshToken,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

// Login - Authenticate user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  // Generate token pair
  const payload = { sub: user._id.toString(), role: "user" };
  const { accessToken, refreshToken } = generateTokenPair(payload);

  // Store refresh token in database
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  user.refreshToken = refreshToken;
  user.refreshTokenExpiresAt = refreshTokenExpiresAt;
  await user.save();

  // Set HTTP-only cookies
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);

  // Return user data
  res.json({
    success: true,
    message: "Login successful",
    accessToken,
    refreshToken,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

// Logout - Clear authentication cookies and refresh token
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.sub);
      if (user) {
        user.refreshToken = undefined;
        user.refreshTokenExpiresAt = undefined;
        await user.save();
      }
    } catch (error) {
      // Token might be invalid, but we still want to clear cookies
      console.error("Error clearing refresh token:", error);
    }
  }

  clearAllAuthCookies(res);

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// Get current user - Verify token and return user info
const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).select("-passwordHash -otpHash");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

// Update Profile - Allow users to update name & phone (email stays unchanged)
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, phone } = req.body || {};

  if (!name?.trim() && typeof phone === "undefined") {
    return res.status(400).json({
      success: false,
      message: "Nothing to update. Please provide name or phone.",
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (name?.trim()) {
    user.name = name.trim();
  }

  if (typeof phone !== "undefined") {
    user.phone = phone?.trim() || "";
  }

  await user.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

// Change Password - Validate old password before setting new one
const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current and new passwords are required",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters",
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: "Current password is incorrect",
    });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({
    success: true,
    message: "Password updated successfully",
  });
});

// Forgot Password - Send OTP to email
const sendForgotPasswordOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User with this email does not exist",
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Save OTP to user
  user.otpHash = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  // Send OTP via email
  try {
    await sendOTPEmail(user.email, otp);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again later.",
    });
  }

  res.json({
    success: true,
    message: "OTP sent to your email",
  });
});

// Verify OTP - Verify OTP and return reset token
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Check if OTP exists and is not expired
  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return res.status(400).json({
      success: false,
      message: "OTP has expired. Please request a new one.",
    });
  }

  // Verify OTP
  const isValid = await bcrypt.compare(otp, user.otpHash);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  // Clear OTP
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  // Generate reset token (short-lived, 15 minutes)
  const jwt = require("jsonwebtoken");
  const secret = requireEnv("JWT_SECRET");
  const resetToken = jwt.sign(
    { sub: user._id.toString(), action: "reset-password" },
    secret,
    { expiresIn: "15m" }
  );

  res.json({
    success: true,
    message: "OTP verified successfully",
    resetToken,
  });
});

// Reset Password - Reset password using reset token
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      success: false,
      message: "Token and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  // Verify reset token
  const secret = requireEnv("JWT_SECRET");
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        success: false,
        message: "Reset token has expired. Please request a new one.",
      });
    }
    return res.status(400).json({
      success: false,
      message: "Invalid reset token",
    });
  }

  if (payload.action !== "reset-password") {
    return res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }

  // Find user and update password
  const user = await User.findById(payload.sub);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();

  // Clear refresh token on password reset for security
  user.refreshToken = undefined;
  user.refreshTokenExpiresAt = undefined;
  await user.save();

  res.json({
    success: true,
    message: "Password reset successfully",
  });
});

// Refresh access token using refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Refresh token is required",
    });
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (decoded.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Invalid token for user access",
      });
    }

    // Find user and verify stored refresh token matches
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if refresh token matches and is not expired
    if (
      !user.refreshToken ||
      user.refreshToken !== refreshToken ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      // Clear invalid refresh token
      user.refreshToken = undefined;
      user.refreshTokenExpiresAt = undefined;
      await user.save();

      clearAllAuthCookies(res);

      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or expired. Please login again.",
      });
    }

    // Generate new access token
    const payload = { sub: user._id.toString(), role: "user" };
    const { generateAccessToken } = require("../utils/tokenHelper");
    const newAccessToken = generateAccessToken(payload);

    // Set new access token cookie
    setAccessTokenCookie(res, newAccessToken);

    res.json({
      success: true,
      accessToken: newAccessToken,
      message: "Access token refreshed successfully",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      // Clear expired refresh token from database
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.decode(refreshToken);
        if (decoded?.sub) {
          const user = await User.findById(decoded.sub);
          if (user) {
            user.refreshToken = undefined;
            user.refreshTokenExpiresAt = undefined;
            await user.save();
          }
        }
      } catch (err) {
        console.error("Error clearing expired refresh token:", err);
      }

      clearAllAuthCookies(res);

      return res.status(401).json({
        success: false,
        message: "Refresh token has expired. Please login again.",
      });
    }

    clearAllAuthCookies(res);

    return res.status(401).json({
      success: false,
      message: "Invalid refresh token. Please login again.",
    });
  }
});

module.exports = {
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
};


