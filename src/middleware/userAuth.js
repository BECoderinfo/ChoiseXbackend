const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Middleware to authenticate users via HTTP-only cookies
const authenticateUser = asyncHandler(async (req, res, next) => {
  // Try to get access token from cookie first, then from Authorization header
  let token = req.cookies?.accessToken;

  // Fallback to old token cookie for backward compatibility
  if (!token) {
    token = req.cookies?.token;
  }

  // Fallback to Authorization header if cookie not found
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please login.",
    });
  }

  try {
    const { verifyAccessToken } = require("../utils/tokenHelper");
    const decoded = verifyAccessToken(token);

    // Check if token is for user (not admin)
    if (decoded.role && decoded.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access not allowed via this route.",
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.sub || decoded.userId,
      role: decoded.role || "user",
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      // If access token expired, suggest using refresh token
      return res.status(401).json({
        success: false,
        message: "Access token has expired. Please refresh your token.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
});

module.exports = authenticateUser;


