const express = require("express");
const Case = require("../models/Case");

const router = express.Router();

// Получить все кейсы
router.get("/", async (req, res) => {
  try {
    const cases = await Case.find();
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить кейс по ID
router.get("/:id", async (req, res) => {
  try {
    const foundCase = await Case.findById(req.params.id);
    if (!foundCase) return res.status(404).json({ error: "Case not found" });
    res.json(foundCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
