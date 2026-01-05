import asyncHandler from "express-async-handler";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import { sendSuccess } from "../utils/response.js";

/**
 * @desc Create order from cart
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { userId, address, phone, scheduledFor } = req.body;

  const cart = await Cart.findOne({ user: userId }).populate("items.item");
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  // Filter out cart entries whose referenced items were removed or deleted
  const validCartItems = cart.items.filter((cartItem) => Boolean(cartItem.item));
  if (validCartItems.length === 0) {
    cart.items = [];
    cart.total = 0;
    await cart.save();
    res.status(400);
    throw new Error(
      "Cart items are no longer available. Please add new items to proceed."
    );
  }

  const totalAmount = validCartItems.reduce(
    (sum, cartItem) => sum + cartItem.item.price * cartItem.quantity,
    0
  );

  let scheduledDate;
  if (scheduledFor) {
    const parsedDate = new Date(scheduledFor);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400);
      throw new Error("Invalid scheduledFor date");
    }

    const now = new Date();
    if (parsedDate.getTime() < now.getTime()) {
      res.status(400);
      throw new Error("Scheduled date must be in the future");
    }

    scheduledDate = parsedDate;
  }

  const order = await Order.create({
    user: userId,
    items: validCartItems.map((cartItem) => ({
      item: cartItem.item._id,
      quantity: cartItem.quantity,
    })),
    totalAmount,
    address,
    phone,
    ...(scheduledDate && { scheduledFor: scheduledDate }),
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
    .populate("items.item", "name description price image")
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
 * @desc Get orders for the authenticated user with optional filter shortcuts
 * @route GET /api/v1/orders/my?filter=ongoing
 */
export const getMyOrders = asyncHandler(async (req, res) => {
  const { filter, page = 1, limit = 10, sort = "-createdAt" } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const userId = req.user?._id;
  if (!userId) {
    res.status(401);
    throw new Error("Not authorized");
  }

  const filterMap = {
    ongoing: ["Pending", "Processing"],
    completed: ["Delivered"],
  };

  const query = { user: userId };
  if (filter && filterMap[filter]) {
    const statuses = filterMap[filter];
    query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  } else if (filter) {
    query.status = filter;
  }

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("items.item", "name description price image")
    .sort(sort)
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  sendSuccess(
    res,
    {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      orders,
    },
    "User orders retrieved successfully"
  );
});

/**
 * @desc Get order by ID
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email")
    .populate("items.item", "name description price image");

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
