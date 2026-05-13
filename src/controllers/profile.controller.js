import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import Profile from "../models/profile.model.js";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Favorite from "../models/favorite.model.js";
import Review from "../models/review.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import PasswordReset from "../models/passwordReset.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/uploadImage.js";
import { sendSuccess } from "../utils/response.js";

/**
 * @desc Create or update user profile
 * @route POST /api/v1/profile/:userId
 */
export const upsertProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { fullName, phone } = req.body;

  let profile = await Profile.findOne({ user: userId });

  if (!profile) {
    profile = new Profile({ user: userId });
  }

  if (req.file) {
    // delete old avatar if exists (derives public id from URL)
    if (profile.avatarUrl) {
      await deleteFromCloudinary(profile.avatarUrl);
    }

    const uploadedUrl = await uploadToCloudinary(req.file.path);
    if (uploadedUrl) {
      profile.avatarUrl = uploadedUrl;
    }
  }

  if (fullName) profile.fullName = fullName;
  if (phone) profile.phone = phone;

  const updated = await profile.save();
  sendSuccess(res, updated, "Profile saved successfully");
});

/**
 * @desc Get user profile
 * @route GET /api/v1/profile/:userId
 */
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.params.userId }).populate("user", "email name");
  if (!profile) {
    res.status(404);
    throw new Error("Profile not found");
  }
  sendSuccess(res, profile, "Profile retrieved successfully");
});

/**
 * @desc Delete user profile and Cloudinary avatar
 * @route DELETE /api/v1/profile/:userId
 */
export const deleteProfile = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const isOwner = req.user?._id?.toString() === userId;
  const isAdmin = req.user?.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("Forbidden");
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const profile = await Profile.findOne({ user: userId });

  if (profile?.avatarUrl) {
    await deleteFromCloudinary(profile.avatarUrl);
  }

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

  sendSuccess(res, null, "Account deleted successfully");
});
