import asyncHandler from "express-async-handler";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import { sendSuccess } from "../utils/response.js";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatCurrency = (value = 0) =>
  Math.round((Number(value) || 0) * 100) / 100;

/**
 * @desc   Admin dashboard overview (stats, charts, recent orders)
 * @route  GET /api/v1/dashboard/overview
 */
export const getDashboardOverview = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const [
    totalCustomers,
    totalOrders,
    totalDelivered,
    totalRevenueAgg,
    weeklyPerformanceAgg,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    Order.countDocuments(),
    Order.countDocuments({ status: "Delivered" }),
    Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek, $lt: endOfWeek },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
    ]),
    Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const totalRevenue = totalRevenueAgg[0]?.totalRevenue || 0;

  const weeklyMap = weeklyPerformanceAgg.reduce((acc, row) => {
    acc[row._id] = {
      orders: row.orders,
      revenue: row.revenue,
    };
    return acc;
  }, {});

  const weeklyPerformance = dayLabels.map((label, idx) => {
    const aggregationKey = idx === 0 ? 1 : idx + 1; // Mongo $dayOfWeek => Sunday = 1
    const metrics = weeklyMap[aggregationKey] || { orders: 0, revenue: 0 };
    return {
      name: label,
      orders: metrics.orders,
      revenue: formatCurrency(metrics.revenue),
    };
  });

  const formattedRecentOrders = recentOrders.map((order) => ({
    id: order._id,
    orderId: order._id.toString().slice(-6),
    customer: order.user?.name || "Unknown",
    amount: formatCurrency(order.totalAmount),
    status: order.status,
    createdAt: order.createdAt,
  }));

  sendSuccess(
    res,
    {
      stats: {
        totalCustomers,
        totalDelivered,
        totalRevenue: formatCurrency(totalRevenue),
        totalOrders,
      },
      charts: {
        weeklyPerformance,
      },
      recentOrders: formattedRecentOrders,
    },
    "Dashboard overview fetched successfully"
  );
});
