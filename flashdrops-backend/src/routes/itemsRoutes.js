'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// Основной роут для поиска предметов
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const min = Number(req.query.min) || 0;
  const max = Number(req.query.max) || 0;

  const params = [];
  const conds = [];

  if (q) {
    params.push(q);
    conds.push(`name ILIKE '%' || $${params.length} || '%'`);
  }
  if (min > 0) {
    params.push(min);
    conds.push(`price_rub >= $${params.length}`);
  }
  if (max > 0) {
    params.push(max);
    conds.push(`price_rub <= $${params.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const sql = `
    SELECT id, market_hash_name, name, image, price_rub
    FROM items_master
    ${where}
    ORDER BY price_rub DESC
    LIMIT 200
  `;
  
  try {
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (error) {
    console.error('Error in items search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Новый endpoint для получения всех качеств предмета по base_name
router.get('/:base_name/qualities', async (req, res) => {
  try {
    const { base_name } = req.params;

    const query = `
      SELECT 
        id,
        market_hash_name,
        price_rub,
        CASE 
          WHEN market_hash_name ILIKE '%(Factory New)%' THEN 'Factory New'
          WHEN market_hash_name ILIKE '%(Minimal Wear)%' THEN 'Minimal Wear'
          WHEN market_hash_name ILIKE '%(Field-Tested)%' THEN 'Field-Tested'
          WHEN market_hash_name ILIKE '%(Well-Worn)%' THEN 'Well-Worn'
          WHEN market_hash_name ILIKE '%(Battle-Scarred)%' THEN 'Battle-Scarred'
          ELSE 'Unknown'
        END as wear,
        market_hash_name ILIKE '%StatTrak™%' as is_stattrak,
        market_hash_name ILIKE '%Souvenir%' as is_souvenir,
        updated_at
      FROM items_master 
      WHERE base_name = $1 OR market_hash_name ILIKE $2
      ORDER BY
        is_stattrak,
        is_souvenir,
        CASE
          WHEN market_hash_name ILIKE '%(Factory New)%' THEN 1
          WHEN market_hash_name ILIKE '%(Minimal Wear)%' THEN 2
          WHEN market_hash_name ILIKE '%(Field-Tested)%' THEN 3
          WHEN market_hash_name ILIKE '%(Well-Worn)%' THEN 4
          WHEN market_hash_name ILIKE '%(Battle-Scarred)%' THEN 5
          ELSE 6
        END
    `;

    const result = await db.query(query, [base_name, `%${base_name}%`]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching item qualities:', error);
    res.status(500).json({ error: 'Failed to fetch item qualities' });
  }
});

// Дополнительный endpoint для получения предмета по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT id, market_hash_name, name, image, price_rub, base_name, quality, updated_at
      FROM items_master 
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching item by ID:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

module.exports = router;