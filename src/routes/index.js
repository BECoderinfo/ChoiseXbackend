const express = require("express");
const categoryRoutes = require("./category.routes");
const subcategoryRoutes = require("./subcategory.routes");
const productRoutes = require("./product.routes");
const authRoutes = require("./auth.routes");
const publicRoutes = require("./public.routes");
const userAuthRoutes = require("./userAuth.routes");
const cartRoutes = require("./cart.routes");
const orderRoutes = require("./order.routes");
const addressRoutes = require("./address.routes");
const adminOrderRoutes = require("./adminOrder.routes");
const adminUserRoutes = require("./adminUser.routes");
const orderTrackingRoutes = require("./orderTracking.routes");


const router = express.Router();

// Public routes (no authentication required)
router.use("/public", publicRoutes);

// User authentication routes (public)
router.use("/user/auth", userAuthRoutes);

// Protected routes (authentication required)
router.use("/categories", categoryRoutes);
router.use("/subcategories", subcategoryRoutes);
router.use("/products", productRoutes);
router.use("/auth", authRoutes); // Admin auth routes
router.use("/cart", cartRoutes); // User cart routes
router.use("/orders", orderRoutes); // User order routes
router.use("/addresses", addressRoutes); // User addresses
router.use("/admin/orders", adminOrderRoutes); // Admin order management
router.use("/admin/users", adminUserRoutes); // Admin users summary
router.use("/order", orderTrackingRoutes); // Tracking routes


module.exports = router;

