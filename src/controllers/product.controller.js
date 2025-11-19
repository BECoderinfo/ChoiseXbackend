const Product = require("../models/product.model");
const asyncHandler = require("../utils/asyncHandler");

const MAX_GALLERY_IMAGES = 4;

function buildFilePath(file) {
  if (!file) return null;
  return `/uploads/${file.filename}`;
}

function parseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeReviews(value) {
  const parsed = parseJSON(value, []);
  return parsed.map((item) => ({
    star: Number(item.star) || 5,
    review: item.Review || item.review || "",
    username: item.username || "",
    userimage: item.userimage || item.userImage || "",
  }));
}

const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    SKU,
    price,
    markprice,
    category,
    Availability,
    Material,
    Feature,
    Waterproof,
    Rechargeable,
    description,
    customerrating,
  } = req.body;

  const mainImageFile = req.files?.mainImage?.[0];
  const galleryFiles = req.files?.gallery || [];

  if (!mainImageFile) {
    return res.status(400).json({ success: false, message: "Main image is required" });
  }

  if (galleryFiles.length > MAX_GALLERY_IMAGES) {
    return res.status(400).json({
      success: false,
      message: `You can upload at most ${MAX_GALLERY_IMAGES} gallery images`,
    });
  }

  // Check if SKU already exists
  const existingProduct = await Product.findOne({ sku: SKU?.trim() });
  if (existingProduct) {
    return res.status(400).json({
      success: false,
      message: `SKU "${SKU}" already exists. Please use a different SKU.`,
    });
  }

  const product = await Product.create({
    name,
    sku: SKU,
    price: Number(price),
    markprice: Number(markprice),
    category,
    availability: Number(Availability),
    material: Material,
    feature: Feature,
    waterproof: Waterproof,
    rechargeable: Rechargeable,
    description,
    mainImage: buildFilePath(mainImageFile),
    galleryImages: galleryFiles.map(buildFilePath),
    customerrating: normalizeReviews(customerrating),
  });

  res.status(201).json({ success: true, data: product });
});

const getProducts = asyncHandler(async (req, res) => {
  const { category } = req.query;
  let query = {};
  
  if (category) {
    query.category = category;
  }
  
  const products = await Product.find(query).populate("category");
  res.json({ success: true, data: products });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category");
 
  
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  res.json({ success: true, data: product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    SKU,
    price,
    markprice,
    category,
    Availability,
    Material,
    Feature,
    Waterproof,
    Rechargeable,
    description,
    customerrating,
    existingMainImage,
    existingGallery = "[]",
  } = req.body;

  const mainImageFile = req.files?.mainImage?.[0];
  const galleryFiles = req.files?.gallery || [];
  const existingGalleryArr = parseJSON(existingGallery, []);

  if (existingGalleryArr.length > MAX_GALLERY_IMAGES) {
    return res.status(400).json({
      success: false,
      message: `Gallery cannot exceed ${MAX_GALLERY_IMAGES} images`,
    });
  }

  if (existingGalleryArr.length + galleryFiles.length > MAX_GALLERY_IMAGES) {
    return res.status(400).json({
      success: false,
      message: `Gallery cannot exceed ${MAX_GALLERY_IMAGES} images`,
    });
  }

  // Check if SKU already exists (excluding current product)
  const existingProduct = await Product.findOne({ sku: SKU?.trim(), _id: { $ne: id } });
  if (existingProduct) {
    return res.status(400).json({
      success: false,
      message: `SKU "${SKU}" already exists. Please use a different SKU.`,
    });
  }

  const payload = {
    name,
    sku: SKU,
    price: Number(price),
    markprice: Number(markprice),
    category,
    availability: Number(Availability),
    material: Material,
    feature: Feature,
    waterproof: Waterproof,
    rechargeable: Rechargeable,
    description,
    customerrating: normalizeReviews(customerrating),
  };

  if (mainImageFile) {
    payload.mainImage = buildFilePath(mainImageFile);
  } else if (existingMainImage) {
    payload.mainImage = existingMainImage;
  }

  const combinedGallery = [...existingGalleryArr, ...galleryFiles.map(buildFilePath)];
  payload.galleryImages = combinedGallery;

  const updated = await Product.findByIdAndUpdate(id, payload, { new: true, runValidators: true });

  if (!updated) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  res.json({ success: true, data: updated });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);

  if (!deleted) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  res.json({ success: true, message: "Product deleted" });
});

module.exports = { createProduct, getProducts, getProduct, updateProduct, deleteProduct };

