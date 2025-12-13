const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");
const Order = require("../models/order.model");

// Admin: list users with order count and total spent
const getUsersAdmin = asyncHandler(async (_req, res) => {
  // Aggregate orders by user
  const orderAgg = await Order.aggregate([
    {
      $group: {
        _id: "$user",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" },
      },
    },
  ]);

  const ordersByUser = orderAgg.reduce((acc, curr) => {
    acc[curr._id?.toString()] = {
      orderCount: curr.orderCount,
      totalSpent: curr.totalSpent,
    };
    return acc;
  }, {});

  // Fetch users
  const users = await User.find().select("name email phone createdAt updatedAt");

  const formatted = users.map((u) => {
    const stats = ordersByUser[u._id.toString()] || { orderCount: 0, totalSpent: 0 };
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      joinDate: u.createdAt,
      lastUpdated: u.updatedAt,
      orders: stats.orderCount,
      totalSpent: Number(stats.totalSpent || 0),
    };
  });

  res.json({ success: true, data: formatted });
});

module.exports = {
  getUsersAdmin,
};

