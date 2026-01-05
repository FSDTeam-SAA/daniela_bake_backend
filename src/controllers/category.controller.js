import asyncHandler from "express-async-handler";
import Category from "../models/category.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/uploadImage.js";
import { sendSuccess } from "../utils/response.js";

const normalizeCategoryOrder = async () => {
  const categories = await Category.find()
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .select("_id order");

  const updates = categories.reduce((ops, category, index) => {
    const nextOrder = index + 1;
    if (category.order !== nextOrder) {
      ops.push({
        updateOne: {
          filter: { _id: category._id },
          update: { $set: { order: nextOrder } },
        },
      });
    }
    return ops;
  }, []);

  if (updates.length > 0) {
    await Category.bulkWrite(updates);
  }
};

/**
 * @desc Create new category
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, bgColor, order } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error("Category image is required");
  }

  if (!bgColor) {
    res.status(400);
    throw new Error("Background color is required");
  }

  const imageUrl = await uploadToCloudinary(req.file.path);

  let orderValue = Number.parseInt(order, 10);
  if (Number.isNaN(orderValue)) {
    const lastCategory = await Category.findOne().sort("-order").select("order");
    orderValue = (lastCategory?.order || 0) + 1;
  } else if (orderValue < 1) {
    res.status(400);
    throw new Error("Order must be a positive number");
  } else {
    await Category.updateMany(
      { order: { $gte: orderValue } },
      { $inc: { order: 1 } }
    );
  }

  const category = await Category.create({
    name,
    image: imageUrl,
    bgColor,
    order: orderValue,
  });

  await normalizeCategoryOrder();
  const normalized = await Category.findById(category._id);
  res.status(201);
  sendSuccess(
    res,
    normalized || category,
    "Category created successfully"
  );
});



/**
 * @desc Get all categories (with pagination, sorting, filtering)
 */
export const getCategories = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, sort = "order", name } = req.query;
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
  const { name, bgColor, order } = req.body;

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
  if (order !== undefined) {
    const orderValue = Number.parseInt(order, 10);
    if (Number.isNaN(orderValue) || orderValue < 1) {
      res.status(400);
      throw new Error("Order must be a positive number");
    }

    const currentOrder = category.order || 0;
    if (orderValue !== currentOrder) {
      if (orderValue > currentOrder) {
        await Category.updateMany(
          { order: { $gt: currentOrder, $lte: orderValue } },
          { $inc: { order: -1 } }
        );
      } else {
        await Category.updateMany(
          { order: { $gte: orderValue, $lt: currentOrder } },
          { $inc: { order: 1 } }
        );
      }
      category.order = orderValue;
    }
  }

  const updated = await category.save();
  await normalizeCategoryOrder();
  const normalized = await Category.findById(category._id);
  sendSuccess(
    res,
    normalized || updated,
    "Category updated successfully"
  );
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
  await normalizeCategoryOrder();
  sendSuccess(res, null, "Category deleted and image removed from Cloudinary");
});
