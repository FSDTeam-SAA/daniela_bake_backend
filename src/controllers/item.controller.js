import asyncHandler from "express-async-handler";
import Item from "../models/item.model.js";
import { uploadToCloudinary } from "../utils/uploadImage.js";

/**
 * @desc Create item
 */
export const createItem = asyncHandler(async (req, res) => {
  const { name, description, price, category, ingredients } = req.body;
  if (!req.file) {
    res.status(400);
    throw new Error("Image is required");
  }

  const imageUrl = await uploadToCloudinary(req.file.path);
  const parsedIngredients = ingredients ? JSON.parse(ingredients) : [];

  const item = await Item.create({
    name,
    description,
    price,
    image: imageUrl,
    category,
    ingredients: parsedIngredients,
  });

  res.status(201).json(item);
});

/**
 * @desc Get items (with filtering, sorting, pagination)
 */
export const getItems = asyncHandler(async (req, res) => {
  let {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    category,
    minPrice,
    maxPrice,
    name,
  } = req.query;

  const query = {};

  if (category) query.category = category;
  if (name) query.name = { $regex: name, $options: "i" };
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  const total = await Item.countDocuments(query);
  const items = await Item.find(query)
    .populate("category", "name image")
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    data: items,
  });
});

/**
 * @desc Get single item
 */
export const getItemById = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).populate("category", "name");
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  res.json(item);
});

/**
 * @desc Update item
 */
export const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }

  const { name, description, price, category, ingredients } = req.body;

  if (req.file) {
    // Delete old image before uploading new one
    await deleteFromCloudinary(item.image);
    item.image = await uploadToCloudinary(req.file.path);
  }

  if (name) item.name = name;
  if (description) item.description = description;
  if (price) item.price = price;
  if (category) item.category = category;
  if (ingredients) item.ingredients = JSON.parse(ingredients);

  const updated = await item.save();
  res.json(updated);
});

/**
 * @desc Delete item
 */
export const deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }

  await deleteFromCloudinary(item.image);
  await item.deleteOne();

  res.json({ message: "Item deleted and image removed from Cloudinary" });
});