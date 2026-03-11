require("dotenv").config();
const fs = require("fs");
if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);

app.set("trust proxy", 1);

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://campuscopy.pages.dev",
  "https://campuscopy.vercel.app",
];

const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected: " + socket.id);
  socket.on("join_job",     (jobId)     => socket.join("job:"     + jobId));
  socket.on("join_printer", (printerId) => socket.join("printer:" + printerId));
  socket.on("disconnect",   ()          => console.log("Socket disconnected: " + socket.id));
});

app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
}));

app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." },
}));

app.use("/api/auth",     require("./routes/auth"));
app.use("/api/jobs",     require("./routes/jobs"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/printers", require("./routes/printers"));
app.use("/api/coupons",  require("./routes/coupons"));
app.use("/api/loyalty",  require("./routes/loyalty"));

app.get("/health", (req, res) => res.json({ status: "ok", time: new Date() }));
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

require("./config/db");
require("./config/redis");

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log("CampusCopy API running on port " + PORT);
});