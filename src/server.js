import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();
connectDB();

const port = process.env.PORT || 3000;
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Socket origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.use((req, _res, next) => { req.io = io; next(); });

// socket auth is minimal here (pass userId after login)
io.on("connection", (socket) => {
  socket.on("join", (room) => {
    socket.join(room);
  });
  socket.on("disconnect", () => {});
});

server.listen(port, () => console.log(`🚀 Server listening on http://localhost:${port}`));
