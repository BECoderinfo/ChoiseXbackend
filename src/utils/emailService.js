const nodemailer = require("nodemailer");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const emailHost = process.env.EMAIL_HOST;
  const emailPort = process.env.EMAIL_PORT || 587;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPassword) {
    console.warn("Email credentials not configured. Emails will be logged only.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: emailHost,
    port: parseInt(emailPort),
    secure: emailPort == 465, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  return transporter;
}

// Email logging helper
function logEmail(type, to, orderId, status, error = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    to,
    orderId,
    status,
    error: error ? error.message : null,
  };
  console.log(`[EMAIL ${status}]`, JSON.stringify(logEntry));
}

/**
 * Send Order Confirmation Email
 * @param {Object} orderData - Order details
 * @param {Object} userData - User details (name, email)
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
async function sendOrderConfirmationEmail(orderData, userData) {
  const emailTransporter = getTransporter();
  const { orderId, items, address, subTotal, gstAmount, totalAmount, paymentMethod, paymentStatus, createdAt } = orderData;
  const { name, email } = userData;

  if (!email) {
    logEmail("ORDER_CONFIRMATION", email || "N/A", orderId, "FAILED", new Error("No email address provided"));
    return { success: false, message: "No email address provided" };
  }

  // Format order date
  const orderDate = new Date(createdAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build product items HTML
  const itemsHTML = items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${item.image || "https://via.placeholder.com/60"}" 
               alt="${item.name}" 
               style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" 
               onerror="this.src='https://via.placeholder.com/60'">
          <div>
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${item.name}</div>
            <div style="font-size: 12px; color: #6b7280;">SKU: ${item.SKU || item.sku || "N/A"}</div>
          </div>
        </div>
      </td>
      <td style="padding: 12px; text-align: center; color: #374151;">${item.quantity}</td>
      <td style="padding: 12px; text-align: right; color: #1f2937; font-weight: 600;">₹${Number(item.price).toFixed(2)}</td>
      <td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">₹${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - ChoiseX</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Order Confirmed!</h1>
              <p style="margin: 10px 0 0; color: #f0f0f0; font-size: 16px;">Thank you for your purchase</p>
            </td>
          </tr>
          
          <!-- Order Info -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">Hello ${name},</p>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                We're excited to confirm your order! Your order has been received and is being processed.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <div style="margin-bottom: 8px;">
                  <strong style="color: #374151;">Order ID:</strong>
                  <span style="color: #667eea; font-weight: 600; margin-left: 8px;">${orderId}</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <strong style="color: #374151;">Order Date:</strong>
                  <span style="color: #6b7280; margin-left: 8px;">${orderDate}</span>
                </div>
                <div>
                  <strong style="color: #374151;">Payment Method:</strong>
                  <span style="color: #6b7280; margin-left: 8px;">${paymentMethod}</span>
                  <span style="margin-left: 12px; padding: 4px 8px; background-color: ${paymentStatus === "Paid" ? "#d1fae5" : "#fef3c7"}; color: ${paymentStatus === "Paid" ? "#065f46" : "#92400e"}; border-radius: 4px; font-size: 12px; font-weight: 600;">
                    ${paymentStatus}
                  </span>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Products Table -->
          <tr>
            <td style="padding: 0 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px;">Order Items</h2>
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; color: #374151; font-weight: 600; font-size: 14px;">Product</th>
                    <th style="padding: 12px; text-align: center; color: #374151; font-weight: 600; font-size: 14px;">Qty</th>
                    <th style="padding: 12px; text-align: right; color: #374151; font-weight: 600; font-size: 14px;">Price</th>
                    <th style="padding: 12px; text-align: right; color: #374151; font-weight: 600; font-size: 14px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </td>
          </tr>
          
          <!-- Order Summary -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal (Base Price):</td>
                  <td style="padding: 8px 0; text-align: right; color: #374151; font-weight: 600;">₹${Number(subTotal).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">GST (18%):</td>
                  <td style="padding: 8px 0; text-align: right; color: #374151; font-weight: 600;">₹${Number(gstAmount).toFixed(2)}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0; color: #1f2937; font-size: 18px; font-weight: bold;">Total Amount (Inclusive of GST):</td>
                  <td style="padding: 12px 0; text-align: right; color: #059669; font-size: 20px; font-weight: bold;">₹${Number(totalAmount).toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Shipping Address -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 20px;">Shipping Address</h2>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px; color: #374151; font-size: 14px; line-height: 1.8;">
                <div style="font-weight: 600; margin-bottom: 8px;">${address.name}</div>
                <div>${address.address}${address.area ? `, ${address.area}` : ""}</div>
                <div>${address.city}, ${address.state} - ${address.postal}</div>
                <div style="margin-top: 8px;">
                  <strong>Mobile:</strong> ${address.mobile}
                  ${address.email ? `<br><strong>Email:</strong> ${address.email}` : ""}
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                We'll send you another email when your order ships.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                If you have any questions, please contact us at support@choisex.com
              </p>
              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ChoiseX. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `ChoiseX <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Order Confirmed - ${orderId} | ChoiseX`,
    html: emailHTML,
  };

  try {
    if (!emailTransporter) {
      logEmail("ORDER_CONFIRMATION", email, orderId, "SKIPPED", new Error("Email transporter not configured"));
      return { success: false, message: "Email service not configured", skipped: true };
    }

    await emailTransporter.sendMail(mailOptions);
    logEmail("ORDER_CONFIRMATION", email, orderId, "SENT", null);
    return { success: true, message: "Order confirmation email sent successfully" };
  } catch (error) {
    logEmail("ORDER_CONFIRMATION", email, orderId, "FAILED", error);
    console.error("Error sending order confirmation email:", error);
    return { success: false, message: error.message || "Failed to send email" };
  }
}

/**
 * Send Shipping Notification Email
 * @param {Object} orderData - Order details
 * @param {Object} trackingData - Tracking information
 * @param {Object} userData - User details (name, email)
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
async function sendShippingNotificationEmail(orderData, trackingData, userData) {
  const emailTransporter = getTransporter();
  const { orderId, items, address, totalAmount } = orderData;
  const { referenceNumber, estimateDate, courierPartner, trackingLink, status } = trackingData;
  const { name, email } = userData;

  if (!email) {
    logEmail("SHIPPING_NOTIFICATION", email || "N/A", orderId, "FAILED", new Error("No email address provided"));
    return { success: false, message: "No email address provided" };
  }

  // Format estimated delivery date
  const deliveryDate = new Date(estimateDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Status badge colors
  const statusConfig = {
    "Order Confirmed": { bg: "#dbeafe", color: "#1e40af", text: "Order Confirmed" },
    "Picked by Courier": { bg: "#fef3c7", color: "#92400e", text: "Picked by Courier" },
    "On the Way": { bg: "#ddd6fe", color: "#5b21b6", text: "On the Way" },
    "Ready for Pickup": { bg: "#d1fae5", color: "#065f46", text: "Ready for Pickup" },
  };

  const statusStyle = statusConfig[status] || statusConfig["Order Confirmed"];

  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order is Shipped - ChoiseX</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🚚 Your Order is Shipped!</h1>
              <p style="margin: 10px 0 0; color: #f0f0f0; font-size: 16px;">Track your package</p>
            </td>
          </tr>
          
          <!-- Order Info -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">Hello ${name},</p>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Great news! Your order has been shipped and is on its way to you.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <div style="margin-bottom: 12px;">
                  <strong style="color: #374151;">Order ID:</strong>
                  <span style="color: #059669; font-weight: 600; margin-left: 8px;">${orderId}</span>
                </div>
                <div style="margin-bottom: 12px;">
                  <strong style="color: #374151;">Status:</strong>
                  <span style="margin-left: 8px; padding: 6px 12px; background-color: ${statusStyle.bg}; color: ${statusStyle.color}; border-radius: 4px; font-size: 14px; font-weight: 600;">
                    ${statusStyle.text}
                  </span>
                </div>
                <div style="margin-bottom: 12px;">
                  <strong style="color: #374151;">Courier Partner:</strong>
                  <span style="color: #6b7280; margin-left: 8px;">${courierPartner}</span>
                </div>
                <div style="margin-bottom: 12px;">
                  <strong style="color: #374151;">Tracking Number:</strong>
                  <span style="color: #374151; font-weight: 600; margin-left: 8px; font-family: monospace;">${referenceNumber}</span>
                </div>
                <div>
                  <strong style="color: #374151;">Estimated Delivery:</strong>
                  <span style="color: #059669; font-weight: 600; margin-left: 8px;">${deliveryDate}</span>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Tracking Link -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="text-align: center;">
                <a href="${trackingLink}" 
                   style="display: inline-block; padding: 14px 28px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Track Your Package
                </a>
              </div>
              <p style="text-align: center; margin-top: 15px; color: #6b7280; font-size: 12px;">
                Or copy this link: <span style="font-family: monospace; color: #374151;">${trackingLink}</span>
              </p>
            </td>
          </tr>
          
          <!-- Shipping Address -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 20px;">Delivery Address</h2>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px; color: #374151; font-size: 14px; line-height: 1.8;">
                <div style="font-weight: 600; margin-bottom: 8px;">${address.name}</div>
                <div>${address.address}${address.area ? `, ${address.area}` : ""}</div>
                <div>${address.city}, ${address.state} - ${address.postal}</div>
                <div style="margin-top: 8px;">
                  <strong>Mobile:</strong> ${address.mobile}
                  ${address.email ? `<br><strong>Email:</strong> ${address.email}` : ""}
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Order Summary -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 20px;">Order Summary</h2>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #6b7280; font-size: 14px;">Total Items:</span>
                  <span style="color: #374151; font-weight: 600;">${items.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">
                  <span style="color: #1f2937; font-size: 16px; font-weight: 600;">Total Amount:</span>
                  <span style="color: #059669; font-size: 18px; font-weight: bold;">₹${Number(totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                We'll notify you when your order is delivered.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                If you have any questions, please contact us at support@choisex.com
              </p>
              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ChoiseX. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `ChoiseX <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your Order ${orderId} Has Been Shipped | ChoiseX`,
    html: emailHTML,
  };

  try {
    if (!emailTransporter) {
      logEmail("SHIPPING_NOTIFICATION", email, orderId, "SKIPPED", new Error("Email transporter not configured"));
      return { success: false, message: "Email service not configured", skipped: true };
    }

    await emailTransporter.sendMail(mailOptions);
    logEmail("SHIPPING_NOTIFICATION", email, orderId, "SENT", null);
    return { success: true, message: "Shipping notification email sent successfully" };
  } catch (error) {
    logEmail("SHIPPING_NOTIFICATION", email, orderId, "FAILED", error);
    console.error("Error sending shipping notification email:", error);
    return { success: false, message: error.message || "Failed to send email" };
  }
}

/**
 * Send Order Cancellation Email
 */
async function sendCancellationEmail(orderData, userData) {
  const emailTransporter = getTransporter();
  const { orderId, items, address, subTotal, gstAmount, totalAmount, paymentMethod, refundStatus, createdAt } = orderData;
  const { name, email } = userData;

  if (!email) {
    logEmail("CANCELLATION", email || "N/A", orderId, "FAILED", new Error("No email address provided"));
    return { success: false, message: "No email address provided" };
  }

  const orderDate = new Date(createdAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHTML = (items || [])
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px;">${item.name}</td>
      <td style="padding: 10px; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; text-align: right;">₹${Number(item.price).toFixed(2)}</td>
      <td style="padding: 10px; text-align: right;">₹${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  const refundMessage =
    paymentMethod === "Razorpay"
      ? `<p style="margin: 0 0 12px; color: #6b7280;">Refund will be credited to your original payment method within 5–7 working days.</p>`
      : `<p style="margin: 0 0 12px; color: #6b7280;">No refund is applicable for Cash on Delivery.</p>`;

  const emailHTML = `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-radius: 6px;">
    <h2 style="margin: 0 0 12px; color: #dc2626;">Order Cancelled</h2>
    <p style="margin: 0 0 8px; color: #111827;">Hello ${name},</p>
    <p style="margin: 0 0 12px; color: #6b7280;">Your order has been cancelled. Below are the details.</p>
    <div style="padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 16px;">
      <div><strong>Order ID:</strong> ${orderId}</div>
      <div><strong>Order Date:</strong> ${orderDate}</div>
      <div><strong>Payment Method:</strong> ${paymentMethod}</div>
      <div><strong>Refund Status:</strong> ${refundStatus}</div>
    </div>
    ${refundMessage}
    <h4 style="margin: 16px 0 8px; color: #111827;">Order Summary</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left;">Product</th>
          <th style="padding: 10px; text-align: center;">Qty</th>
          <th style="padding: 10px; text-align: right;">Price</th>
          <th style="padding: 10px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div style="margin-top: 12px; text-align: right; color: #111827;">
      <div>Subtotal: ₹${Number(subTotal || 0).toFixed(2)}</div>
      <div>GST (18%): ₹${Number(gstAmount || 0).toFixed(2)}</div>
      <div style="font-weight: 700;">Total: ₹${Number(totalAmount || 0).toFixed(2)}</div>
    </div>
    <div style="margin-top: 16px; color: #6b7280; font-size: 12px;">
      If you have questions, reply to this email.
    </div>
  </div>
  `;

  const mailOptions = {
    from: `ChoiseX <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Order Cancelled - ${orderId}`,
    html: emailHTML,
  };

  try {
    if (!emailTransporter) {
      logEmail("CANCELLATION", email, orderId, "SKIPPED", new Error("Email transporter not configured"));
      return { success: false, message: "Email service not configured", skipped: true };
    }
    await emailTransporter.sendMail(mailOptions);
    logEmail("CANCELLATION", email, orderId, "SENT", null);
    return { success: true, message: "Cancellation email sent" };
  } catch (error) {
    logEmail("CANCELLATION", email, orderId, "FAILED", error);
    return { success: false, message: error.message || "Failed to send email" };
  }
}

/**
 * Send Refund Confirmation Email
 */
async function sendRefundConfirmationEmail(orderData, userData) {
  const emailTransporter = getTransporter();
  const { orderId, items, address, subTotal, gstAmount, totalAmount, refundId, refundCompletedAt } = orderData;
  const { name, email } = userData;

  if (!email) {
    logEmail("REFUND_CONFIRMATION", email || "N/A", orderId, "FAILED", new Error("No email address provided"));
    return { success: false, message: "No email address provided" };
  }

  const itemsHTML = (items || [])
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px;">${item.name}</td>
      <td style="padding: 10px; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; text-align: right;">₹${Number(item.price).toFixed(2)}</td>
      <td style="padding: 10px; text-align: right;">₹${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  const emailHTML = `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-radius: 6px;">
    <h2 style="margin: 0 0 12px; color: #16a34a;">Refund Processed</h2>
    <p style="margin: 0 0 8px; color: #111827;">Hello ${name},</p>
    <p style="margin: 0 0 12px; color: #6b7280;">Your refund has been issued to your original payment method.</p>
    <div style="padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 16px;">
      <div><strong>Order ID:</strong> ${orderId}</div>
      <div><strong>Refund ID:</strong> ${refundId || "N/A"}</div>
      <div><strong>Refund Date:</strong> ${
        refundCompletedAt ? new Date(refundCompletedAt).toLocaleString("en-IN") : "Processing"
      }</div>
      <div><strong>Amount:</strong> ₹${Number(totalAmount || 0).toFixed(2)}</div>
    </div>
    <h4 style="margin: 16px 0 8px; color: #111827;">Order Summary</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left;">Product</th>
          <th style="padding: 10px; text-align: center;">Qty</th>
          <th style="padding: 10px; text-align: right;">Price</th>
          <th style="padding: 10px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div style="margin-top: 12px; text-align: right; color: #111827;">
      <div>Subtotal: ₹${Number(subTotal || 0).toFixed(2)}</div>
      <div>GST (18%): ₹${Number(gstAmount || 0).toFixed(2)}</div>
      <div style="font-weight: 700;">Total Refunded: ₹${Number(totalAmount || 0).toFixed(2)}</div>
    </div>
    <div style="margin-top: 16px; color: #6b7280; font-size: 12px;">
      If you have questions, reply to this email.
    </div>
  </div>
  `;

  const mailOptions = {
    from: `ChoiseX <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Refund Processed - ${orderId}`,
    html: emailHTML,
  };

  try {
    if (!emailTransporter) {
      logEmail("REFUND_CONFIRMATION", email, orderId, "SKIPPED", new Error("Email transporter not configured"));
      return { success: false, message: "Email service not configured", skipped: true };
    }
    await emailTransporter.sendMail(mailOptions);
    logEmail("REFUND_CONFIRMATION", email, orderId, "SENT", null);
    return { success: true, message: "Refund confirmation email sent" };
  } catch (error) {
    logEmail("REFUND_CONFIRMATION", email, orderId, "FAILED", error);
    return { success: false, message: error.message || "Failed to send email" };
  }
}

async function sendOTPEmail(email, otp) {
  const emailTransporter = getTransporter();

  if (!emailTransporter) {
    console.log(`OTP for ${email}: ${otp}`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for Password Reset - ChoiseX",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset OTP</h2>
        <p>Hello,</p>
        <p>You have requested to reset your password. Please use the following OTP to verify your identity:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This OTP will expire in 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br>ChoiseX Team</p>
      </div>
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
}

async function sendWelcomeEmail(email, name) {
  const emailTransporter = getTransporter();

  if (!emailTransporter) {
    console.log(`Welcome email would be sent to ${email}`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to ChoiseX!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to ChoiseX!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for signing up with ChoiseX. We're excited to have you on board!</p>
        <p>Start exploring our amazing products and enjoy a seamless shopping experience.</p>
        <p>Best regards,<br>ChoiseX Team</p>
      </div>
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw error for welcome email as it's not critical
  }
}

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
  sendCancellationEmail,
  sendRefundConfirmationEmail,
};
