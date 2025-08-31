'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../../db');
const auth    = require('../../middleware/auth'); // если у тебя другой — поправь путь

// без кеша
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// списать ставку
router.post('/bet', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const amount = Math.floor(Number(req.body.amount) || 0);
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const bal = Number(u.rows[0].balance) || 0;
    if (bal < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const newBal = Number((bal - amount).toFixed(2));
    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBal, userId]);
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, created_at)
       VALUES ($1,'plinko_bet',$2,NOW())`,
      [userId, -amount]
    );

    await client.query('COMMIT');
    res.json({ ok: true, balance: newBal });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// начислить выигрыш
router.post('/settle', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const amount = Math.floor(Number(req.body.amount) || 0);
    const coeff  = Number(req.body.coeff) || 0;
    const slot   = Number(req.body.slot) || 0;
    if (!amount || amount <= 0 || coeff <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid settle params' });
    }

    const win = Number((amount * coeff).toFixed(2));

    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const bal = Number(u.rows[0].balance) || 0;
    const newBal = Number((bal + win).toFixed(2));

    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBal, userId]);
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, item_case_name, created_at)
       VALUES ($1,'plinko_win',$2,$3,NOW())`,
      [userId, win, `slot_${slot}`]
    );

    await client.query('COMMIT');
    res.json({ ok: true, balance: newBal });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
