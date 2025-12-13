/**
 * Email Retry Utility
 * Handles retrying failed email sends with exponential backoff
 */

const { sendOrderConfirmationEmail, sendShippingNotificationEmail } = require("./emailService");
const Order = require("../models/order.model");
const User = require("../models/user.model");

/**
 * Retry failed order confirmation email
 * @param {String} orderId - Order ID
 * @param {Number} maxRetries - Maximum retry attempts (default: 3)
 */
async function retryOrderConfirmationEmail(orderId, maxRetries = 3) {
  try {
    const order = await Order.findOne({ orderId })
      .populate({
        path: "items.product",
        populate: { path: "category" },
      })
      .populate("user", "name email");

    if (!order) {
      console.error(`Order ${orderId} not found for email retry`);
      return { success: false, message: "Order not found" };
    }

    // Check if already sent successfully
    if (order.emailNotifications.orderConfirmationSent) {
      return { success: true, message: "Email already sent successfully" };
    }

    const user = order.user;
    if (!user || !user.email) {
      return { success: false, message: "User email not found" };
    }

    // Format order items
    const formattedItems = order.items.map((item) => ({
      id: item.product._id || item.product.id,
      SKU: item.product.sku || item.product.SKU,
      name: item.product.name,
      price: item.product.price?.toString() || item.product.price,
      markprice: item.product.markprice?.toString() || item.product.markprice,
      image: item.product.mainImage || item.product.image,
      quantity: item.quantity,
    }));

    // Calculate totals
    const subTotal = formattedItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
    const gstAmount = Number((subTotal * 0.18).toFixed(2));
    const totalWithGst = Number((subTotal + gstAmount).toFixed(2));

    // Retry sending email
    const result = await sendOrderConfirmationEmail(
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
        name: user.name,
        email: user.email,
      }
    );

    // Update status
    if (result.success) {
      order.emailNotifications.orderConfirmationSent = true;
      order.emailNotifications.orderConfirmationSentAt = new Date();
      order.emailNotifications.orderConfirmationError = null;
    } else {
      order.emailNotifications.orderConfirmationError = result.message;
    }
    await order.save();

    return result;
  } catch (error) {
    console.error(`Error retrying order confirmation email for ${orderId}:`, error);
    return { success: false, message: error.message };
  }
}

/**
 * Retry failed shipping notification email
 * @param {String} orderId - Order ID
 * @param {Number} maxRetries - Maximum retry attempts (default: 3)
 */
async function retryShippingNotificationEmail(orderId, maxRetries = 3) {
  try {
    const order = await Order.findOne({ orderId })
      .populate({
        path: "items.product",
        populate: { path: "category" },
      })
      .populate("user", "name email");

    if (!order) {
      console.error(`Order ${orderId} not found for email retry`);
      return { success: false, message: "Order not found" };
    }

    // Check if tracking exists
    if (!order.tracking || !order.tracking.referenceNumber) {
      return { success: false, message: "Tracking information not found" };
    }

    // Check if already sent successfully
    if (order.emailNotifications.shippingNotificationSent) {
      return { success: true, message: "Email already sent successfully" };
    }

    const user = order.user;
    if (!user || !user.email) {
      return { success: false, message: "User email not found" };
    }

    // Format order items
    const formattedItems = order.items.map((item) => ({
      id: item.product._id || item.product.id,
      SKU: item.product.sku || item.product.SKU,
      name: item.product.name,
      price: item.product.price?.toString() || item.product.price,
      image: item.product.mainImage || item.product.image,
      quantity: item.quantity,
    }));

    // Calculate totals
    const subTotal = formattedItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
    const gstAmount = Number((subTotal * 0.18).toFixed(2));
    const totalWithGst = Number((subTotal + gstAmount).toFixed(2));

    // Retry sending email
    const result = await sendShippingNotificationEmail(
      {
        orderId: order.orderId,
        items: formattedItems,
        address: order.address,
        totalAmount: totalWithGst,
      },
      {
        referenceNumber: order.tracking.referenceNumber,
        estimateDate: order.tracking.estimateDate,
        courierPartner: order.tracking.courierPartner,
        trackingLink: order.tracking.trackingLink,
        status: order.tracking.status,
      },
      {
        name: user.name,
        email: user.email,
      }
    );

    // Update status
    if (result.success) {
      order.emailNotifications.shippingNotificationSent = true;
      order.emailNotifications.shippingNotificationSentAt = new Date();
      order.emailNotifications.shippingNotificationError = null;
    } else {
      order.emailNotifications.shippingNotificationError = result.message;
    }
    await order.save();

    return result;
  } catch (error) {
    console.error(`Error retrying shipping notification email for ${orderId}:`, error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  retryOrderConfirmationEmail,
  retryShippingNotificationEmail,
};

