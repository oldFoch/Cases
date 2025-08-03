const express = require("express");
const User = require("../models/User");
const WithdrawRequest = require("../models/WithdrawRequest");
const Transaction = require("../models/Transaction");
const auth = require("../middleware/auth");

const router = express.Router();

// 🔹 Получить текущего пользователя
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Пополнить баланс
router.post("/add-balance", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const user = await User.findById(req.user.id);
    user.balance += amount;
    await user.save();

    // Логируем транзакцию
    await Transaction.create({
      userId: user._id,
      type: "deposit",
      amount
    });

    res.json({ message: "✅ Balance updated", balance: user.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Получить инвентарь
router.get("/inventory", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("inventory");
    res.json({ inventory: user.inventory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Продажа предмета
router.post("/sell-item", auth, async (req, res) => {
  try {
    const { itemName } = req.body;
    const user = await User.findById(req.user.id);
    const index = user.inventory.findIndex(item => item.name === itemName);
    if (index === -1) return res.status(404).json({ error: "Item not found" });

    const soldItem = user.inventory[index];
    user.inventory.splice(index, 1);
    user.balance += soldItem.price;
    await user.save();

    // Логируем продажу
    await Transaction.create({
      userId: user._id,
      type: "sell",
      amount: soldItem.price,
      item: soldItem
    });

    res.json({ message: "✅ Item sold", item: soldItem, newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Запрос на вывод
router.post("/withdraw", auth, async (req, res) => {
  try {
    const { itemName } = req.body;
    const user = await User.findById(req.user.id);
    const index = user.inventory.findIndex(item => item.name === itemName);
    if (index === -1) return res.status(404).json({ error: "Item not in inventory" });

    const item = user.inventory[index];
    user.inventory.splice(index, 1);
    await user.save();

    const request = await WithdrawRequest.create({
      userId: user._id,
      item
    });

    // Логируем вывод
    await Transaction.create({
      userId: user._id,
      type: "withdraw",
      item
    });

    res.json({ message: "✅ Withdraw request created", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Заявки на вывод
router.get("/withdrawals", auth, async (req, res) => {
  try {
    const requests = await WithdrawRequest.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ withdrawals: requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 История операций
router.get("/history", auth, async (req, res) => {
  try {
    const history = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
