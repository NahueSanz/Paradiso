process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED REJECTION:", err);
});

import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";
import router from "./routes";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "https://paradiso-nine.vercel.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Club-Id"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((req, _res, next) => {
  console.log("➡️", req.method, req.path);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log("REQ:", req.method, req.path);
  next();
});

app.use("/api", router);

app.use(errorHandler);

export default app;
