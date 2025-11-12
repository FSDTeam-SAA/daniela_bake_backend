import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { sendSuccess } from "../utils/response.js";

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
    .limit(Number(limit));

  sendSuccess(
    res,
    {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      users,
    },
    "Users retrieved successfully"
  );
});

/**
 * @desc Get single user
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  sendSuccess(res, user, "User retrieved successfully");
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
