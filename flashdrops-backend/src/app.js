const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const passport = require("./passport");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const caseRoutes = require("./routes/caseRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// 🔐 Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.JWT_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "none",                   // позволяет шлать cookie в кросс-домене
      secure: process.env.NODE_ENV === "production", // в dev-режиме ставим false
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// 🔗 Роуты
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cases", caseRoutes);   // публичные кейсы
app.use("/api/admin", adminRoutes);  // админ-эндпоинты, в том числе POST /cases

// 📦 Подключение к MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 🚀 Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FlashDrops API is running on port ${PORT}`);
});
