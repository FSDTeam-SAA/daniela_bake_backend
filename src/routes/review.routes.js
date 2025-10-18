import express from "express";
import { addOrUpdateReview, getReviewsByItem, deleteReview } from "../controllers/review.controller.js";

const router = express.Router();

router.post("/", addOrUpdateReview);
router.get("/item/:itemId", getReviewsByItem);
router.delete("/:id", deleteReview);

export default router;
