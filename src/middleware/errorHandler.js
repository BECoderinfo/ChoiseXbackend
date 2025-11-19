function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}

module.exports = errorHandler;

