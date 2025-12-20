import express from "express";
import { getDashboardOverview } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/overview", getDashboardOverview);

export default router;
