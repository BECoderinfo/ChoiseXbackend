const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const { getAllOrdersAdmin, refundOrderAdmin } = require("../controllers/order.controller");

// Admin-only orders routes
router.use(authenticate, (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
});

router.get("/", getAllOrdersAdmin);
router.post("/:orderId/refund", refundOrderAdmin);

module.exports = router;

