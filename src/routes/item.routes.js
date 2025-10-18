import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
} from "../controllers/item.controller.js";

const router = express.Router();

router.route("/")
  .get(getItems)
  .post(upload.single("image"), createItem);

router.route("/:id")
  .get(getItemById)
  .put(upload.single("image"), updateItem)
  .delete(deleteItem);

export default router;
