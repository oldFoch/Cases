'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

const uid = (req) => req.session?.passport?.user?.id || req.user?.id || null;

/* ---------- SOURCES ---------- */
router.get('/sources', async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    const q = await db.query(
      `SELECT
         ui.id,
         im.market_hash_name AS name,
         COALESCE(im.image, iu.image) AS image,
         (ui.price_minor/100.0)::numeric(12,2) AS price
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_master_id
       LEFT JOIN LATERAL (
         SELECT image
           FROM items_unique
          WHERE market_hash_name = im.market_hash_name
            AND image IS NOT NULL
          ORDER BY price_minor DESC NULLS LAST
          LIMIT 1
       ) iu ON true
      WHERE ui.user_id = $1
        AND ui.is_sold = false
      ORDER BY ui.won_at DESC, ui.id DESC`,
      [userId]
    );
    res.json(q.rows);
  } catch (e) {
    console.error('[GET /api/upgrade/sources]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ---------- TARGETS ---------- */
router.get('/targets', async (req, res) => {
  try {
    const qStr = String(req.query.q || '').trim();
    const min = Number(req.query.min || 0);
    const max = Number(req.query.max || 0);

    const params = [];
    const cond = ['im.price_rub IS NOT NULL'];

    if (qStr) { params.push(`%${qStr}%`); cond.push(`im.market_hash_name ILIKE $${params.length}`); }
    if (min > 0) { params.push(min); cond.push(`im.price_rub >= $${params.length}`); }
    if (max > 0) { params.push(max); cond.push(`im.price_rub <= $${params.length}`); }

    const sql = `
      SELECT
        im.id AS item_master_id,
        im.market_hash_name AS name,
        COALESCE(im.image, iu.image) AS image,
        im.price_rub::numeric(12,2) AS price
      FROM items_master im
      LEFT JOIN LATERAL (
        SELECT image
          FROM items_unique
         WHERE market_hash_name = im.market_hash_name
           AND image IS NOT NULL
         ORDER BY price_minor DESC NULLS LAST
         LIMIT 1
      ) iu ON true
      WHERE ${cond.join(' AND ')}
      ORDER BY im.price_rub DESC NULLS LAST, im.id DESC
      LIMIT 100
    `;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (e) {
    console.error('[GET /api/upgrade/targets]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ---------- TRY ---------- */
router.post('/try', async (req, res) => {
  let stage = 'init';
  const client = await db.getClient();

  try {
    console.log('[upgrade:try] body =', req.body);

    stage = 'auth';
    const userId = uid(req);
    if (!userId) { client.release(); return res.status(401).json({ error: 'Вы не авторизованы' }); }

    stage = 'input';
    const srcInvId = Number(req.body?.source_inventory_id);
    const tgtId    = Number(req.body?.target_item_master_id);
    if (!srcInvId || !tgtId) { client.release(); return res.status(400).json({ error: 'Параметры отсутствуют' }); }

    stage = 'tx_begin';
    await client.query('BEGIN');

    stage = 'load_source';
    // Лочим ТОЛЬКО user_inventory, затем делаем join
    const srcQ = await client.query(
      `WITH locked AS (
         SELECT *
           FROM user_inventory
          WHERE id = $1
          FOR UPDATE OF user_inventory
       )
       SELECT l.id, l.user_id, l.item_master_id, l.price_minor, l.is_sold,
              im.market_hash_name,
              COALESCE(im.image, iu.image) AS image
         FROM locked l
         JOIN items_master im ON im.id = l.item_master_id
         LEFT JOIN LATERAL (
           SELECT image
             FROM items_unique
            WHERE market_hash_name = im.market_hash_name
              AND image IS NOT NULL
            ORDER BY price_minor DESC NULLS LAST
            LIMIT 1
         ) iu ON true`,
      [srcInvId]
    );
    if (!srcQ.rowCount) throw new Error('Источник не найден');
    const src = srcQ.rows[0];
    if (Number(src.user_id) !== Number(userId)) throw new Error('Чужой предмет');
    if (src.is_sold) throw new Error('Предмет уже использован');

    stage = 'load_target';
    const tgtQ = await client.query(
      `SELECT im.id, im.market_hash_name,
              COALESCE(im.image, iu.image) AS image,
              im.price_rub::numeric(12,2) AS price_rub
         FROM items_master im
         LEFT JOIN LATERAL (
           SELECT image
             FROM items_unique
            WHERE market_hash_name = im.market_hash_name
              AND image IS NOT NULL
            ORDER BY price_minor DESC NULLS LAST
            LIMIT 1
         ) iu ON true
        WHERE im.id = $1`,
      [tgtId]
    );
    if (!tgtQ.rowCount) throw new Error('Цель не найдена');
    const tgt = tgtQ.rows[0];

    stage = 'calc_prob';
    const srcPrice = Number(src.price_minor || 0) / 100;
    const tgtPrice = Number(tgt.price_rub || 0);
    if (!Number.isFinite(srcPrice) || srcPrice <= 0) throw new Error('Некорректная цена источника');
    if (!Number.isFinite(tgtPrice) || tgtPrice <= 0) throw new Error('Некорректная цена цели');

    const pWin = Math.max(0.05, Math.min(0.9, srcPrice / tgtPrice));
    const roll = Math.random();

    let outcome = 'lose';
    if (roll < pWin) outcome = 'win';
    else if (roll < pWin + 0.15) outcome = 'stay';

    stage = 'apply';
    let reward = null;

    if (outcome === 'win') {
      await client.query(`UPDATE user_inventory SET is_sold = true WHERE id = $1`, [srcInvId]);
      const priceMinor = Math.round(tgtPrice * 100);
      await client.query(
        `INSERT INTO user_inventory
           (user_id, item_master_id, price_minor, won_at, is_sold, withdraw_state, withdraw_meta)
         VALUES ($1::bigint, $2::bigint, $3::bigint, NOW(), false, 'none',
                 jsonb_build_object('upgrade', true))`,
        [userId, tgt.id, priceMinor]
      );
      reward = { name: tgt.market_hash_name, image: tgt.image, price: tgtPrice };
    } else if (outcome === 'stay') {
      reward = { name: src.market_hash_name, image: src.image, price: srcPrice };
    } else {
      await client.query(`UPDATE user_inventory SET is_sold = true WHERE id = $1`, [srcInvId]);
    }

    stage = 'commit';
    await client.query('COMMIT');
    return res.json({ ok: true, outcome, reward });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[POST /api/upgrade/try]', stage, e);
    return res.status(500).json({
      error: `Internal error [stage: ${stage}] ${e?.message || ''}`.trim()
    });
  } finally {
    try { client.release(); } catch {}
  }
});

module.exports = router;
