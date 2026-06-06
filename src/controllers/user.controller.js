import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import Profile from "../models/profile.model.js";
import Cart from "../models/cart.model.js";
import Favorite from "../models/favorite.model.js";
import Review from "../models/review.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import PasswordReset from "../models/passwordReset.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { sendSuccess } from "../utils/response.js";

const attachOrdersToUsers = async (users) => {
  if (!users.length) return users;

  const userIds = users.map((user) => user._id);
  const [orders, profiles] = await Promise.all([
    Order.find({ user: { $in: userIds } })
      .populate("items.item", "name price image")
      .lean(),
    Profile.find({ user: { $in: userIds } })
      .select("user avatarUrl phone")
      .lean(),
  ]);

  const ordersByUser = orders.reduce((acc, order) => {
    const key = order.user.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  const profileByUser = profiles.reduce((acc, profile) => {
    acc[profile.user.toString()] = profile;
    return acc;
  }, {});

  return users.map((user) => ({
    ...user,
    orders: ordersByUser[user._id.toString()] || [],
    avatar: profileByUser[user._id.toString()]?.avatarUrl || null,
    phone: profileByUser[user._id.toString()]?.phone || null,
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
  const userId = user._id;
  const conversations = await Conversation.find({ participants: userId })
    .select("_id")
    .lean();
  const conversationIds = conversations.map((conversation) => conversation._id);

  const messageQuery = {
    $or: [{ sender: userId }, { receiver: userId }],
  };
  if (conversationIds.length) {
    messageQuery.$or.push({ conversation: { $in: conversationIds } });
  }

  await Promise.all([
    Order.deleteMany({ user: userId }),
    Cart.deleteMany({ user: userId }),
    Profile.deleteOne({ user: userId }),
    Favorite.deleteMany({ user: userId }),
    Review.deleteMany({ user: userId }),
    RefreshToken.deleteMany({ user: userId }),
    PasswordReset.deleteMany({ user: userId }),
    Message.deleteMany(messageQuery),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    user.deleteOne(),
  ]);
  sendSuccess(res, null, "User removed successfully");
});

/**
 * @desc Get admin users
 */
export const getAdminUsers = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === "admin";

  // Non-admins (e.g. a customer opening support chat) only need the admin's
  // basic identity to start a conversation — never their orders/profile.
  const admins = await User.find({ role: "admin" })
    .sort("-createdAt")
    .select(isAdmin ? "-password" : "_id name email role")
    .lean();

  const data = isAdmin ? await attachOrdersToUsers(admins) : admins;
  sendSuccess(res, data, "Admin users retrieved successfully");
});
