'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

// helper
const uid = (req) => req.session?.passport?.user?.id || req.user?.id || null;

/**
 * POST /api/contract
 * body: { inventory_ids: number[] }
 * Ответ: { item: { name, image, price } }
 */
router.post('/', async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

  const ids = Array.isArray(req.body?.inventory_ids)
    ? req.body.inventory_ids.map(Number).filter(Boolean)
    : [];
  if (!ids.length) return res.status(400).json({ error: 'Нет предметов для контракта' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Берём выбранные предметы пользователя и лочим
    const qInv = await client.query(
      `SELECT ui.id, ui.user_id, ui.item_master_id, ui.price_minor, ui.is_sold, im.market_hash_name, im.image
         FROM user_inventory ui
         JOIN items_master im ON im.id = ui.item_master_id
        WHERE ui.id = ANY($1::bigint[])
          AND ui.user_id = $2
        FOR UPDATE`,
      [ids, userId]
    );
    if (qInv.rowCount !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Часть предметов не найдена' });
    }
    if (qInv.rows.some(r => r.is_sold)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Некоторые предметы уже проданы/использованы' });
    }

    const totalMinor = qInv.rows.reduce((s, r) => s + Number(r.price_minor || 0), 0);
    if (!totalMinor) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Нулевая сумма контракта' });
    }

    // Диапазон 70%..115%
    const minMinor = Math.floor(totalMinor * 0.7);
    const maxMinor = Math.floor(totalMinor * 1.15);

    // Подбираем предмет из items_master по цене
    // 1) сначала в диапазоне
    let cand = await client.query(
      `SELECT im.id,
              im.market_hash_name,
              im.image,
              (im.price_rub*100)::bigint AS price_minor
         FROM items_master im
        WHERE (im.price_rub*100)::bigint BETWEEN $1 AND $2
        ORDER BY random()
        LIMIT 1`,
      [minMinor, maxMinor]
    );

    // 2) если нет — ближайший по цене
    if (!cand.rowCount) {
      cand = await client.query(
        `SELECT im.id,
                im.market_hash_name,
                im.image,
                (im.price_rub*100)::bigint AS price_minor
           FROM items_master im
          WHERE im.price_rub IS NOT NULL
          ORDER BY ABS((im.price_rub*100)::bigint - $1) ASC
          LIMIT 1`,
        [Math.floor((minMinor + maxMinor) / 2)]
      );
      if (!cand.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Нет подходящих предметов' });
      }
    }

    const win = cand.rows[0];

    // Фолбэк на картинку из items_unique, если в master пусто
    if (!win.image) {
      const u = await client.query(
        `SELECT image FROM items_unique WHERE market_hash_name = $1 AND image IS NOT NULL
         ORDER BY price_minor DESC NULLS LAST LIMIT 1`,
        [win.market_hash_name]
      );
      if (u.rowCount) win.image = u.rows[0].image;
    }

    // Помечаем потраченные предметы как проданные (или можете удалить — по желанию)
    await client.query(
      `UPDATE user_inventory
          SET is_sold = true
        WHERE user_id = $1 AND id = ANY($2::bigint[])`,
      [userId, ids]
    );

    // Добавляем выигранный предмет пользователю
    await client.query(
      `INSERT INTO user_inventory
         (user_id, item_master_id, price_minor, won_at, is_sold, withdraw_state, withdraw_meta)
       VALUES ($1::bigint, $2::bigint, $3::bigint, NOW(), false, 'none', jsonb_build_object(
         'contract', true,
         'source_sum_minor', $4::bigint
       ))`,
      [userId, win.id, Number(win.price_minor || 0), totalMinor]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
      item: {
        name: win.market_hash_name,
        image: win.image,
        price: Number(win.price_minor || 0) / 100
      }
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[POST /api/contract]', e);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

module.exports = router;
