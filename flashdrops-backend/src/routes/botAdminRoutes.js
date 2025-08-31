'use strict';
const express = require('express');
const db = require('../db');
const admin = require('../middleware/admin');

const router = express.Router();

/** Создать бота */
router.post('/bots', admin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const steamId = req.body?.steam_id ? String(req.body.steam_id) : null;
    if (!name) return res.status(400).json({ error: 'name required' });

    const { rows } = await db.query(
      `INSERT INTO bots (name, steam_id, is_active)
       VALUES ($1,$2,TRUE)
       RETURNING id, name, steam_id, is_active, created_at`,
      [name, steamId]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Список ботов */
router.get('/bots', admin, async (_req, res) => {
  try {
    const { rows } = await db.query(`SELECT id, name, steam_id, is_active, created_at FROM bots ORDER BY id`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Актив/деактив бот */
router.post('/bots/:id/toggle', admin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE bots SET is_active = NOT is_active WHERE id=$1 RETURNING id, name, is_active`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Bot not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Массово добавить на склад (qty штук одного item_master_id выбранному боту) */
router.post('/bots/:id/stock/add', admin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const botId = Number(req.params.id);
    const itemMasterId = Number(req.body?.item_master_id);
    const qty = Math.max(1, Math.min(10_000, Number(req.body?.qty || 1)));

    if (!botId || !itemMasterId || !qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'bot_id, item_master_id, qty required' });
    }

    // проверим, что бот существует и активен/существует
    const b = await client.query(`SELECT id FROM bots WHERE id=$1`, [botId]);
    if (!b.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Bot not found' }); }

    // массовая вставка
    const values = [];
    for (let i = 0; i < qty; i++) {
      values.push(`(${botId}, ${itemMasterId})`);
    }
    await client.query(
      `INSERT INTO bot_inventory (bot_id, item_master_id) VALUES ${values.join(',')}`
    );

    await client.query('COMMIT');
    res.json({ ok: true, added: qty });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/** Остатки по item_master_id (сумма по ботам) */
router.get('/stock/summary/:item_master_id', admin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT state, COUNT(*)::int AS count
         FROM bot_inventory
        WHERE item_master_id=$1
        GROUP BY state
        ORDER BY state`,
      [req.params.item_master_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
