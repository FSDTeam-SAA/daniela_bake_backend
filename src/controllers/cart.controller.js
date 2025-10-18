import asyncHandler from "express-async-handler";
import Cart from "../models/cart.model.js";
import Item from "../models/item.model.js";

/**
 * @desc Add item to cart
 */
export const addToCart = asyncHandler(async (req, res) => {
  const { userId, itemId, quantity } = req.body;

  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [], total: 0 });
  }

  const item = await Item.findById(itemId);
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }

  const existingItem = cart.items.find((i) => i.item.toString() === itemId);
  if (existingItem) {
    existingItem.quantity += quantity || 1;
  } else {
    cart.items.push({ item: itemId, quantity });
  }

  // recalculate total
  cart.total = await calculateCartTotal(cart.items);

  await cart.save();
  res.status(200).json(cart);
});

/**
 * @desc Get user's cart
 */
export const getCart = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const cart = await Cart.findOne({ user: userId }).populate("items.item", "name price image");
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }
  res.json(cart);
});

/**
 * @desc Update item quantity
 */
export const updateCartItem = asyncHandler(async (req, res) => {
  const { userId, itemId, quantity } = req.body;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  const item = cart.items.find((i) => i.item.toString() === itemId);
  if (!item) {
    res.status(404);
    throw new Error("Item not in cart");
  }

  item.quantity = quantity;
  cart.total = await calculateCartTotal(cart.items);
  await cart.save();
  res.json(cart);
});

/**
 * @desc Remove item from cart
 */
export const removeCartItem = asyncHandler(async (req, res) => {
  const { userId, itemId } = req.body;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  cart.items = cart.items.filter((i) => i.item.toString() !== itemId);
  cart.total = await calculateCartTotal(cart.items);

  await cart.save();
  res.json(cart);
});

/**
 * @desc Clear cart
 */
export const clearCart = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  cart.items = [];
  cart.total = 0;
  await cart.save();

  res.json({ message: "Cart cleared successfully" });
});

// Helper to recalc total
const calculateCartTotal = async (items) => {
  let total = 0;
  for (const { item, quantity } of items) {
    const product = await Item.findById(item);
    if (product) total += product.price * quantity;
  }
  return total;
};
