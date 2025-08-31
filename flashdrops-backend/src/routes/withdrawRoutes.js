'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const { reserveOne, markSent, unreserve } = require('../services/botStockService');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * POST /api/withdraw/:inventoryId/reserve
 */
router.post('/:inventoryId/reserve', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const invId = Number(req.params.inventoryId);
    const userId = req.user.id;

    const inv = await client.query(
      `SELECT id, user_id, item_master_id, is_sold, withdraw_state
         FROM user_inventory
        WHERE id=$1
        FOR UPDATE`,
      [invId]
    );
    if (!inv.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
    const it = inv.rows[0];

    if (it.user_id !== userId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Forbidden' }); }
    if (it.is_sold)            { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already sold' }); }
    if (!it.item_master_id)    { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No master item link' }); }
    if (it.withdraw_state && it.withdraw_state !== 'none') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already reserved or sent' });
    }

    // резерв в стоке бота
    const bi = await reserveOne(client, userId, it.item_master_id);
    if (!bi) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No stock' });
    }

    // НОРМАЛИЗОВАННЫЙ ID
    const botItemId = bi.id ?? bi.bot_item_id ?? bi.botId;
    if (!botItemId) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'reserveOne returned no id' });
    }

    // сохраняем связь в инвентаре пользователя
    await client.query(
      `UPDATE user_inventory
          SET withdraw_state='pending',
              bot_item_id=$1
        WHERE id=$2`,
      [botItemId, invId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, bot_item_id: botItemId });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/withdraw/:inventoryId/complete
 */
router.post('/:inventoryId/complete', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const invId = Number(req.params.inventoryId);
    const userId = req.user.id;

    const inv = await client.query(
      `SELECT id, user_id, bot_item_id, withdraw_state
         FROM user_inventory
        WHERE id=$1
        FOR UPDATE`,
      [invId]
    );
    if (!inv.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
    const it = inv.rows[0];

    if (it.user_id !== userId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Forbidden' }); }
    if (it.withdraw_state !== 'pending' || !it.bot_item_id) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Not pending' });
    }

    await markSent(client, it.bot_item_id);
    await client.query(
      `UPDATE user_inventory
          SET withdraw_state='sent'
        WHERE id=$1`,
      [invId]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/withdraw/:inventoryId/cancel
 */
router.post('/:inventoryId/cancel', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const invId = Number(req.params.inventoryId);
    const userId = req.user.id;

    const inv = await client.query(
      `SELECT id, user_id, bot_item_id, withdraw_state
         FROM user_inventory
        WHERE id=$1
        FOR UPDATE`,
      [invId]
    );
    if (!inv.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
    const it = inv.rows[0];

    if (it.user_id !== userId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Forbidden' }); }
    if (it.withdraw_state !== 'pending' || !it.bot_item_id) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Not pending' });
    }

    await unreserve(client, it.bot_item_id);
    await client.query(
      `UPDATE user_inventory
          SET withdraw_state='none',
              bot_item_id=NULL
        WHERE id=$1`,
      [invId]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
