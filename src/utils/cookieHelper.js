// Helper functions for setting and clearing HTTP-only cookies

function setTokenCookie(res, token, maxAge = 7 * 24 * 60 * 60 * 1000) {
  // 7 days default
  const isProduction = process.env.NODE_ENV === "production";
  
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: isProduction ? "strict" : "lax", // CSRF protection
    maxAge: maxAge,
    path: "/",
  });
}

function clearTokenCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
}

module.exports = {
  setTokenCookie,
  clearTokenCookie,
};


