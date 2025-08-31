'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../../middleware/auth');

// ——— Локальные настройки Dice (должны совпадать с фронтом)
const CFG = {
  minBet: 1,
  maxBet: 100000,
  minTarget: 2,
  maxTarget: 98,
  houseEdge: 0.05, // 5%
};

// расчёт payout как на фронте
function calcPayout(dir, target, houseEdge) {
  const p = dir === 'over' ? (100 - target) / 100 : target / 100;
  if (p <= 0) return 0;
  const raw = (1 / p) * (1 - houseEdge);
  return Math.max(1.01, Math.round(raw * 100) / 100);
}

// безопасный парсер числа
function n2(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/**
 * POST /api/casino/dice/roll
 * body: { bet, target, dir: 'over'|'under' }
 */
router.post('/roll', auth, async (req, res) => {
  const userId = req.user?.id;
  try {
    // ---- валидация входа
    let bet = n2(req.body?.bet);
    let target = Math.round(n2(req.body?.target));
    const dir = String(req.body?.dir || 'over').toLowerCase(); // 'over'|'under'

    if (!['over', 'under'].includes(dir)) {
      return res.status(400).json({ error: 'Invalid direction' });
    }
    if (bet < CFG.minBet || bet > CFG.maxBet) {
      return res.status(400).json({ error: `Bet must be ${CFG.minBet}..${CFG.maxBet}` });
    }
    if (target < CFG.minTarget) target = CFG.minTarget;
    if (target > CFG.maxTarget) target = CFG.maxTarget;

    // ---- вытащим баланс
    const u = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
    if (!u.rows.length) return res.status(404).json({ error: 'User not found' });

    const balance = n2(u.rows[0].balance);
    if (balance < bet) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // ---- считаем payout
    const payout = calcPayout(dir, target, CFG.houseEdge);
    if (payout <= 0) return res.status(400).json({ error: 'Invalid payout' });

    // ---- генерим ролл (0..100)
    const roll = Math.floor(Math.random() * 101);
    const win = dir === 'over' ? (roll > target) : (roll < target);

    // ---- транзакция денег
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // списываем ставку
      const newAfterBet = n2(balance - bet);
      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newAfterBet, userId]);
      await client.query(
        `INSERT INTO transactions
           (user_id, type, amount, item_case_name, created_at)
         VALUES ($1,'casino_dice_bet',$2,'Dice',NOW())`,
        [userId, -bet]
      );

      let finalBalance = newAfterBet;

      if (win) {
        const winAmount = Math.round(bet * payout * 100) / 100;
        finalBalance = n2(newAfterBet + winAmount);
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [finalBalance, userId]);
        await client.query(
          `INSERT INTO transactions
             (user_id, type, amount, item_case_name, created_at)
           VALUES ($1,'casino_dice_win',$2,'Dice',NOW())`,
          [userId, winAmount]
        );
      }

      await client.query('COMMIT');

      return res.json({
        ok: true,
        roll,
        win,
        payout,
        balance: finalBalance
      });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

module.exports = router;
