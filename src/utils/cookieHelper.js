// Helper functions for setting and clearing HTTP-only cookies

function setTokenCookie(res, token, cookieName = "token", maxAge = 7 * 24 * 60 * 60 * 1000) {
  const isProduction = process.env.NODE_ENV === "production";
  
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: isProduction ? "strict" : "lax", // CSRF protection
    maxAge: maxAge,
    path: "/",
  });
}

function setAccessTokenCookie(res, token) {
  // Access token: 2 hours
  const maxAge = 2 * 60 * 60 * 1000;
  setTokenCookie(res, token, "accessToken", maxAge);
}

function setRefreshTokenCookie(res, token) {
  // Refresh token: 30 days
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  setTokenCookie(res, token, "refreshToken", maxAge);
}

function clearTokenCookie(res, cookieName = "token") {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  });
}

function clearAllAuthCookies(res) {
  clearTokenCookie(res, "accessToken");
  clearTokenCookie(res, "refreshToken");
  // Clear old token cookie for backward compatibility
  clearTokenCookie(res, "token");
}

module.exports = {
  setTokenCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearTokenCookie,
  clearAllAuthCookies,
};


