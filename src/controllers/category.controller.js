import asyncHandler from "express-async-handler";
import Category from "../models/category.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/uploadImage.js";
import { sendSuccess } from "../utils/response.js";

/**
 * @desc Create new category
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, bgColor } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error("Category image is required");
  }

  if (!bgColor) {
    res.status(400);
    throw new Error("Background color is required");
  }

  const imageUrl = await uploadToCloudinary(req.file.path);

  const category = await Category.create({
    name,
    image: imageUrl,
    bgColor,
  });

  res.status(201);
  sendSuccess(res, category, "Category created successfully");
});



/**
 * @desc Get all categories (with pagination, sorting, filtering)
 */
export const getCategories = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, sort = "-createdAt", name } = req.query;
  const query = {};

  if (name) {
    query.name = { $regex: name, $options: "i" };
  }

  const total = await Category.countDocuments(query);
  const categories = await Category.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  sendSuccess(
    res,
    {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: categories,
    },
    "Categories retrieved successfully"
  );
});

/**
 * @desc Get single category
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  sendSuccess(res, category, "Category retrieved successfully");
});

/**
 * @desc Update category
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const { name, bgColor } = req.body;

  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  if (req.file) {
    await deleteFromCloudinary(category.image);
    category.image = await uploadToCloudinary(req.file.path);
  }

  if (name) category.name = name;
  if (bgColor) category.bgColor = bgColor;

  const updated = await category.save();
  sendSuccess(res, updated, "Category updated successfully");
});


/**
 * @desc Delete category
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Delete associated image
  await deleteFromCloudinary(category.image);
  await category.deleteOne();
  sendSuccess(res, null, "Category deleted and image removed from Cloudinary");
});
