import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import router from "./router.js"; // ✅ import the main router

dotenv.config();

const app = express();

const devOrigins = ["http://localhost:3000", "http://localhost:3001"];
const prodOrigins = ["https://admin.danielabakehousebakery.com"];
const allowedOrigins = [
  ...new Set(
    [
      ...devOrigins,
      ...prodOrigins,
      ...(process.env.CLIENT_ORIGIN || "").split(","),
    ]
      .map((origin) => origin.trim())
      .filter(Boolean)
  ),
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
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
