import express from "express";
import {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  reduceCartQuantity,
} from "../controllers/cart.controller.js";

const router = express.Router();

router.post("/add", addToCart);
router.get("/:userId", getCart);
router.put("/update", updateCartItem);
router.delete("/remove", removeCartItem);
router.delete("/clear/:userId", clearCart);
router.put("/reduce", reduceCartQuantity);

export default router;
