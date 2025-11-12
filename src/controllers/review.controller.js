import asyncHandler from "express-async-handler";
import Review from "../models/review.model.js";
import Item from "../models/item.model.js";
import { sendSuccess } from "../utils/response.js";

/**
 * @desc Add or update review
 * @route POST /api/v1/reviews
 */
export const addOrUpdateReview = asyncHandler(async (req, res) => {
  const { userId, itemId, orderId, rating, comment } = req.body;

  let review = await Review.findOne({ user: userId, item: itemId });

  if (review) {
    review.rating = rating;
    review.comment = comment || review.comment;
  } else {
    review = await Review.create({ user: userId, item: itemId, order: orderId, rating, comment });
  }

  await review.save();

  // Update average rating for item
  const reviews = await Review.find({ item: itemId });
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const count = reviews.length;

  await Item.findByIdAndUpdate(itemId, { rating: avgRating, reviewsCount: count });

  sendSuccess(res, review, "Review saved successfully");
});

/**
 * @desc Get reviews for an item
 * @route GET /api/v1/reviews/item/:itemId
 */
export const getReviewsByItem = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ item: req.params.itemId })
    .populate("user", "name email")
    .sort("-createdAt");
  sendSuccess(res, reviews, "Reviews retrieved successfully");
});

/**
 * @desc Delete a review
 * @route DELETE /api/v1/reviews/:id
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  await review.deleteOne();
  sendSuccess(res, null, "Review deleted successfully");
});
