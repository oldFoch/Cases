const express = require('express');
const db = require('../db');

const router = express.Router();

// последние 30 дропов (с id и картинкой кейса для превью)
async function getRecentDrops(_req, res) {
  try {
    const { rows } = await db.query(
      `SELECT
         t.id,
         t.created_at,
         t.item_case_name AS case_name,
         c.id    AS case_id,
         c.image AS case_image,
         t.item_name,
         t.item_image,
         t.item_price,
         u.username,
         u.avatar
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN cases c ON c.name = t.item_case_name
       WHERE t.type = 'case_open'
       ORDER BY t.created_at DESC
       LIMIT 30`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

router.get('/recent', getRecentDrops);
router.get('/recent-opens', getRecentDrops); // алиас под старый путь

module.exports = router;
