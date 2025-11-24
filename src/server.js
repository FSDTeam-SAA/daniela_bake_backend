import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();
connectDB();

const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*", methods: ["GET","POST"] }
});

// make io available in controllers (req.io)
import express from "express";
app.use((req, _res, next) => { req.io = io; next(); });

// socket auth is minimal here (pass userId after login)
io.on("connection", (socket) => {
  socket.on("join", (room) => {
    socket.join(room);
  }
);
  socket.on("disconnect", () => {});
});

server.listen(port, () => console.log(`🚀 Server listening on http://localhost:${port}`));
