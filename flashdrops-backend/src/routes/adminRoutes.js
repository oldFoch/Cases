// flashdrops-backend/src/routes/adminRoutes.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { fetchSteamPrice } = require('../services/priceUpdater');
const { buildMarketHashName } = require('../utils/marketName');

const router = express.Router();

/**
 * POST /api/admin/cases
 * body: {
 *   name, image, price,
 *   items: [{
 *     name?, image?, chance,
 *     english_name, wear, is_stattrak?, is_souvenir?
 *   }]
 * }
 * ЦЕНЫ на предметы ВСЕГДА берём со Steam по собранному market_hash_name.
 */
router.post('/cases', auth, admin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, image, price, items = [] } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'name и price обязательны' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Нужен массив items' });

    // Проверим, что есть данные для сборки MHN
    for (const it of items) {
      const ok = buildMarketHashName({
        english_name: it.english_name,
        wear: it.wear,
        is_stattrak: !!it.is_stattrak,
        is_souvenir: !!it.is_souvenir
      });
      if (!ok) return res.status(400).json({ error: 'english_name + wear обязательны для каждого предмета' });
    }

    await client.query('BEGIN');

    const c = await client.query(
      'INSERT INTO cases (name, image, price) VALUES ($1, $2, $3) RETURNING id, name, image, price',
      [name, image || null, Number(price)]
    );
    const caseRow = c.rows[0];
    const caseId = caseRow.id;

    const createdItems = [];
    for (const it of items) {
      const mhn = buildMarketHashName({
        english_name: it.english_name,
        wear: it.wear,
        is_stattrak: !!it.is_stattrak,
        is_souvenir: !!it.is_souvenir
      });

      const finalPrice = await fetchSteamPrice(mhn);

      const ins = await client.query(
        `INSERT INTO case_items
           (case_id, name, image, price, chance, market_hash_name,
            english_name, wear, is_stattrak, is_souvenir, price_updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         RETURNING id, name, image, price, chance, market_hash_name, english_name, wear, is_stattrak, is_souvenir`,
        [
          caseId,
          it.name || it.english_name || mhn,
          it.image || null,
          finalPrice,
          Number(it.chance) || 0,
          mhn,
          it.english_name,
          it.wear,
          !!it.is_stattrak,
          !!it.is_souvenir
        ]
      );
      createdItems.push(ins.rows[0]);
    }

    await client.query('COMMIT');
    res.json({ message: '✅ Case created', case: { ...caseRow, items: createdItems } });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin/cases/:id
 * Аналогично: если переданы items — пересобираем предметы, MHN строим, цены тянем.
 */
router.put('/cases/:id', auth, admin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const caseId = Number(req.params.id);
    const { name, image, price, items } = req.body;

    await client.query('BEGIN');

    const fields = [];
    const vals = [];
    let i = 1;
    if (name != null)  { fields.push(`name=$${i++}`);  vals.push(name); }
    if (image != null) { fields.push(`image=$${i++}`); vals.push(image); }
    if (price != null) { fields.push(`price=$${i++}`); vals.push(Number(price)); }
    if (fields.length) {
      vals.push(caseId);
      await client.query(`UPDATE cases SET ${fields.join(', ')} WHERE id = $${i}`, vals);
    }

    let newItems = null;
    if (Array.isArray(items)) {
      // валидация
      for (const it of items) {
        const ok = buildMarketHashName({
          english_name: it.english_name,
          wear: it.wear,
          is_stattrak: !!it.is_stattrak,
          is_souvenir: !!it.is_souvenir
        });
        if (!ok) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'english_name + wear обязательны для каждого предмета' });
        }
      }

      await client.query('DELETE FROM case_items WHERE case_id = $1', [caseId]);
      newItems = [];

      for (const it of items) {
        const mhn = buildMarketHashName({
          english_name: it.english_name,
          wear: it.wear,
          is_stattrak: !!it.is_stattrak,
          is_souvenir: !!it.is_souvenir
        });

        const finalPrice = await fetchSteamPrice(mhn);

        const ins = await client.query(
          `INSERT INTO case_items
             (case_id, name, image, price, chance, market_hash_name,
              english_name, wear, is_stattrak, is_souvenir, price_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           RETURNING id, name, image, price, chance, market_hash_name, english_name, wear, is_stattrak, is_souvenir`,
          [
            caseId,
            it.name || it.english_name || mhn,
            it.image || null,
            finalPrice,
            Number(it.chance) || 0,
            mhn,
            it.english_name,
            it.wear,
            !!it.is_stattrak,
            !!it.is_souvenir
          ]
        );
        newItems.push(ins.rows[0]);
      }
    }

    await client.query('COMMIT');

    const c = await db.query('SELECT id, name, image, price FROM cases WHERE id = $1', [caseId]);
    const its = await db.query(
      'SELECT id, name, image, price, chance, market_hash_name, english_name, wear, is_stattrak, is_souvenir FROM case_items WHERE case_id = $1 ORDER BY id',
      [caseId]
    );

    res.json({ message: '✏️ Case updated', case: { ...c.rows[0], items: newItems ?? its.rows } });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
