import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

const router = express.Router();

router.route("/")
  .get(getCategories)
  .post(upload.single("image"), createCategory);

router.route("/:id")
  .get(getCategoryById)
  .put(upload.single("image"), updateCategory)
  .delete(deleteCategory);

export default router;
