const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Address = require("../models/address.model");
const asyncHandler = require("../utils/asyncHandler");

// Helper function to build asset URL
function buildAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const baseUrl = process.env.API_BASE_URL || "http://localhost:5000";
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

// Create order
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { address, addressId, paymentMethod, deliveryNote } = req.body;

  let shippingAddress = null;

  if (addressId) {
    const savedAddress = await Address.findOne({ _id: addressId, user: userId });
    if (!savedAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }
    const { _id, user, ...rest } = savedAddress.toObject();
    shippingAddress = rest;
  } else if (address) {
    shippingAddress = address;
  } else {
    return res.status(400).json({
      success: false,
      message: "Shipping address is required",
    });
  }

  // Get user's cart
  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: { path: "category" },
  });

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Cart is empty. Please add items to cart first.",
    });
  }

  // Calculate total amount
  let totalAmount = 0;
  const orderItems = [];

  for (const cartItem of cart.items) {
    const product = cartItem.product;
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "One or more products not found",
      });
    }

    // Check availability
    if (cartItem.quantity > product.availability) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${product.name}. Only ${product.availability} available.`,
      });
    }

    const itemTotal = product.price * cartItem.quantity;
    totalAmount += itemTotal;

    orderItems.push({
      product: product._id,
      quantity: cartItem.quantity,
      price: product.price,
    });
  }

  // Generate unique order ID
  const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create order
  const order = await Order.create({
    user: userId,
    orderId,
    items: orderItems,
    address: shippingAddress,
    totalAmount,
    status: "Pending",
    paymentMethod: paymentMethod || "Cash on Delivery",
    deliveryNote: deliveryNote || "",
  });

  // Clear cart after order creation
  cart.items = [];
  await cart.save();

  // Populate order for response
  await order.populate({
    path: "items.product",
    populate: { path: "category" },
  });

  // Format order items for frontend
  const formattedItems = order.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
    price: item.price,
  }));

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: {
      _id: order._id,
      orderId: order.orderId,
      items: formattedItems,
      address: order.address,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      deliveryNote: order.deliveryNote,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

// Get user's orders
const getOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const orders = await Order.find({ user: userId })
    .populate({
      path: "items.product",
      populate: { path: "category" },
    })
    .sort({ createdAt: -1 });

  // Format orders for frontend
  const formattedOrders = orders.map((order) => {
    const formattedItems = order.items.map((item) => ({
      ...formatProduct(item.product),
      quantity: item.quantity,
      price: item.price,
    }));

    return {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems, // Keep 'cart' key for frontend compatibility
      address: order.address,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      deliveryNote: order.deliveryNote,
      date: order.createdAt.toLocaleString(),
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  });

  res.json({
    success: true,
    data: formattedOrders,
  });
});

// Get single order by ID
const getOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const filter = { user: userId };
  if (mongoose.Types.ObjectId.isValid(id)) {
    filter._id = id;
  } else {
    filter.orderId = id;
  }

  const order = await Order.findOne(filter).populate({
    path: "items.product",
    populate: { path: "category" },
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  // Format order items for frontend
  const formattedItems = order.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
    price: item.price,
  }));

  res.json({
    success: true,
    data: {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems, // Keep 'cart' key for frontend compatibility
      address: order.address,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      deliveryNote: order.deliveryNote,
      date: order.createdAt.toLocaleString(),
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

// Update order status (for confirming payment)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { status, paymentMethod, deliveryNote } = req.body;

  const order = await Order.findOne({ orderId, user: userId });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  // Update status
  if (status) {
    if (!["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    order.status = status;

    // Set timestamps based on status
    if (status === "Confirmed" && !order.confirmedAt) {
      order.confirmedAt = new Date();
    } else if (status === "Shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    } else if (status === "Delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
  }

  if (paymentMethod) {
    order.paymentMethod = paymentMethod;
  }

  if (deliveryNote !== undefined) {
    order.deliveryNote = deliveryNote;
  }

  await order.save();

  // Populate for response
  await order.populate({
    path: "items.product",
    populate: { path: "category" },
  });

  // Format order items for frontend
  const formattedItems = order.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
    price: item.price,
  }));

  res.json({
    success: true,
    message: "Order updated successfully",
    data: {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems,
      address: order.address,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      deliveryNote: order.deliveryNote,
      date: order.createdAt.toLocaleString(),
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
};

