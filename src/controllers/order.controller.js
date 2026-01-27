import asyncHandler from "express-async-handler";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Item from "../models/item.model.js";
import { sendSuccess } from "../utils/response.js";

const getRangeBounds = (timeRange = "all") => {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  switch (timeRange) {
    case "day":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "week": {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 7);
      end.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(start.getFullYear() + 1, 0, 1);
      end.setHours(0, 0, 0, 0);
      break;
    default:
      return { start: null, end: null };
  }

  return { start, end };
};

const calculateCartTotal = async (items = []) => {
  let total = 0;
  for (const { item, quantity } of items) {
    const product = await Item.findById(item);
    if (product) {
      total += product.price * quantity;
    }
  }
  return total;
};

/**
 * @desc Create order from cart
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { userId, address, phone, scheduledFor, pickOrder } = req.body;

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
    pickOrder: Boolean(pickOrder),
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
  let {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    status,
    user,
    paymentStatus,
    timeRange,
  } = req.query;

  const filters = [];
  if (status) filters.push({ status });
  if (user) filters.push({ user });
  if (paymentStatus) filters.push({ paymentStatus });

  const normalizedRange = timeRange?.toString().toLowerCase();
  if (normalizedRange && normalizedRange !== "all") {
    const { start, end } = getRangeBounds(normalizedRange);
    if (start && end) {
      filters.push({ createdAt: { $gte: start, $lt: end } });
    }
  }

  const query = filters.length ? { $and: filters } : {};

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("user", "name email")
    .populate("items.item", "name description price image images")
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
  const { status, paymentStatus, pickOrder } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  // allow toggling between pickup and delivery
  if (typeof pickOrder === "boolean") {
    order.pickOrder = pickOrder;
  }

  const updated = await order.save();
  sendSuccess(res, updated, "Order updated successfully");
});

/**
 * @desc Reorder: add items from an existing order back into the user's cart
 * @route POST /api/v1/orders/:id/reorder
 */
export const reorderOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const order = await Order.findById(id).populate("items.item", "_id");
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const targetUserId = userId || order.user?.toString?.();
  if (!targetUserId) {
    res.status(400);
    throw new Error("User ID is required to reorder");
  }

  let cart = await Cart.findOne({ user: targetUserId });
  if (!cart) {
    cart = new Cart({ user: targetUserId, items: [], total: 0 });
  }

  for (const orderItem of order.items || []) {
    if (!orderItem?.item?._id) continue;
    const itemId = orderItem.item._id.toString();
    const qty = orderItem.quantity || 1;

    const existing = cart.items.find((i) => i.item.toString() === itemId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.items.push({ item: itemId, quantity: qty });
    }
  }

  cart.total = await calculateCartTotal(cart.items);
  await cart.save();

  sendSuccess(res, cart, "Order items added to cart");
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
