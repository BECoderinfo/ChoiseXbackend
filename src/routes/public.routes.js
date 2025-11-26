const express = require("express");
const Product = require("../models/product.model");
const Category = require("../models/category.model");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Helper function to build asset URL
function buildAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const baseUrl = process.env.API_BASE_URL || "http://localhost:5000";
  //https://choisex.com //http://localhost:5000
  return `${baseUrl}${path}`;
}


// Get all categories (public)
router.get("/categories", asyncHandler(async (req, res) => {
  const categories = await Category.find();
  res.json({ success: true, data: categories });
}));

// Get all products (public) - with optional category filter
router.get("/products", asyncHandler(async (req, res) => {
  const { category } = req.query;
  let query = {};
  
  if (category) {
    query.category = category;
  }
  
  const products = await Product.find(query)
    .populate("category", "name")
    .select("-__v");
  
  // Format products for web app
  const formattedProducts = products.map(product => ({
    id: product._id,
    SKU: product.sku,
    name: product.name,
    price: product.price.toString(),
    markprice: product.markprice.toString(),
    image: buildAssetUrl(product.mainImage),
    images: [product.mainImage, ...(product.galleryImages || [])].map(img => buildAssetUrl(img)),
    Availability: product.availability,
    Waterproof: product.waterproof,
    Rechargeable: product.rechargeable,
    Material: product.material,
    Feature: product.feature,
    description: product.description,
    customerrating: product.customerrating || [],
    category: product.category,
    createdAt: product.createdAt,
  }));
  
  res.json({ success: true, data: formattedProducts });
}));

// Get single product by ID (public)
router.get("/products/:id", asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name");
  
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  
  // Format product for web app
  const formattedProduct = {
    id: product._id,
    SKU: product.sku,
    name: product.name,
    price: product.price.toString(),
    markprice: product.markprice.toString(),
    image: buildAssetUrl(product.mainImage),
    images: [product.mainImage, ...(product.galleryImages || [])].map(img => buildAssetUrl(img)),
    Availability: product.availability,
    Waterproof: product.waterproof,
    Rechargeable: product.rechargeable,
    Material: product.material,
    Feature: product.feature,
    description: product.description,
    customerrating: product.customerrating || [],
    category: product.category,
    createdAt: product.createdAt
  };
  
  res.json({ success: true, data: formattedProduct });
}));

// Get products by category (public)
router.get("/categories/:categoryId/products", asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  
  const products = await Product.find({ category: categoryId })
    .populate("category", "name")
    .select("-__v");
  
  // Format products for web app
  const formattedProducts = products.map(product => ({
    id: product._id,
    SKU: product.sku,
    name: product.name,
    price: product.price.toString(),
    markprice: product.markprice.toString(),
    image: buildAssetUrl(product.mainImage),
    images: [product.mainImage, ...(product.galleryImages || [])].map(img => buildAssetUrl(img)),
    Availability: product.availability,
    Waterproof: product.waterproof,
    Rechargeable: product.rechargeable,
    Material: product.material,
    Feature: product.feature,
    description: product.description,
    customerrating: product.customerrating || [],
    category: product.category,
    createdAt: product.createdAt
  }));
  
  res.json({ success: true, data: formattedProducts });
}));

module.exports = router;

