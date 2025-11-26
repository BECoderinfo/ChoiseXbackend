const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/userAuth");
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
} = require("../controllers/order.controller");

// All order routes require user authentication
router.use(authenticateUser);

router.post("/create", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrder);
router.put("/:orderId/status", updateOrderStatus);

module.exports = router;

