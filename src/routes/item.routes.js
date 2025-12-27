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
  .post(
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "ingredientImage", maxCount: 20 },
    ]),
    createItem
  );

router.route("/:id")
  .get(getItemById)
  .put(
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "ingredientImage", maxCount: 20 },
    ]),
    updateItem
  )
  .delete(deleteItem);

export default router;
