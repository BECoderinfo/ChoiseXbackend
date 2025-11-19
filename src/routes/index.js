const express = require("express");
const categoryRoutes = require("./category.routes");
const productRoutes = require("./product.routes");
const authRoutes = require("./auth.routes");
const publicRoutes = require("./public.routes");
const userAuthRoutes = require("./userAuth.routes");


const router = express.Router();

// Public routes (no authentication required)
router.use("/public", publicRoutes);

// User authentication routes (public)
router.use("/user/auth", userAuthRoutes);

// Protected routes (authentication required)
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/auth", authRoutes); // Admin auth routes


module.exports = router;

