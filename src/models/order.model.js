const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    area: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postal: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    items: [orderItemSchema],
    address: {
      type: addressSchema,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash on Delivery","Razorpay",],
      default: "Cash on Delivery",
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paymentHistory: [
      {
        status: { type: String },
        provider: { type: String },
        amount: { type: Number },
        currency: { type: String, default: "INR" },
        txnId: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    deliveryNote: {
      type: String,
      default: "",
    },
    confirmedAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    tracking: {
      referenceNumber: { type: String, default: "" },
      estimateDate: { type: Date },
      courierPartner: { type: String, default: "" },
      trackingLink: { type: String, default: "" },
      status: {
        type: String,
        enum: ["Order Confirmed", "Picked by Courier", "On the Way", "Ready for Pickup", "Delivered"],
        default: "Order Confirmed",
      },
      updatedAt: { type: Date },
    },
    // Email notification tracking
    emailNotifications: {
      orderConfirmationSent: { type: Boolean, default: false },
      orderConfirmationSentAt: { type: Date },
      orderConfirmationError: { type: String },
      shippingNotificationSent: { type: Boolean, default: false },
      shippingNotificationSentAt: { type: Date },
      shippingNotificationError: { type: String },
    },
    // Refund tracking (for prepaid orders)
    refundStatus: {
      type: String,
      enum: ["NotApplicable", "Pending", "Refunded", "Failed"],
      default: "NotApplicable",
    },
    refundId: { type: String, default: "" },
    refundInitiatedAt: { type: Date },
    refundCompletedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for faster queries
orderSchema.index({ user: 1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model("Order", orderSchema);

