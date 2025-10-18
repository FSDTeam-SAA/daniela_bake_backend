import asyncHandler from "express-async-handler";
import Profile from "../models/profile.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/uploadImage.js";

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
    // delete old avatar if exists
    if (profile.avatar?.public_id) {
      await deleteFromCloudinary(profile.avatar.public_id);
    }

    const result = await uploadToCloudinary(req.file.path);
    profile.avatar = {
      url: result.url,
      public_id: result.public_id,
    };
  }

  if (fullName) profile.fullName = fullName;
  if (phone) profile.phone = phone;

  const updated = await profile.save();
  res.json(updated);
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
  res.json(profile);
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

  if (profile.avatar?.public_id) {
    await deleteFromCloudinary(profile.avatar.public_id);
  }

  await profile.deleteOne();
  res.json({ message: "Profile deleted successfully" });
});
