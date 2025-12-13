const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const authenticate = asyncHandler(async (req, res, next) => {
  // Try to get access token from cookie first, then from Authorization header
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove "Bearer " prefix
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please provide a valid token.",
    });
  }

  try {
    const { verifyAccessToken } = require("../utils/tokenHelper");
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      role: decoded.role,
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

module.exports = authenticate;

