const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Address = require("../models/address.model");
const User = require("../models/user.model");
const asyncHandler = require("../utils/asyncHandler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { sendOrderConfirmationEmail, sendShippingNotificationEmail, sendCancellationEmail, sendRefundConfirmationEmail } = require("../utils/emailService");

// Helper function to build asset URL
function buildAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const baseUrl = process.env.API_BASE_URL || "https://choisex.com"; //http://localhost:5000
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

// Helper to calculate totals from GST-inclusive prices
function calculateTotals(items) {
  // Total is already GST-inclusive (product prices are inclusive)
  const totalInclusive = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0
  );
  
  // Calculate base price (excluding GST): Total / 1.18
  const basePrice = Number((totalInclusive / 1.18).toFixed(2));
  
  // Calculate GST: Total - Base Price
  const gstAmount = Number((totalInclusive - basePrice).toFixed(2));
  
  return { 
    subTotal: basePrice,  // Base price (excluding GST) for display
    gstAmount,            // GST amount for display
    totalWithGst: totalInclusive  // Total (inclusive) - this is what we charge
  };
}

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay keys. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
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

  // Collect order items
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

    orderItems.push({
      product: product._id,
      quantity: cartItem.quantity,
      price: product.price,
    });
  }

  // Calculate totals with GST
  const { subTotal, gstAmount, totalWithGst } = calculateTotals(orderItems);

  // Generate unique order ID
  const orderId = `ORD_${Date.now()}`;

  // Create order
  const order = await Order.create({
    user: userId,
    orderId,
    items: orderItems,
    address: shippingAddress,
    totalAmount: totalWithGst, // store GST-inclusive total
    status: "Pending",
    paymentStatus: "Pending",
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

  // NOTE: We no longer send confirmation email here to avoid premature emails (e.g., Razorpay).
  // Emails are sent:
  // - After successful Razorpay verification (verifyRazorpayPayment)
  // - After COD confirmation via updateOrderStatus

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: {
      _id: order._id,
      orderId: order.orderId,
      items: formattedItems,
      address: order.address,
      subTotal: Number(subTotal.toFixed(2)),
      gstAmount,
      totalAmount: totalWithGst,
      status: order.status,
      paymentStatus: order.paymentStatus,
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

    const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

    return {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems, // Keep 'cart' key for frontend compatibility
      address: order.address,
      refundStatus: order.refundStatus,
      refundId: order.refundId,
      refundInitiatedAt: order.refundInitiatedAt,
      refundCompletedAt: order.refundCompletedAt,
      subTotal: Number(subTotal.toFixed(2)),
      gstAmount,
      totalAmount: totalWithGst,
      status: order.status,
      paymentStatus: order.paymentStatus,
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

// Admin: Get all orders
const getAllOrdersAdmin = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate({
      path: "items.product",
      populate: { path: "category" },
    })
    .populate("user", "name email") // include user for admin views
    .sort({ createdAt: -1 });

  const formattedOrders = orders.map((order) => {
    const formattedItems = order.items.map((item) => ({
      ...formatProduct(item.product),
      quantity: item.quantity,
      price: item.price,
    }));

    const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

    return {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems,
      address: order.address,
      user: order.user
        ? { id: order.user._id, name: order.user.name, email: order.user.email }
        : null,
      refundStatus: order.refundStatus,
      refundId: order.refundId,
      refundInitiatedAt: order.refundInitiatedAt,
      refundCompletedAt: order.refundCompletedAt,
      subTotal: Number(subTotal.toFixed(2)),
      gstAmount,
      totalAmount: totalWithGst,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      paymentHistory: order.paymentHistory,
      tracking: order.tracking || null, // Add tracking data
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

  const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

  res.json({
    success: true,
    data: {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems, // Keep 'cart' key for frontend compatibility
      address: order.address,
      refundStatus: order.refundStatus,
      refundId: order.refundId,
      refundInitiatedAt: order.refundInitiatedAt,
      refundCompletedAt: order.refundCompletedAt,
      subTotal: Number(subTotal.toFixed(2)),
      gstAmount,
      totalAmount: totalWithGst,
      status: order.status,
      paymentStatus: order.paymentStatus,
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

  // Populate for response and potential email
  await order.populate({
    path: "items.product",
    populate: { path: "category" },
  });
  await order.populate("user", "name email");

  // Format order items for frontend
  const formattedItems = order.items.map((item) => ({
    ...formatProduct(item.product),
    quantity: item.quantity,
    price: item.price,
  }));

  const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

  // If COD (or any non-Razorpay) is confirmed here, send confirmation email if not already sent
  if (
    order.paymentMethod !== "Razorpay" &&
    status === "Confirmed" &&
    order.user?.email &&
    !order.emailNotifications.orderConfirmationSent
  ) {
    try {
      const emailResult = await sendOrderConfirmationEmail(
        {
          orderId: order.orderId,
          items: formattedItems,
          address: order.address,
          subTotal: Number(subTotal.toFixed(2)),
          gstAmount,
          totalAmount: totalWithGst,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
        },
        {
          name: order.user.name,
          email: order.user.email,
        }
      );

      if (emailResult.success) {
        order.emailNotifications.orderConfirmationSent = true;
        order.emailNotifications.orderConfirmationSentAt = new Date();
        order.emailNotifications.orderConfirmationError = null;
      } else {
        order.emailNotifications.orderConfirmationError = emailResult.message;
      }
      await order.save();
    } catch (emailError) {
      console.error("Error sending COD order confirmation email:", emailError);
      order.emailNotifications.orderConfirmationError = emailError.message;
      await order.save();
    }
  }

  res.json({
    success: true,
    message: "Order updated successfully",
    data: {
      _id: order._id,
      orderId: order.orderId,
      cart: formattedItems,
      address: order.address,
      subTotal: Number(subTotal.toFixed(2)),
      gstAmount,
      totalAmount: totalWithGst,
      status: order.status,
      paymentStatus: order.paymentStatus,
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

// Create Razorpay order for an existing order
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId, user: userId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const amountInPaise = Math.round(Number(order.totalAmount) * 100);
  const currency = "INR";

  try {
    const razorpay = getRazorpayInstance();
    const rpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
        userId,
      },
    });

    order.razorpayOrderId = rpOrder.id;
    order.paymentMethod = "Razorpay";
    order.paymentStatus = "Pending";
    await order.save();

    return res.json({
      success: true,
      data: {
        razorpayOrderId: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
        orderId: order.orderId,
      },
    });
  } catch (err) {
    console.error("Razorpay order create error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
    });
  }
});

// Verify Razorpay payment and mark order paid
const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: "Missing Razorpay payment details" });
  }

  const order = await Order.findOne({ orderId, user: userId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    order.paymentStatus = "Failed";
    order.paymentHistory.push({
      status: "Failed",
      provider: "Razorpay",
      amount: order.totalAmount,
      txnId: razorpay_payment_id,
    });
    await order.save();
    return res.status(400).json({ success: false, message: "Invalid payment signature" });
  }

  order.paymentStatus = "Paid";
  order.status = order.status === "Pending" ? "Confirmed" : order.status;
  order.paymentMethod = "Razorpay";
  order.razorpayPaymentId = razorpay_payment_id;
  order.razorpaySignature = razorpay_signature;
  order.razorpayOrderId = razorpay_order_id;
  order.paymentHistory.push({
    status: "Paid",
    provider: "Razorpay",
    amount: order.totalAmount,
    txnId: razorpay_payment_id,
  });

  // Persist payment updates first
  await order.save();

  // Send order confirmation email after successful payment (if not already sent)
  try {
    // Reload order from database to ensure we have latest data
    const updatedOrder = await Order.findOne({ orderId, user: userId })
      .populate({
        path: "items.product",
        populate: { path: "category" },
      })
      .populate("user", "name email");

    if (!updatedOrder) {
      throw new Error("Order not found after payment verification");
    }

    const user = updatedOrder.user;
    if (user && user.email && !updatedOrder.emailNotifications.orderConfirmationSent) {
      // Format items
      const formattedItems = updatedOrder.items.map((item) => ({
        ...formatProduct(item.product),
        quantity: item.quantity,
        price: item.price,
      }));

      // Recompute totals for the email
      const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

      // Force "Razorpay" and "Paid" since payment was just verified successfully
      console.log(`[EMAIL] Sending order confirmation for ${updatedOrder.orderId} - Payment: Razorpay, Status: Paid`);
      const emailResult = await sendOrderConfirmationEmail(
        {
          orderId: updatedOrder.orderId,
          items: formattedItems,
          address: updatedOrder.address,
          subTotal: Number(subTotal.toFixed(2)),
          gstAmount,
          totalAmount: totalWithGst,
          paymentMethod: "Razorpay", // Always Razorpay since we're in payment verification
          paymentStatus: "Paid", // Always Paid since payment was verified
          createdAt: updatedOrder.createdAt,
        },
        {
          name: user.name,
          email: user.email,
        }
      );

      if (emailResult.success) {
        updatedOrder.emailNotifications.orderConfirmationSent = true;
        updatedOrder.emailNotifications.orderConfirmationSentAt = new Date();
        updatedOrder.emailNotifications.orderConfirmationError = null;
      } else {
        updatedOrder.emailNotifications.orderConfirmationError = emailResult.message;
      }
      await updatedOrder.save();
    }
  } catch (emailError) {
    console.error("Error sending post-payment order confirmation email:", emailError);
    // Reload order to update email error
    const orderForError = await Order.findOne({ orderId, user: userId });
    if (orderForError) {
      orderForError.emailNotifications.orderConfirmationError = emailError.message;
      await orderForError.save();
    }
  }

  return res.json({
    success: true,
    message: "Payment verified successfully",
    data: {
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      status: order.status,
      paymentMethod: order.paymentMethod,
      razorpayPaymentId: order.razorpayPaymentId,
    },
  });
});

// Explicit payment failure/cancel (called from frontend when Razorpay is closed/failed)
const markPaymentFailed = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { reason, razorpay_order_id, razorpay_payment_id } = req.body || {};

  const order = await Order.findOne({ orderId, user: userId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // If payment already completed, skip
  if (order.paymentStatus === "Paid") {
    return res.json({
      success: true,
      message: "Payment already completed",
      data: { paymentStatus: order.paymentStatus, status: order.status },
    });
  }

  // Avoid duplicate failure records (e.g., both modal close and payment.failed)
  const incomingTxnId = razorpay_payment_id || razorpay_order_id || null;
  const alreadyFailed =
    order.paymentStatus === "Failed" ||
    order.status === "Cancelled";
  const duplicateTxn =
    incomingTxnId &&
    order.paymentHistory?.some((p) => p.txnId === incomingTxnId && p.status === "Failed");

  if (alreadyFailed && duplicateTxn) {
    return res.json({
      success: true,
      message: "Payment already marked failed",
      data: {
        paymentStatus: order.paymentStatus,
        status: order.status,
      },
    });
  }

  order.paymentStatus = "Failed";
  order.status = "Cancelled";
  order.paymentMethod = "Razorpay";
  order.refundStatus = "NotApplicable";
  order.paymentHistory.push({
    status: "Failed",
    provider: "Razorpay",
    amount: order.totalAmount,
    txnId: incomingTxnId || `rp-fail-${Date.now()}`,
    createdAt: new Date(),
    reason: reason || "Payment cancelled/failed",
  });

  await order.save();

  // Email: we do not treat this as a paid order, so only a cancellation/failure notice is relevant
  try {
    await order.populate({
      path: "items.product",
      populate: { path: "category" },
    });
    await order.populate("user", "name email");

    const formattedItems = order.items.map((item) => ({
      ...formatProduct(item.product),
      quantity: item.quantity,
      price: item.price,
    }));
    const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

    if (order.user?.email) {
      await sendCancellationEmail(
        {
          orderId: order.orderId,
          items: formattedItems,
          address: order.address,
          subTotal: Number(subTotal.toFixed(2)),
          gstAmount,
          totalAmount: totalWithGst,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          refundStatus: order.refundStatus,
          createdAt: order.createdAt,
          reason: "Payment failed / cancelled",
        },
        {
          name: order.user.name,
          email: order.user.email,
        }
      );
    }
  } catch (emailErr) {
    console.error("Payment failure email error:", emailErr);
  }

  return res.json({
    success: true,
    message: "Order marked as payment failed and cancelled",
    data: {
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      refundStatus: order.refundStatus,
    },
  });
});

// User: cancel order (only before tracking/shipping; status must be Order Confirmed)
const cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId, user: userId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Only allow if status is Confirmed and no tracking details exist
  const hasTracking =
    order.tracking &&
    (order.tracking.referenceNumber ||
      order.tracking.estimateDate ||
      order.tracking.courierPartner ||
      order.tracking.trackingLink);

  if (order.status !== "Confirmed" || hasTracking) {
    return res
      .status(400)
      .json({ success: false, message: "Order cannot be cancelled at this stage." });
  }

  order.status = "Cancelled";

  // Set refund status for prepaid orders
  if (order.paymentMethod === "Razorpay" && order.paymentStatus === "Paid") {
    order.refundStatus = "Pending";
  } else {
    order.refundStatus = "NotApplicable";
  }

  await order.save();

  // Send cancellation email (non-blocking)
  try {
    await order.populate({
      path: "items.product",
      populate: { path: "category" },
    });
    await order.populate("user", "name email");

    const user = order.user;
    if (user && user.email) {
      const formattedItems = order.items.map((item) => ({
        ...formatProduct(item.product),
        quantity: item.quantity,
        price: item.price,
      }));
      const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

      await sendCancellationEmail(
        {
          orderId: order.orderId,
          items: formattedItems,
          address: order.address,
          subTotal: Number(subTotal.toFixed(2)),
          gstAmount,
          totalAmount: totalWithGst,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          refundStatus: order.refundStatus,
          createdAt: order.createdAt,
        },
        {
          name: user.name,
          email: user.email,
        }
      );
    }
  } catch (emailErr) {
    console.error("Cancellation email error:", emailErr);
  }

  res.json({
    success: true,
    message: "Order cancelled successfully",
    data: {
      orderId: order.orderId,
      status: order.status,
      refundStatus: order.refundStatus,
    },
  });
});

// Admin: update tracking info
const updateTracking = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  const { orderId } = req.params;
  const { referenceNumber, estimateDate, courierPartner, trackingLink, status } = req.body || {};

  if (!referenceNumber || !estimateDate || !courierPartner || !trackingLink || !status) {
    return res.status(400).json({ success: false, message: "All tracking fields are required" });
  }

  if (!["Order Confirmed", "Picked by Courier", "On the Way", "Ready for Pickup", "Delivered"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status value" });
  }

  const order = await Order.findOne({ orderId });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  order.tracking = {
    referenceNumber,
    estimateDate,
    courierPartner,
    trackingLink,
    status,
    updatedAt: new Date(),
  };

  // Sync order.status based on tracking.status
  if (status === "Order Confirmed") {
    order.status = order.status === "Pending" ? "Pending" : "Confirmed";
  } else if (status === "Picked by Courier") {
    order.status = "Shipped";
  } else if (status === "Delivered") {
    order.status = "Delivered";
    order.deliveredAt = new Date();
  }

  await order.save();

  // Send shipping notification email (non-blocking, don't fail tracking update if email fails)
  try {
    // Populate order items and user for email
    await order.populate({
      path: "items.product",
      populate: { path: "category" },
    });
    await order.populate("user", "name email");

    const user = order.user;
    if (user && user.email && !order.emailNotifications.shippingNotificationSent) {
      // Format order items for email
      const formattedItems = order.items.map((item) => ({
        ...formatProduct(item.product),
        quantity: item.quantity,
        price: item.price,
      }));

      const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);

      const emailResult = await sendShippingNotificationEmail(
        {
          orderId: order.orderId,
          items: formattedItems,
          address: order.address,
          totalAmount: totalWithGst,
        },
        {
          referenceNumber,
          estimateDate,
          courierPartner,
          trackingLink,
          status,
        },
        {
          name: user.name,
          email: user.email,
        }
      );

      // Update email notification status
      if (emailResult.success) {
        order.emailNotifications.shippingNotificationSent = true;
        order.emailNotifications.shippingNotificationSentAt = new Date();
      } else {
        order.emailNotifications.shippingNotificationError = emailResult.message;
      }
      await order.save();
    }
  } catch (emailError) {
    // Log error but don't fail the tracking update
    console.error("Error sending shipping notification email:", emailError);
    order.emailNotifications.shippingNotificationError = emailError.message;
    await order.save();
  }

  res.json({ success: true, message: "Tracking updated", data: order.tracking });
});

// Admin: issue refund for Razorpay orders
const refundOrderAdmin = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  const { orderId } = req.params;
  const order = await Order.findOne({ orderId }).populate("user", "name email");

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (order.paymentMethod !== "Razorpay" || order.paymentStatus !== "Paid") {
    return res
      .status(400)
      .json({ success: false, message: "Refund not applicable for this order" });
  }

  if (order.status !== "Cancelled") {
    return res
      .status(400)
      .json({ success: false, message: "Order must be cancelled before refund" });
  }

  // If already refunded
  if (order.refundStatus === "Refunded") {
    return res.json({
      success: true,
      message: "Order already refunded",
      data: {
        refundStatus: order.refundStatus,
        refundId: order.refundId,
        refundCompletedAt: order.refundCompletedAt,
      },
    });
  }

  if (!order.razorpayPaymentId) {
    return res.status(400).json({ success: false, message: "Payment ID not found for refund" });
  }

  try {
    const razorpay = getRazorpayInstance();
    const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: Math.round(Number(order.totalAmount) * 100),
      speed: "normal",
    });

    order.refundStatus = "Refunded";
    order.refundId = refund.id;
    order.refundInitiatedAt = new Date();
    order.refundCompletedAt = new Date();

    // Record in payment history
    order.paymentHistory.push({
      status: "Refunded",
      provider: "Razorpay",
      amount: -Number(order.totalAmount),
      txnId: refund.id,
    });

    await order.save();

    // Send refund confirmation email (non-blocking)
    try {
      await order.populate({
        path: "items.product",
        populate: { path: "category" },
      });
      const formattedItems = order.items.map((item) => ({
        ...formatProduct(item.product),
        quantity: item.quantity,
        price: item.price,
      }));
      const { subTotal, gstAmount, totalWithGst } = calculateTotals(formattedItems);
      if (order.user?.email) {
        await sendRefundConfirmationEmail(
          {
            orderId: order.orderId,
            items: formattedItems,
            address: order.address,
            subTotal: Number(subTotal.toFixed(2)),
            gstAmount,
            totalAmount: totalWithGst,
            refundId: order.refundId,
            refundCompletedAt: order.refundCompletedAt,
          },
          { name: order.user.name, email: order.user.email }
        );
      }
    } catch (emailErr) {
      console.error("Refund email error:", emailErr);
    }

    return res.json({
      success: true,
      message: "Refund issued successfully",
      data: {
        refundStatus: order.refundStatus,
        refundId: order.refundId,
        refundCompletedAt: order.refundCompletedAt,
      },
    });
  } catch (err) {
    console.error("Razorpay refund error:", err);
    order.refundStatus = "Failed";
    await order.save();
    return res.status(500).json({ success: false, message: "Refund failed. Try again later." });
  }
});

// Public: get tracking info
const getTracking = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findOne({ orderId }).select("orderId tracking");
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  res.json({ success: true, data: order.tracking || null });
});

module.exports = {
  createOrder,
  getOrders,
  getAllOrdersAdmin,
  getOrder,
  updateOrderStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
  markPaymentFailed,
  updateTracking,
  getTracking,
  cancelOrder,
  refundOrderAdmin,
};

