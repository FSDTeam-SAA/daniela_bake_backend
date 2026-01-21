import express from "express";
import {
  createOrder,
  getOrders,
  getMyOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  reorderOrder,
} from "../controllers/order.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/my", protect, getMyOrders);
router.post("/:id/reorder", reorderOrder);
router.get("/:id", getOrderById);
router.put("/:id", updateOrder);
router.delete("/:id", deleteOrder);

export default router;
 
