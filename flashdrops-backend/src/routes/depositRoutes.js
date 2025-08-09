// flashdrops-backend/src/routes/depositRoutes.js

const express = require('express');
const path = require('path');
const db = require('../db');
// жёстко резолвим путь, чтобы не было "Cannot find module"
const { getPriceWithCache } = require(path.join(__dirname, '..', 'services', 'priceService'));
const { enrichItemsWithClassInfo } = require('../services/steamEconomy');
// const auth = require('../middleware/auth'); // при необходимости включите

const router = express.Router();

const APPID = Number(process.env.STEAM_APPID || 730);
const DEPOSIT_CREDIT_PERCENT = Number(process.env.DEPOSIT_CREDIT_PERCENT || 95); // сколько зачислять от суммы

router.post('/steam', /* auth, */ async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { userId, items, tradelockUntil } = req.body;
    if (!userId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'userId и items[] обязательны' });
    }

    // 1) Подтянуть classinfo у Steam и нормализовать
    const enriched = await enrichItemsWithClassInfo(APPID, items);

    // 2) Проставить цены (с кэшем)
    for (const it of enriched) {
      it.price = it.market_hash_name ? await getPriceWithCache(it.market_hash_name) : 0;
    }

    // 3) Посчитать кредит на баланс
    const total = enriched.reduce((s, it) => s + (Number(it.price) || 0), 0);
    const credit = Math.max(0, Math.round((total * (DEPOSIT_CREDIT_PERCENT / 100)) * 100) / 100);

    await client.query('BEGIN');

    // 4) Транзакция депозита
    const tx = await client.query(
      `INSERT INTO transactions (user_id, type, amount, created_at)
       VALUES ($1, 'deposit', $2, NOW())
       RETURNING id`,
      [userId, credit]
    );
    const txId = tx.rows[0].id;

    // 5) Увеличить баланс
    await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [credit, userId]
    );

    // 6) Сложить предметы в склад бота
    for (const it of enriched) {
      await client.query(
        `INSERT INTO bot_inventory
           (appid, classid, instanceid, assetid,
            name, image, market_hash_name,
            english_name, wear, is_stattrak, is_souvenir,
            price_current, price_updated_at,
            owner_user_id, deposit_tx_id, tradelock_until, status)
         VALUES
           ($1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, NOW(),
            $13, $14, $15, 'in_stock')`,
        [
          APPID,
          String(it.classid),
          it.instanceid ? String(it.instanceid) : null,
          it.assetid || null,
          it.name || null,
          it.image || null,
          it.market_hash_name || null,
          it.english_name || null,
          it.wear || null,
          !!it.is_stattrak,
          !!it.is_souvenir,
          Number(it.price) || 0,
          userId,
          txId,
          tradelockUntil ? new Date(tradelockUntil) : null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, credited: credit, items: enriched.length });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
