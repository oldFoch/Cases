'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

/* helper: текущий пользователь */
function getUserId(req) {
  return req.session?.passport?.user?.id || req.user?.id || null;
}

/* GET /api/users/me — профиль + инвентарь */
router.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    const u = await db.query(
      `SELECT id, username, avatar, balance::numeric(12,2) AS balance,
              is_admin AS is_admin
         FROM users
        WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!u.rowCount) return res.status(404).json({ error: 'Пользователь не найден' });

    // инвентарь: маппим под формат Profile.jsx
    const inv = await db.query(
      `SELECT
          ui.id,
          ui.item_master_id,
          (ui.price_minor/100.0)::numeric(12,2) AS price,
          ui.won_at,
          ui.is_sold,
          ui.withdraw_state,
          ui.withdraw_meta,
          im.market_hash_name AS name,
          im.image
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_master_id
      WHERE ui.user_id = $1
      ORDER BY ui.won_at DESC, ui.id DESC`,
      [userId]
    );

    const inventory = inv.rows.map(r => ({
      id: r.id,
      name: r.name,
      image: r.image,
      price: r.price,                 // Profile.jsx читает price
      won_at: r.won_at,               // Profile.jsx использует won_at || wonAt
      is_sold: r.is_sold,
      withdraw_state: r.withdraw_state || 'none',
      withdraw_meta: r.withdraw_meta || null
    }));

    res.json({
      ...u.rows[0],
      inventory
    });
  } catch (e) {
    console.error('[GET /api/users/me]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* GET /api/users/balance — баланс (Profile.jsx дергает как фолбэк) */
router.get('/balance', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    const q = await db.query(
      `SELECT balance::numeric(12,2) AS balance FROM users WHERE id = $1`,
      [userId]
    );
    res.json({ balance: Number(q.rows[0]?.balance || 0) });
  } catch (e) {
    console.error('[GET /api/users/balance]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* PATCH /api/users/tradeurl — сохранить Steam trade URL (Profile.jsx) */
router.patch('/tradeurl', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    const tradeUrl = String(req.body?.trade_url || '').trim();
    if (!/^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=/.test(tradeUrl)) {
      return res.status(400).json({ error: 'Некорректная Steam trade URL' });
    }

    await db.query(
      `UPDATE users SET trade_url = $1 WHERE id = $2`,
      [tradeUrl, userId]
    );
    res.json({ ok: true, trade_url: tradeUrl });
  } catch (e) {
    console.error('[PATCH /api/users/tradeurl]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* POST /api/users/inventory/:id/sell — продать предмет (Profile.jsx) */
router.post('/inventory/:id/sell', async (req, res) => {
  const client = await db.getClient();
  try {
    const userId = getUserId(req);
    if (!userId) {
      client.release();
      return res.status(401).json({ error: 'Вы не авторизованы' });
    }

    const invId = Number(req.params.id);
    if (!invId) {
      client.release();
      return res.status(400).json({ error: 'Некорректный id' });
    }

    await client.query('BEGIN');

    const row = await client.query(
      `SELECT user_id, price_minor, is_sold
         FROM user_inventory
        WHERE id = $1 FOR UPDATE`,
      [invId]
    );
    if (!row.rowCount) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    const rec = row.rows[0];
    if (Number(rec.user_id) !== Number(userId)) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ error: 'Чужой предмет' });
    }
    if (rec.is_sold) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Уже продан' });
    }

    const add = Number(rec.price_minor || 0) / 100.0;

    await client.query(
      `UPDATE user_inventory SET is_sold = true WHERE id = $1`,
      [invId]
    );
    const bal = await client.query(
      `UPDATE users SET balance = balance + $1::numeric WHERE id = $2 RETURNING balance::numeric(12,2) AS balance`,
      [add, userId]
    );

    await client.query('COMMIT');
    client.release();

    res.json({
      ok: true,
      balance: Number(bal.rows[0]?.balance || 0),
      balance_added: add
    });
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch {}
    try { client.release(); } catch {}
    console.error('[POST /api/users/inventory/:id/sell]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
