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

const parseSpecialDays = (value) => {
  if (value === undefined || value === null || value === "") return [];
  return parseAvailableDays(value) || [];
};

const getTodayDayLabel = () => DAY_LABELS[new Date().getDay()];

const parseIngredients = (ingredients) => {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) return ingredients;
  return JSON.parse(ingredients);
};

const MAX_ITEM_IMAGES = 5;

const collectItemImageFiles = (req) => {
  const files = [];
  if (Array.isArray(req.files?.images)) {
    files.push(...req.files.images);
  }
  if (Array.isArray(req.files?.image)) {
    files.push(...req.files.image);
  }
  if (req.file) {
    files.push(req.file);
  }
  return files;
};

const parseExistingImages = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") return fallback;

  let images = value;
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      images = images.split(",").map((img) => img.trim());
    }
  }

  if (!Array.isArray(images)) {
    throw new Error("existingImages must be an array");
  }

  return images.filter(Boolean);
};

const dedupeImages = (images = []) =>
  images.filter(Boolean).filter((url, index, arr) => arr.indexOf(url) === index);

const uploadImages = async (files = []) => {
  if (!files.length) return [];
  const uploads = await Promise.all(
    files.map((file) => uploadToCloudinary(file.path))
  );
  return uploads.filter(Boolean);
};

const getExistingItemImages = (item) => {
  if (Array.isArray(item.images) && item.images.length) return item.images;
  if (item.image) return [item.image];
  return [];
};

const attachIngredientImages = async (ingredientsList, imageFiles) => {
  if (!ingredientsList?.length || !imageFiles?.length) return ingredientsList;
  const uploaded = await Promise.all(
    imageFiles.map((file) => uploadToCloudinary(file.path))
  );

  return ingredientsList.map((ingredient, index) => {
    const imageUrl = uploaded[index];
    if (!imageUrl) return ingredient;
    return { ...ingredient, image: imageUrl };
  });
};

/**
 * @desc Create item
 */
export const createItem = asyncHandler(async (req, res) => {
  const { name, description, price, category, ingredients } = req.body;
  const imageFiles = collectItemImageFiles(req);
  if (!imageFiles.length) {
    res.status(400);
    throw new Error("At least one image is required");
  }
  if (imageFiles.length > MAX_ITEM_IMAGES) {
    res.status(400);
    throw new Error(`You can upload up to ${MAX_ITEM_IMAGES} images per item`);
  }

  const uploadedImages = await uploadImages(imageFiles);
  if (!uploadedImages.length) {
    res.status(400);
    throw new Error("Failed to upload images");
  }
  const images = dedupeImages(uploadedImages).slice(0, MAX_ITEM_IMAGES);
  if (!images.length) {
    res.status(400);
    throw new Error("At least one valid image is required");
  }

  const parsedIngredients = parseIngredients(ingredients);
  const ingredientImages = req.files?.ingredientImage || [];
  const ingredientsWithImages = await attachIngredientImages(
    parsedIngredients,
    ingredientImages
  );
  let parsedAvailableDays = null;
  try {
    parsedAvailableDays = parseAvailableDays(req.body.availableDays);
  } catch (error) {
    res.status(400);
    throw error;
  }
  const parsedSpecialDays = parseSpecialDays(req.body.specialDays);

  const item = await Item.create({
    name,
    description,
    price,
    images,
    image: images[0],
    category,
    ingredients: ingredientsWithImages,
    ...(parsedAvailableDays ? { availableDays: parsedAvailableDays } : {}),
    specialDays: parsedSpecialDays,
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

  const dayParam = (day || "all").toString().toLowerCase();

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
      specialDays: resolvedDay,
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

  const currentImages = getExistingItemImages(item);
  let nextImages = currentImages;

  try {
    nextImages = parseExistingImages(req.body.existingImages, currentImages);
  } catch (error) {
    res.status(400);
    throw error;
  }

  nextImages = dedupeImages(nextImages);

  if (nextImages.length > MAX_ITEM_IMAGES) {
    res.status(400);
    throw new Error(`You can upload up to ${MAX_ITEM_IMAGES} images per item`);
  }

  const newImageFiles = collectItemImageFiles(req);
  if (newImageFiles.length) {
    if (nextImages.length + newImageFiles.length > MAX_ITEM_IMAGES) {
      res.status(400);
      throw new Error(
        `You can upload up to ${MAX_ITEM_IMAGES} images per item`
      );
    }

    const uploadedImages = await uploadImages(newImageFiles);
    nextImages = dedupeImages([...nextImages, ...uploadedImages]).slice(
      0,
      MAX_ITEM_IMAGES
    );
  }

  if (!nextImages.length) {
    res.status(400);
    throw new Error("At least one image is required");
  }

  const removedImages = currentImages.filter(
    (url) => !nextImages.includes(url)
  );
  if (removedImages.length) {
    await Promise.all(removedImages.map((url) => deleteFromCloudinary(url)));
  }

  item.images = nextImages;
  item.image = nextImages[0];

  if (name) item.name = name;
  if (description) item.description = description;
  if (price) item.price = price;
  if (category) item.category = category;

  const ingredientImages = req.files?.ingredientImage || [];
  const hasIngredients = typeof ingredients !== "undefined";
  let nextIngredients = hasIngredients ? parseIngredients(ingredients) : null;

  if (ingredientImages.length) {
    const baseIngredients = (nextIngredients ?? item.ingredients).map(
      (ingredient) =>
        typeof ingredient.toObject === "function"
          ? ingredient.toObject()
          : ingredient
    );
    nextIngredients = await attachIngredientImages(
      baseIngredients,
      ingredientImages
    );
  }

  if (nextIngredients) item.ingredients = nextIngredients;
  if (req.body.availableDays !== undefined) {
    try {
      item.availableDays = parseAvailableDays(req.body.availableDays);
    } catch (error) {
      res.status(400);
      throw error;
    }
  }
  if (req.body.specialDays !== undefined) {
    try {
      item.specialDays = parseSpecialDays(req.body.specialDays);
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

  const imagesToDelete = getExistingItemImages(item);
  if (imagesToDelete.length) {
    await Promise.all(imagesToDelete.map((url) => deleteFromCloudinary(url)));
  }
  await item.deleteOne();

  sendSuccess(res, null, "Item deleted and image removed from Cloudinary");
});
