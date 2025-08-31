'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

/* GET /api/drops/recent?limit=12 */
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 12));

    const q = await db.query(
      `
      WITH inv AS (
        SELECT id, user_id, item_master_id, price_minor, won_at
        FROM user_inventory
        WHERE is_sold = false
        ORDER BY won_at DESC
        LIMIT $1
      )
      SELECT
        inv.id,
        u.username,
        u.avatar,
        (inv.price_minor/100.0)::numeric(12,2) AS item_price,
        inv.won_at AS created_at,

        im.market_hash_name AS item_name,
        COALESCE(im.image, iu.image)       AS item_image,

        c1.id    AS case_id,
        c1.title AS case_name,
        c1.image AS case_image
      FROM inv
      JOIN users u        ON u.id = inv.user_id
      JOIN items_master im ON im.id = inv.item_master_id
      LEFT JOIN items_unique iu
             ON iu.market_hash_name = im.market_hash_name
      /* пытаемся определить "источник кейса" по привязкам case_items */
      LEFT JOIN LATERAL (
        SELECT c.id, c.title, c.image
        FROM case_items ci
        JOIN cases c ON c.id = ci.case_id
        WHERE ci.item_master_id = inv.item_master_id
           OR (iu.id IS NOT NULL AND ci.item_unique_id = iu.id)
        ORDER BY c.updated_at DESC NULLS LAST, c.id DESC
        LIMIT 1
      ) c1 ON true
      ORDER BY inv.won_at DESC;
      `,
      [limit]
    );

    // frontend ждёт поля: id, case_id, case_name, case_image, item_name, item_image, item_price, username, avatar, created_at
    res.json(q.rows);
  } catch (e) {
    console.error('[GET /api/drops/recent]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
