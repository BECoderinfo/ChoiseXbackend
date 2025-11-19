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
  // Try to get token from cookie first
  let token = req.cookies?.token;

  // Fallback to Authorization header if cookie not found (for backward compatibility)
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
    const secret = requireEnv("JWT_SECRET");
    const decoded = jwt.verify(token, secret);

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
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
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


