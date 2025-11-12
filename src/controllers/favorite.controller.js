import asyncHandler from "express-async-handler";
import Favorite from "../models/favorite.model.js";
import { sendSuccess } from "../utils/response.js";

/**
 * @desc Add item to favorites
 * @route POST /api/v1/favorites
 */
export const addFavorite = asyncHandler(async (req, res) => {
  const { userId, itemId } = req.body;

  const existing = await Favorite.findOne({ user: userId, item: itemId });
  if (existing) {
    res.status(400);
    throw new Error("Item already in favorites");
  }

  const favorite = await Favorite.create({ user: userId, item: itemId });
  res.status(201);
  sendSuccess(res, favorite, "Item added to favorites");
});

/**
 * @desc Get user's favorite items
 * @route GET /api/v1/favorites/:userId
 */
export const getFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ user: req.params.userId }).populate("item", "name price image category");
  sendSuccess(res, favorites, "Favorites retrieved successfully");
});

/**
 * @desc Remove item from favorites
 * @route DELETE /api/v1/favorites
 */
export const removeFavorite = asyncHandler(async (req, res) => {
  const { userId, itemId } = req.body;

  const favorite = await Favorite.findOneAndDelete({ user: userId, item: itemId });
  if (!favorite) {
    res.status(404);
    throw new Error("Favorite not found");
  }

  sendSuccess(res, null, "Removed from favorites");
});
