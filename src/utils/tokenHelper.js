const jwt = require("jsonwebtoken");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Generate access token (2 hours validity)
 */
function generateAccessToken(payload) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "2h" });
}

/**
 * Generate refresh token (30 days validity)
 */
function generateRefreshToken(payload) {
  const secret = requireEnv("JWT_REFRESH_SECRET") || requireEnv("JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.verify(token, secret);
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  const secret = requireEnv("JWT_REFRESH_SECRET") || requireEnv("JWT_SECRET");
  return jwt.verify(token, secret);
}

/**
 * Generate both access and refresh tokens
 */
function generateTokenPair(payload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
};

