const express = require("express");
const passport = require("../passport");   // Импортируем наш конфигурированный passport
const router = express.Router();

// 🔗 Инициация входа через Steam
router.get(
  "/steam",
  passport.authenticate("steam", { failureRedirect: process.env.FRONTEND_URL || "/" })
);

// 🔗 Callback от Steam
router.get(
  "/steam/return",
  passport.authenticate("steam", { failureRedirect: process.env.FRONTEND_URL || "/" }),
  (req, res) => {
    // После успешного логина редиректим на фронтенд
    res.redirect(`${process.env.FRONTEND_URL || "/"}profile`);
  }
);

// 🔗 Получить данные текущего пользователя
router.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    return res.json(req.user);
  }
  res.status(401).json({ error: "Not authenticated" });
});

// 🔗 Выход из сессии
router.get("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    // Очистим сессионную куку
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ message: "✅ Logged out" });
  });
});

module.exports = router;
