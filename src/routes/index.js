const express = require("express");
const categoryRoutes = require("./category.routes");
const productRoutes = require("./product.routes");
const authRoutes = require("./auth.routes");
const publicRoutes = require("./public.routes");
const userAuthRoutes = require("./userAuth.routes");
const cartRoutes = require("./cart.routes");
const orderRoutes = require("./order.routes");
const addressRoutes = require("./address.routes");


const router = express.Router();

// Public routes (no authentication required)
router.use("/public", publicRoutes);

// User authentication routes (public)
router.use("/user/auth", userAuthRoutes);

// Protected routes (authentication required)
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/auth", authRoutes); // Admin auth routes
router.use("/cart", cartRoutes); // User cart routes
router.use("/orders", orderRoutes); // User order routes
router.use("/addresses", addressRoutes); // User addresses


module.exports = router;

