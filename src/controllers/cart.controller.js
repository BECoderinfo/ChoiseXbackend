const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const asyncHandler = require("../utils/asyncHandler");

// Helper function to build asset URL
function buildAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const baseUrl = process.env.API_BASE_URL || "https://choisex.com";
  return `${baseUrl}${path}`;
}

// Helper function to format product for frontend
function formatProduct(product) {
  if (!product) return null;
  return {
    id: product._id || product.id,
    SKU: product.sku || product.SKU,
    name: product.name,
    price: product.price?.toString() || product.price,
    markprice: product.markprice?.toString() || product.markprice,
    image: buildAssetUrl(product.mainImage || product.image),
    images: [
      product.mainImage || product.image,
      ...(product.galleryImages || []),
    ].map((img) => buildAssetUrl(img)),
    Availability: product.availability || product.Availability,
    Waterproof: product.waterproof || product.Waterproof,
    Rechargeable: product.rechargeable || product.Rechargeable,
    Material: product.material || product.Material,
    Feature: product.feature || product.Feature,
    description: product.description,
    customerrating: product.customerrating || [],
    category: product.category,
    createdAt: product.createdAt,
  };
}

// Get user's cart
const getCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: { path: "category" },
  });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  // Format cart items for frontend
  const formattedItems = cart.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
  }));

  res.json({
    success: true,
    data: {
      items: formattedItems,
      _id: cart._id,
      user: cart.user,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    },
  });
});

// Add item to cart
const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity < 1) {
    return res.status(400).json({
      success: false,
      message: "Product ID and quantity (min 1) are required",
    });
  }

  // Verify product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  // Get or create cart
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  // Check if product already in cart
  const existingItemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (existingItemIndex !== -1) {
    // Update quantity
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;
    
    // Check availability
    if (newQuantity > product.availability) {
      return res.status(400).json({
        success: false,
        message: `Max stock limit reached. Only ${product.availability} available.`,
      });
    }

    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    // Check availability
    if (quantity > product.availability) {
      return res.status(400).json({
        success: false,
        message: `Max stock limit reached. Only ${product.availability} available.`,
      });
    }

    // Add new item
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();

  // Populate product details
  await cart.populate({
    path: "items.product",
    populate: { path: "category" },
  });

  // Format cart items for frontend
  const formattedItems = cart.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
  }));

  res.json({
    success: true,
    message: "Product added to cart",
    data: {
      items: formattedItems,
      _id: cart._id,
      user: cart.user,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    },
  });
});

// Update cart item quantity
const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity < 1) {
    return res.status(400).json({
      success: false,
      message: "Product ID and quantity (min 1) are required",
    });
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Product not found in cart",
    });
  }

  // Verify product availability
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  if (quantity > product.availability) {
    return res.status(400).json({
      success: false,
      message: `Max stock limit reached. Only ${product.availability} available.`,
    });
  }

  cart.items[itemIndex].quantity = quantity;
  await cart.save();

  await cart.populate({
    path: "items.product",
    populate: { path: "category" },
  });

  // Format cart items for frontend
  const formattedItems = cart.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
  }));

  res.json({
    success: true,
    message: "Cart item updated",
    data: {
      items: formattedItems,
      _id: cart._id,
      user: cart.user,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    },
  });
});

// Remove item from cart
const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId
  );

  await cart.save();

  await cart.populate({
    path: "items.product",
    populate: { path: "category" },
  });

  // Format cart items for frontend
  const formattedItems = cart.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
  }));

  res.json({
    success: true,
    message: "Product removed from cart",
    data: {
      items: formattedItems,
      _id: cart._id,
      user: cart.user,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    },
  });
});

// Clear cart
const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  cart.items = [];
  await cart.save();

  res.json({
    success: true,
    message: "Cart cleared successfully",
    data: {
      items: [],
      _id: cart._id,
      user: cart.user,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    },
  });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};

