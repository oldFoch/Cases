'use strict';

const express = require('express');
const router = express.Router();

/**
 * /api/upgrade/spin
 * Возвращает индекс сектора (0..36 или сколько у тебя на фронте) и кол-во полных оборотов.
 * Сейчас — простой рандом, как в твоём примере.
 */
router.get('/spin', (_req, res) => {
  const SEGMENTS = 37;                                // фронт крутит 37 сегментов
  const targetIndex = Math.floor(Math.random() * SEGMENTS); // 0..36
  const extraTurns = Math.floor(Math.random() * 2) + 3;     // 3..4 полных оборота
  res.json({ targetIndex, extraTurns });
});

module.exports = router;
