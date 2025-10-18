import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import router from "./router.js"; // ✅ import the main router

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("BakeHouse Backend API is running...");
});

app.use("/api/v1", router);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
