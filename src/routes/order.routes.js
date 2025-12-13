const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/userAuth");
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
  cancelOrder,
} = require("../controllers/order.controller");

// All order routes require user authentication
router.use(authenticateUser);

router.post("/create", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrder);
router.put("/:orderId/status", updateOrderStatus);
router.post("/:orderId/razorpay/create", createRazorpayOrder);
router.post("/:orderId/razorpay/verify", verifyRazorpayPayment);
router.post("/:orderId/cancel", cancelOrder);

module.exports = router;

