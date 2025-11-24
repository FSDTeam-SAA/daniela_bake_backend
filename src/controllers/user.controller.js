import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import { sendSuccess } from "../utils/response.js";

const attachOrdersToUsers = async (users) => {
  if (!users.length) return users;

  const userIds = users.map((user) => user._id);
  const orders = await Order.find({ user: { $in: userIds } })
    .populate("items.item", "name price image")
    .lean();

  const ordersByUser = orders.reduce((acc, order) => {
    const key = order.user.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  return users.map((user) => ({
    ...user,
    orders: ordersByUser[user._id.toString()] || [],
  }));
};

/**
 * @desc Get all users (filter, pagination)
 */
export const getUsers = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, sort = "-createdAt", name, email } = req.query;
  const query = {};

  if (name) query.name = { $regex: name, $options: "i" };
  if (email) query.email = { $regex: email, $options: "i" };

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const usersWithOrders = await attachOrdersToUsers(users);

  sendSuccess(
    res,
    {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      users: usersWithOrders,
    },
    "Users retrieved successfully"
  );
});

/**
 * @desc Get single user
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password").lean();
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const orders = await Order.find({ user: user._id })
    .populate("items.item", "name price image")
    .lean();

  sendSuccess(
    res,
    {
      ...user,
      orders,
    },
    "User retrieved successfully"
  );
});

/**
 * @desc Update user
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, email, password, role } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (password) user.password = await bcrypt.hash(password, 10);

  const updated = await user.save();
  sendSuccess(res, updated, "User updated successfully");
});

/**
 * @desc Delete user
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  await user.deleteOne();
  sendSuccess(res, null, "User removed successfully");
});

/**
 * @desc Get admin users
 */
export const getAdminUsers = asyncHandler(async (_req, res) => {
  const admins = await User.find({ role: "admin" }).sort("-createdAt").lean();
  const adminsWithOrders = await attachOrdersToUsers(admins);
  sendSuccess(res, adminsWithOrders, "Admin users retrieved successfully");
});
