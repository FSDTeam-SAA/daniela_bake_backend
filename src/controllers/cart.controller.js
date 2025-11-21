import asyncHandler from "express-async-handler";
import Cart from "../models/cart.model.js";
import Item from "../models/item.model.js";
import { sendSuccess } from "../utils/response.js";

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
  res.status(200);
  sendSuccess(res, cart, "Item added to cart");
});

/**
 * @desc Get user's cart
 */
export const getCart = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const cart = await Cart.findOne({ user: userId }).populate("items.item", "name description price image");
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }
  sendSuccess(res, cart, "Cart retrieved successfully");
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
  sendSuccess(res, cart, "Cart item updated successfully");
});

/**
 * @desc Reduce cart item quantity by 1
 */
export const reduceCartQuantity = asyncHandler(async (req, res) => {
  const { userId, itemId } = req.body;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  const cartItem = cart.items.find((i) => i.item.toString() === itemId);
  if (!cartItem) {
    res.status(404);
    throw new Error("Item not in cart");
  }

  // Reduce quantity
  if (cartItem.quantity > 1) {
    cartItem.quantity -= 1;
  } else {
    // If quantity would go below 1 → remove item
    cart.items = cart.items.filter((i) => i.item.toString() !== itemId);
  }

  // Recalculate total
  cart.total = await calculateCartTotal(cart.items);
  await cart.save();

  sendSuccess(res, cart, "Item quantity reduced successfully");
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
  sendSuccess(res, cart, "Cart item removed successfully");
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

  sendSuccess(res, null, "Cart cleared successfully");
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
