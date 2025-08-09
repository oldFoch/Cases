// flashdrops-backend/src/routes/userRoutes.js

const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db');
const router = express.Router();

/**
 * GET /api/users/me
 * Профиль + инвентарь
 */
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const profileRes = await db.query(
      'SELECT id, steam_id, username, avatar, balance, is_admin FROM users WHERE id = $1',
      [userId]
    );
    if (!profileRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const profile = profileRes.rows[0];

    const invRes = await db.query(
      `SELECT id, name, image, price_current AS price, won_at, is_sold
         FROM user_inventory
        WHERE user_id = $1
        ORDER BY won_at DESC`,
      [userId]
    );

    res.json({ ...profile, inventory: invRes.rows });
  } catch (err) {
    console.error('GET /api/users/me error', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users/inventory/:invId/sell
 * Продажа предмета из инвентаря
 */
router.post('/inventory/:invId/sell', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const invId  = Number(req.params.invId);
    if (!Number.isInteger(invId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid inventory id' });
    }

    const feePct = Number(process.env.SELL_FEE_PERCENT || 20);

    // Берём предмет
    const itemRes = await client.query(
      `SELECT id, user_id, price_current, is_sold
         FROM user_inventory
        WHERE id = $1 FOR UPDATE`,
      [invId]
    );
    if (!itemRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = itemRes.rows[0];
    if (item.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (item.is_sold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already sold' });
    }

    // Сумма продажи (округляем до 2 знаков)
    const rawAmount = Number(item.price_current) * (1 - feePct / 100);
    const sellAmount = Math.round(rawAmount * 100) / 100; // число, не строка

    // Баланс пользователя
    const balRes = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const curBalance = Number(balRes.rows[0].balance) || 0;
    const newBalance = Math.round((curBalance + sellAmount) * 100) / 100;

    await client.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // Помечаем предмет проданным
    await client.query(
      `UPDATE user_inventory
          SET is_sold = TRUE,
              sold_at = NOW()
        WHERE id = $1`,
      [invId]
    );

    // Транзакция продажи (amount NUMERIC(12,2))
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, created_at)
       VALUES ($1, 'sell', $2, NOW())`,
      [userId, sellAmount]
    );

    await client.query('COMMIT');
    res.json({ balance: newBalance, soldItemId: invId, amount: sellAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sell item error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
