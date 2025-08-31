'use strict';

const express = require('express');
const db = require('../../db');                  // ← путь из /routes/casino/
const auth = require('../../middleware/auth');   // ← путь из /routes/casino/
const router = express.Router();

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.floor(x)); // целые рубли
}

/**
 * POST /api/casino/towers/start
 * body: { bet }
 * Списывает ставку из баланса.
 */
router.post('/start', auth, async (req, res) => {
  const userId = req.user?.id;
  const bet = money(req.body?.bet);

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (bet <= 0) return res.status(400).json({ error: 'Invalid bet' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rowCount) throw new Error('User not found');

    const balance = Number(u.rows[0].balance || 0);
    if (balance < bet) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const newBalance = money(balance - bet);
    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBalance, userId]);

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, created_at)
       VALUES ($1,'towers_bet',$2,NOW())`,
      [userId, -bet]
    );

    await client.query('COMMIT');
    res.json({ ok: true, balance: newBalance });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/casino/towers/cashout
 * body: { bet, mult }
 * Начисляет выплату = ставка × множитель.
 */
router.post('/cashout', auth, async (req, res) => {
  const userId = req.user?.id;
  const bet = money(req.body?.bet);
  const mult = Number(req.body?.mult) || 1;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (bet <= 0 || !Number.isFinite(mult) || mult <= 0) {
    return res.status(400).json({ error: 'Invalid cashout params' });
  }

  const payout = money(bet * mult);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rowCount) throw new Error('User not found');

    const balance = Number(u.rows[0].balance || 0);
    const newBalance = money(balance + payout);

    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBalance, userId]);

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, created_at)
       VALUES ($1,'towers_cashout',$2,NOW())`,
      [userId, payout]
    );

    await client.query('COMMIT');
    res.json({ ok: true, balance: newBalance, payout });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
