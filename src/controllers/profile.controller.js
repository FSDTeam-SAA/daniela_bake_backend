import asyncHandler from "express-async-handler";
import Profile from "../models/profile.model.js";
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
  const profile = await Profile.findOne({ user: req.params.userId });
  if (!profile) {
    res.status(404);
    throw new Error("Profile not found");
  }

  if (profile.avatarUrl) {
    await deleteFromCloudinary(profile.avatarUrl);
  }

  await profile.deleteOne();
  sendSuccess(res, null, "Profile deleted successfully");
});
