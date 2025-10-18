import express from "express";
import { addFavorite, getFavorites, removeFavorite } from "../controllers/favorite.controller.js";

const router = express.Router();

router.post("/", addFavorite);
router.get("/:userId", getFavorites);
router.delete("/", removeFavorite);

export default router;
