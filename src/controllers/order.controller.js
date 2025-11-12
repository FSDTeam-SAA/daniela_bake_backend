import asyncHandler from "express-async-handler";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import { sendSuccess } from "../utils/response.js";

/**
 * @desc Create order from cart
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { userId, address, phone } = req.body;

  const cart = await Cart.findOne({ user: userId }).populate("items.item");
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  const order = await Order.create({
    user: userId,
    items: cart.items.map((i) => ({
      item: i.item._id,
      quantity: i.quantity,
    })),
    totalAmount: cart.total,
    address,
    phone,
  });

  // Clear cart after placing order
  cart.items = [];
  cart.total = 0;
  await cart.save();

  res.status(201);
  sendSuccess(res, order, "Order created successfully");
});

/**
 * @desc Get all orders (filter, pagination, sort)
 */
export const getOrders = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, sort = "-createdAt", status, user } = req.query;
  const query = {};
  if (status) query.status = status;
  if (user) query.user = user;

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("user", "name email")
    .populate("items.item", "name price image")
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  sendSuccess(
    res,
    {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      orders,
    },
    "Orders retrieved successfully"
  );
});

/**
 * @desc Get order by ID
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email")
    .populate("items.item", "name price image");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  sendSuccess(res, order, "Order retrieved successfully");
});

/**
 * @desc Update order status/payment
 */
export const updateOrder = asyncHandler(async (req, res) => {
  const { status, paymentStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;

  const updated = await order.save();
  sendSuccess(res, updated, "Order updated successfully");
});

/**
 * @desc Delete order
 */
export const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  await order.deleteOne();
  sendSuccess(res, null, "Order deleted successfully");
});
