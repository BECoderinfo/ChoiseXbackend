const express = require("express");
const Product = require("../models/product.model");
const Category = require("../models/category.model");
const Subcategory = require("../models/subcategory.model");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Helper function to build asset URL
function buildAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const baseUrl = process.env.API_BASE_URL || "https://choisex.com"; //http://localhost:5000
  return `${baseUrl}${path}`;
}


// Get all categories (public)
router.get("/categories", asyncHandler(async (req, res) => {
  const categories = await Category.find();
  res.json({ success: true, data: categories });
}));

// Get all subcategories (public)
router.get("/subcategories", asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};
  const subcategories = await Subcategory.find(filter).populate("category", "name");
  const formatted = subcategories.map((subcat) => ({
    _id: subcat._id,
    name: subcat.name,
    sku: subcat.sku,
    image: buildAssetUrl(subcat.image),
    category: subcat.category,
    createdAt: subcat.createdAt,
  }));
  res.json({ success: true, data: formatted });
}));

// Get all products (public) - with optional category filter
router.get("/products", asyncHandler(async (req, res) => {
  const { category, subcategory } = req.query;
  const query = {};
  
  if (category) {
    query.category = category;
  }

  if (subcategory) {
    query.subcategory = subcategory;
  }
  
  const products = await Product.find(query)
    .populate("category", "name")
    .populate("subcategory", "name image category")
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
    subcategory: product.subcategory
      ? { ...product.subcategory.toObject?.() || product.subcategory, image: buildAssetUrl(product.subcategory.image) }
      : null,
    createdAt: product.createdAt,
  }));
  
  res.json({ success: true, data: formattedProducts });
}));

// Get single product by ID (public)
router.get("/products/:id", asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name")
    .populate("subcategory", "name image category");
  
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
    subcategory: product.subcategory
      ? { ...product.subcategory.toObject?.() || product.subcategory, image: buildAssetUrl(product.subcategory.image) }
      : null,
    createdAt: product.createdAt
  };
  
  res.json({ success: true, data: formattedProduct });
}));

// Get products by category (public)
router.get("/categories/:categoryId/products", asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  
  const products = await Product.find({ category: categoryId })
    .populate("category", "name")
    .populate("subcategory", "name image category")
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
    subcategory: product.subcategory
      ? { ...product.subcategory.toObject?.() || product.subcategory, image: buildAssetUrl(product.subcategory.image) }
      : null,
    createdAt: product.createdAt
  }));
  
  res.json({ success: true, data: formattedProducts });
}));

// Get products by subcategory (public)
router.get("/subcategories/:subcategoryId/products", asyncHandler(async (req, res) => {
  const { subcategoryId } = req.params;
  
  const products = await Product.find({ subcategory: subcategoryId })
    .populate("category", "name")
    .populate("subcategory", "name image category")
    .select("-__v");

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
    subcategory: product.subcategory
      ? { ...product.subcategory.toObject?.() || product.subcategory, image: buildAssetUrl(product.subcategory.image) }
      : null,
    createdAt: product.createdAt
  }));

  res.json({ success: true, data: formattedProducts });
}));

module.exports = router;

