'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

const NODE_ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const EXPOSE_ERRORS = process.env.DEBUG_ERRORS === '1' || NODE_ENV !== 'production';

const expose = (e, stage) => ({
  error: 'Ошибка открытия кейса',
  ...(EXPOSE_ERRORS ? {
    details: `[${stage}] ${e?.message || String(e)}`,
    stack: e?.stack || String(e)
  } : {})
});

/* ---------- ОТКРЫТЬ КЕЙС ---------- */
router.post('/open', async (req, res) => {
  let stage = 'init';
  try {
    stage = 'auth';
    const userId = req.session?.passport?.user?.id || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    stage = 'input';
    const cid = Number(req.body?.case_id);
    if (!cid) return res.status(400).json({ error: 'case_id отсутствует' });

    stage = 'load_case';
    const c = await db.query(
      `SELECT id, COALESCE(price_rub, price,0)::numeric(12,2) AS price_rub
       FROM cases WHERE id=$1 LIMIT 1`, [cid]
    );
    if (!c.rowCount) return res.status(404).json({ error: 'Кейс не найден' });
    const priceRub = Number(c.rows[0].price_rub || 0);

    stage = 'load_items';
    const it = await db.query(
      `SELECT u.id, u.base_name, u.market_hash_name, u.image, u.price_minor,
              COALESCE(NULLIF(ci.weight,0), 1)::numeric AS weight
       FROM case_items ci
       JOIN items_unique u ON u.id = ci.item_unique_id
       WHERE ci.case_id = $1`, [cid]
    );
    if (!it.rowCount) return res.status(400).json({ error: 'Нет предметов в кейсе' });

    stage = 'validate_items';
    const items = it.rows.filter(r => {
      const price = Number(r.price_minor || 0);
      const hasValidPrice = price > 0 && price < 1000000000;
      const hasValidName = !!(r.market_hash_name || r.base_name);
      const hasValidImage = !!r.image;
      
      return hasValidPrice && hasValidName && hasValidImage;
    });
    
    if (!items.length) {
      console.error('Нет валидных предметов в кейсе:', cid, 'Предметы:', it.rows.map(r => ({
        id: r.id,
        name: r.market_hash_name || r.base_name,
        price_minor: r.price_minor,
        hasImage: !!r.image
      })));
      return res.status(400).json({ error: 'Нет валидных предметов в кейсе' });
    }

    stage = 'pick_winner';
    const totalW = items.reduce((s, x) => s + Number(x.weight || 1), 0);
    let rnd = Math.random() * totalW;
    let won = items[0];
    for (const x of items) { rnd -= Number(x.weight || 1); if (rnd <= 0) { won = x; break; } }

    const client = await db.getClient();
    try {
      stage = 'tx_begin';
      await client.query('BEGIN');

      stage = 'lock_balance';
      const balQ = await client.query(`SELECT balance FROM users WHERE id=$1 FOR UPDATE`, [userId]);
      const balance = Number(balQ.rows[0]?.balance || 0);
      if (!Number.isFinite(balance)) throw new Error('Некорректный баланс пользователя');
      if (balance < priceRub) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Недостаточно средств' });
      }

      stage = 'select_random_quality';
      // Ищем все качества этого скина в items_master
      const baseName = won.base_name || won.market_hash_name;
      const qualitiesQuery = await client.query(
        `SELECT id, market_hash_name, price_rub 
         FROM items_master 
         WHERE SPLIT_PART(market_hash_name, ' (', 1) = $1
         AND price_rub > 0`,
        [baseName]
      );

      let wonItemMasterId;
      let wonPriceMinor;
      let wonMarketHashName;

      // Если есть другие качества, выбираем случайное
      if (qualitiesQuery.rows.length > 0) {
        const randomQuality = qualitiesQuery.rows[Math.floor(Math.random() * qualitiesQuery.rows.length)];
        wonItemMasterId = randomQuality.id;
        wonPriceMinor = Math.round(randomQuality.price_rub * 100);
        wonMarketHashName = randomQuality.market_hash_name;
      } else {
        // Если нет других качеств, используем базовое
        wonItemMasterId = won.id;
        wonPriceMinor = Number(won.price_minor);
        wonMarketHashName = won.market_hash_name;
      }

      stage = 'charge_balance';
      await client.query(
        `UPDATE users SET balance = balance - $1::numeric WHERE id = $2::bigint`,
        [priceRub, userId]
      );

      stage = 'insert_inventory';
      await client.query(
        `INSERT INTO user_inventory
           (user_id, item_master_id, price_minor, won_at, is_sold, withdraw_state, withdraw_meta)
         VALUES (
           $1::bigint,
           $2::bigint,
           $3::bigint,
           NOW(),
           false,
           'none',
           jsonb_build_object(
             'from_unique', to_jsonb(true),
             'unique_id',  to_jsonb($4::bigint),
             'mhn',        to_jsonb($5::text)
           )
         )`,
        [
          userId,
          wonItemMasterId,
          wonPriceMinor,
          Number(won.id),
          String(wonMarketHashName)
        ]
      );

      stage = 'tx_commit';
      await client.query('COMMIT');

      return res.json({
        ok: true,
        won: {
          name: wonMarketHashName,
          image: won.image,
          price: wonPriceMinor / 100
        },
        balance: balance - priceRub
      });
    } catch (e2) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('[POST /api/cases/open:tx]', stage, e2);
      return res.status(500).json(expose(e2, stage));
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[POST /api/cases/open]', stage, e);
    return res.status(500).json(expose(e, stage));
  }
});

/* Блокируем GET /open */
router.get('/open', (_req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

/* ---------- СПИСОК ---------- */
router.get('/', async (_req, res) => {
  try {
    const q = await db.query(`
      SELECT id, slug, title, image, currency, is_active, updated_at,
             COALESCE(price_rub, price, 0)::numeric(12,2) AS price
      FROM cases
      ORDER BY created_at DESC NULLS LAST, id DESC
    `);
    res.json(q.rows);
  } catch (e) {
    console.error('[GET /api/cases]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ---------- ПРЕДМЕТЫ КЕЙСА ---------- */
router.get('/:key/items', async (req, res) => {
  try {
    const { key } = req.params;
    const isNum = /^\d+$/.test(key);
    const c = isNum
      ? await db.query(`SELECT id, COALESCE(price_rub, price,0)::numeric(12,2) AS price FROM cases WHERE id=$1`, [Number(key)])
      : await db.query(`SELECT id, COALESCE(price_rub, price,0)::numeric(12,2) AS price FROM cases WHERE lower(trim(slug))=lower(trim($1))`, [key]);
    if (!c.rowCount) return res.status(404).json({ error: 'Case not found' });
    const caseId = c.rows[0].id;

    const itemsQ = await db.query(
      `SELECT u.id, u.base_name AS name, u.market_hash_name, u.image, u.price_minor
       FROM case_items ci
       JOIN items_unique u ON u.id = ci.item_unique_id
       WHERE ci.case_id = $1
       ORDER BY u.price_minor DESC`, [caseId]
    );

    const items = itemsQ.rows
      .filter(r => {
        const price = Number(r.price_minor || 0);
        return price > 0 && price < 1000000000;
      })
      .map(r => ({
        id: r.id,
        name: r.name || r.market_hash_name,
        market_hash_name: r.market_hash_name,
        image: r.image,
        price_rub: Number(r.price_minor || 0) / 100
      }));

    res.json({ case: { id: caseId, price: c.rows[0].price }, items });
  } catch (e) {
    console.error('[GET /api/cases/:key/items]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ---------- КЕЙС ---------- */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const isNum = /^\d+$/.test(key);
    const c = isNum
      ? await db.query(`SELECT id, slug, title, image, currency, is_active, updated_at,
                               COALESCE(price_rub, price,0)::numeric(12,2) AS price
                        FROM cases WHERE id=$1`, [Number(key)])
      : await db.query(`SELECT id, slug, title, image, currency, is_active, updated_at,
                               COALESCE(price_rub, price,0)::numeric(12,2) AS price
                        FROM cases WHERE lower(trim(slug))=lower(trim($1))`, [key]);
    if (!c.rowCount) return res.status(404).json({ error: 'Case not found' });

    const caseId = c.rows[0].id;

    const itemsQ = await db.query(
      `SELECT u.id, u.base_name AS name, u.market_hash_name, u.image, u.price_minor
       FROM case_items ci
       JOIN items_unique u ON u.id = ci.item_unique_id
       WHERE ci.case_id = $1
       ORDER BY u.price_minor DESC`, [caseId]
    );

    const items = itemsQ.rows
      .filter(r => {
        const price = Number(r.price_minor || 0);
        return price > 0 && price < 1000000000;
      })
      .map(r => ({
        id: r.id,
        name: r.name || r.market_hash_name,
        market_hash_name: r.market_hash_name,
        image: r.image,
        price_rub: Number(r.price_minor || 0) / 100
      }));

    res.json({ ...c.rows[0], items });
  } catch (e) {
    console.error('[GET /api/cases/:key]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;