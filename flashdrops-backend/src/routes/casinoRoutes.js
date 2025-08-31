'use strict';

const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Конфиги coinflip — как на фронте
const CF = {
  easy:   { payout: 1.10, winChance: 0.40 },
  medium: { payout: 1.35, winChance: 0.20 },
  hard:   { payout: 1.50, winChance: 0.07 }
};

const n2 = v => Math.round((Number(v) || 0) * 100) / 100;

/**
 * POST /api/casino/coinflip/play
 * { bet, mode, choice }  choice: 'heads'|'tails'
 * Возвращает: { ok, outcome, landed, payout, delta, balance }
 */
router.post('/coinflip/play', auth, async (req, res) => {
  const userId = req.user.id;
  const bet = n2(req.body?.bet);
  const mode = String(req.body?.mode || 'easy').toLowerCase();
  const choice = req.body?.choice === 'tails' ? 'tails' : 'heads';

  const cfg = CF[mode] || CF.easy;
  if (bet <= 0) return res.status(400).json({ error: 'Invalid bet' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rowCount) throw new Error('User not found');
    const balance = n2(u.rows[0].balance);

    // Разыгрываем исход
    const win = Math.random() < cfg.winChance;
    const landed = win ? choice : (choice === 'heads' ? 'tails' : 'heads');
    // delta: если win → +bet*(payout-1), если lose → -bet
    const delta = win ? n2(bet * (cfg.payout - 1)) : -bet;
    const newBalance = n2(balance + delta);

    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBalance, userId]);
    await client.query(
      `INSERT INTO transactions (user_id,type,amount,created_at,meta)
       VALUES ($1,'coinflip',$2,NOW(),$3::jsonb)`,
      [userId, delta, JSON.stringify({ bet, mode, payout: cfg.payout, choice, landed, result: win ? 'win' : 'lose' })]
    );

    await client.query('COMMIT');
    res.json({
      ok: true,
      outcome: win ? 'win' : 'lose',
      landed,
      payout: cfg.payout,
      delta,
      balance: newBalance
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/casino/towers/cashout
 * { bet, mult } → delta=bet*(mult-1)
 */
router.post('/towers/cashout', auth, async (req, res) => {
  const userId = req.user.id;
  const bet = n2(req.body?.bet);
  const mult = Number(req.body?.mult) || 1;
  if (bet <= 0 || mult <= 1) return res.status(400).json({ error: 'Invalid params' });

  const delta = n2(bet * (mult - 1));

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rowCount) throw new Error('User not found');
    const balance = n2(u.rows[0].balance);
    const newBalance = n2(balance + delta);

    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBalance, userId]);
    await client.query(
      `INSERT INTO transactions (user_id,type,amount,created_at,meta)
       VALUES ($1,'towers_cashout',$2,NOW(),$3::jsonb)`,
      [userId, delta, JSON.stringify({ bet, mult })]
    );

    await client.query('COMMIT');
    res.json({ ok: true, balance: newBalance, delta });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/casino/towers/lose
 * { bet } → delta=-bet
 */
router.post('/towers/lose', auth, async (req, res) => {
  const userId = req.user.id;
  const bet = n2(req.body?.bet);
  if (bet <= 0) return res.status(400).json({ error: 'Invalid bet' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rowCount) throw new Error('User not found');
    const balance = n2(u.rows[0].balance);

    const delta = -bet;
    const newBalance = n2(balance + delta);

    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [newBalance, userId]);
    await client.query(
      `INSERT INTO transactions (user_id,type,amount,created_at,meta)
       VALUES ($1,'towers_lose',$2,NOW(),$3::jsonb)`,
      [userId, delta, JSON.stringify({ bet })]
    );

    await client.query('COMMIT');
    res.json({ ok: true, balance: newBalance, delta });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
