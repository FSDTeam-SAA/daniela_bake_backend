import asyncHandler from "express-async-handler";
import Item from "../models/item.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/uploadImage.js";
import { sendSuccess } from "../utils/response.js";

const DAY_LABELS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_SYNONYMS = {
  sunday: "sun",
  sun: "sun",
  monday: "mon",
  mon: "mon",
  tuesday: "tue",
  tue: "tue",
  wednesday: "wed",
  wed: "wed",
  thursday: "thu",
  thu: "thu",
  friday: "fri",
  fri: "fri",
  saturday: "sat",
  sat: "sat",
};

const normalizeDay = (value) => {
  if (!value) return null;
  const key = value.toString().trim().toLowerCase();
  return DAY_SYNONYMS[key] || null;
};

const parseAvailableDays = (value) => {
  if (value === undefined || value === null || value === "") return null;

  let days = value;
  if (typeof days === "string") {
    try {
      days = JSON.parse(days);
    } catch {
      days = days.split(",").map((d) => d.trim());
    }
  }

  if (!Array.isArray(days)) {
    throw new Error("availableDays must be an array of days");
  }

  const normalized = days
    .filter(Boolean)
    .map((d) => normalizeDay(d))
    .filter(Boolean);

  const invalid = normalized.filter((d) => !DAY_LABELS.includes(d));
  if (invalid.length) {
    throw new Error(
      `Invalid availableDays value(s): ${invalid.join(", ")}. Use ${DAY_LABELS.join(
        ", "
      )}`
    );
  }

  return Array.from(new Set(normalized));
};

const getTodayDayLabel = () => DAY_LABELS[new Date().getDay()];

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
  let parsedAvailableDays = null;
  try {
    parsedAvailableDays = parseAvailableDays(req.body.availableDays);
  } catch (error) {
    res.status(400);
    throw error;
  }

  const item = await Item.create({
    name,
    description,
    price,
    image: imageUrl,
    category,
    ingredients: parsedIngredients,
    ...(parsedAvailableDays ? { availableDays: parsedAvailableDays } : {}),
  });

  res.status(201);
  sendSuccess(res, item, "Item created successfully");
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
    search,
    minPrice,
    maxPrice,
    name,
    day,
  } = req.query;

  const filters = [];

  const dayParam = (day || "today").toString().toLowerCase();

  if (dayParam !== "all") {
    const resolvedDay =
      dayParam === "today" ? getTodayDayLabel() : normalizeDay(dayParam);

    if (!resolvedDay || !DAY_LABELS.includes(resolvedDay)) {
      res.status(400);
      throw new Error(
        `Invalid day. Use ${DAY_LABELS.join(
          ", "
        )}, "today", or "all" for no day filter`
      );
    }

    filters.push({
      $or: [
        { availableDays: resolvedDay },
        { availableDays: { $elemMatch: { $regex: `^${resolvedDay}$`, $options: "i" } } },
        { availableDays: { $exists: false } },
        { availableDays: { $size: 0 } },
      ],
    });
  }

  if (category) filters.push({ category });
  if (name) filters.push({ name: { $regex: name, $options: "i" } });
  if (search) {
    const regex = new RegExp(search, "i");
    filters.push({
      $or: [
        { name: regex },
        { description: regex },
        { "ingredients.name": regex },
      ],
    });
  }
  if (minPrice || maxPrice) {
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = Number(minPrice);
    if (maxPrice) priceFilter.$lte = Number(maxPrice);
    filters.push({ price: priceFilter });
  }

  const query = filters.length ? { $and: filters } : {};

  const total = await Item.countDocuments(query);
  const items = await Item.find(query)
    .populate("category", "name image")
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  sendSuccess(
    res,
    {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      items,
    },
    "Items retrieved successfully"
  );
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
  sendSuccess(res, item, "Item retrieved successfully");
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
  if (req.body.availableDays !== undefined) {
    try {
      item.availableDays = parseAvailableDays(req.body.availableDays);
    } catch (error) {
      res.status(400);
      throw error;
    }
  }

  const updated = await item.save();
  sendSuccess(res, updated, "Item updated successfully");
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

  sendSuccess(res, null, "Item deleted and image removed from Cloudinary");
});
