import asyncHandler from "express-async-handler";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import { sendSuccess } from "../utils/response.js";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatCurrency = (value = 0) => Math.round((Number(value) || 0) * 100) / 100;

const getRangeBounds = (timeRange = "week") => {
  const now = new Date();
  const end = new Date(now);

  const start = new Date(now);
  switch (timeRange) {
    case "day":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "week": {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 7);
      end.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(start.getFullYear() + 1, 0, 1);
      end.setHours(0, 0, 0, 0);
      break;
    default:
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 7);
      end.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

const buildChartBuckets = (timeRange, start, end) => {
  if (timeRange === "day") {
    return Array.from({ length: 24 }).map((_, hour) => ({
      key: hour.toString().padStart(2, "0"),
      label: `${hour.toString().padStart(2, "0")}:00`,
    }));
  }

  if (timeRange === "week") {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return {
        key: d.toISOString().split("T")[0],
        label: dayLabels[d.getDay()],
      };
    });
  }

  if (timeRange === "month") {
    const buckets = [];
    const current = new Date(start);
    while (current < end) {
      const key = current.toISOString().split("T")[0];
      buckets.push({ key, label: String(current.getDate()).padStart(2, "0") });
      current.setDate(current.getDate() + 1);
    }
    return buckets;
  }

  // year
  return Array.from({ length: 12 }).map((_, idx) => ({
    key: `${start.getFullYear()}-${(idx + 1).toString().padStart(2, "0")}`,
    label: monthLabels[idx],
  }));
};

const getGroupFormat = (timeRange) => {
  switch (timeRange) {
    case "day":
      return "%H";
    case "week":
    case "month":
      return "%Y-%m-%d";
    case "year":
      return "%Y-%m";
    default:
      return "%Y-%m-%d";
  }
};

/**
 * @desc   Admin dashboard overview (stats, charts, recent orders) with time-range filters
 * @route  GET /api/v1/dashboard/overview?timeRange=day|week|month|year
 */
export const getDashboardOverview = asyncHandler(async (req, res) => {
  const timeRange = (req.query.timeRange || "week").toString().toLowerCase();
  const { start, end } = getRangeBounds(timeRange);
  const groupFormat = getGroupFormat(timeRange);
  const buckets = buildChartBuckets(timeRange, start, end);

  const matchStage = { createdAt: { $gte: start, $lt: end } };

  const [ordersInRange, deliveredInRange, revenueAgg, customersAgg, performanceAgg, recentOrders] =
    await Promise.all([
      Order.countDocuments(matchStage),
      Order.countDocuments({ ...matchStage, status: "Delivered" }),
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
      Order.aggregate([
        { $match: matchStage },
        { $group: { _id: "$user" } },
        { $count: "uniqueUsers" },
      ]),
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: "$createdAt",
              },
            },
            orders: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
          },
        },
      ]),
      Order.find(matchStage)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
  const totalCustomers = customersAgg[0]?.uniqueUsers || 0;

  const perfMap = performanceAgg.reduce((acc, row) => {
    acc[row._id] = { orders: row.orders, revenue: row.revenue };
    return acc;
  }, {});

  const performance = buckets.map(({ key, label }) => ({
    name: label,
    orders: perfMap[key]?.orders || 0,
    revenue: formatCurrency(perfMap[key]?.revenue || 0),
  }));

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
        totalDelivered: deliveredInRange,
        totalRevenue: formatCurrency(totalRevenue),
        totalOrders: ordersInRange,
      },
      charts: {
        performance,
      },
      recentOrders: formattedRecentOrders,
    },
    "Dashboard overview fetched successfully"
  );
});
