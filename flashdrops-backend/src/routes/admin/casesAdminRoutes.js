'use strict';
const express = require('express');
const db = require('../../db');
const ensureAdmin = require('../../middleware/ensureAdmin');

const router = express.Router();

// Все маршруты только для админа
router.use(ensureAdmin);

// Список кейсов
router.get('/', async (_req, res) => {
  const { rows } = await db.query(
    `SELECT id, title, price, description, created_at
     FROM cases
     ORDER BY id DESC`
  );
  res.json(rows);
});

// Создать кейс
router.post('/', async (req, res) => {
  const { title, price, description } = req.body || {};
  if (!title || !price) return res.status(400).json({ error: 'title and price required' });
  const { rows } = await db.query(
    `INSERT INTO cases (title, price, description)
     VALUES ($1, $2, $3)
     RETURNING id, title, price, description, created_at`,
    [title, Number(price) || 0, description || null]
  );
  res.json(rows[0]);
});

// Удалить кейс
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id) || 0;
  await db.query('DELETE FROM case_items WHERE case_id=$1', [id]);
  await db.query('DELETE FROM cases WHERE id=$1', [id]);
  res.json({ ok: true });
});

// Предметы в кейсе
router.get('/:id/items', async (req, res) => {
  const id = Number(req.params.id) || 0;
  const { rows } = await db.query(
    `SELECT ci.id, ci.weight,
            i.id as item_id, i.item_name, i.price, i.img
     FROM case_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.case_id=$1
     ORDER BY ci.id DESC`,
    [id]
  );
  res.json(rows);
});

// Поиск по предметам (из items)
router.get('/items-search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    const { rows } = await db.query(
      `SELECT id, item_name, price, img FROM items
       ORDER BY price DESC
       LIMIT 50`
    );
    return res.json(rows);
  }
  const { rows } = await db.query(
    `SELECT id, item_name, price, img FROM items
     WHERE LOWER(item_name) LIKE LOWER($1)
     ORDER BY price DESC
     LIMIT 50`,
    [`%${q}%`]
  );
  res.json(rows);
});

// Добавить предмет в кейс
router.post('/:id/items', async (req, res) => {
  const caseId = Number(req.params.id) || 0;
  const { item_id, weight } = req.body || {};
  const w = Math.max(1, Number(weight) || 1);

  const { rows: chk } = await db.query('SELECT id FROM cases WHERE id=$1', [caseId]);
  if (!chk.length) return res.status(404).json({ error: 'case not found' });

  const { rows: ins } = await db.query(
    `INSERT INTO case_items (case_id, item_id, weight)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [caseId, Number(item_id) || 0, w]
  );

  const caseItemId = ins[0].id;
  const { rows } = await db.query(
    `SELECT ci.id, ci.weight,
            i.id as item_id, i.item_name, i.price, i.img
     FROM case_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.id=$1`,
    [caseItemId]
  );

  res.json(rows[0]);
});

// Убрать предмет из кейса
router.delete('/:id/items/:caseItemId', async (req, res) => {
  const caseId = Number(req.params.id) || 0;
  const caseItemId = Number(req.params.caseItemId) || 0;
  await db.query('DELETE FROM case_items WHERE id=$1 AND case_id=$2', [caseItemId, caseId]);
  res.json({ ok: true });
});

module.exports = router;
