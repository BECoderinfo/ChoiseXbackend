const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const { updateTracking, getTracking } = require("../controllers/order.controller");

// Admin update tracking
router.post("/update-tracking/:orderId", authenticate, (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}, updateTracking);

// Public get tracking (no auth needed)
router.get("/get-tracking/:orderId", getTracking);

module.exports = router;

