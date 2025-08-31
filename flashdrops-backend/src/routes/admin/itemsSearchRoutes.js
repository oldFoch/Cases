// flashdrops-backend/src/routes/admin/itemsSearchRoutes.js
'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
function requireAdmin(req, res, next) {
  const u = req.user;
  if (u && (u.is_admin === true || u.is_admin === 1)) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// общий поиск по items (если нужен отдельно)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { q, min, max, quality, limit = 50 } = req.query;
  const where = [];
  const vals = [];
  if (q) { vals.push(`%${q}%`); where.push(`(i.name ILIKE $${vals.length})`); }
  if (min) { vals.push(min); where.push(`i.price_fc >= $${vals.length}`); }
  if (max) { vals.push(max); where.push(`i.price_fc <= $${vals.length}`); }
  if (quality) { vals.push(quality); where.push(`i.quality = $${vals.length}`); }

  const sql = `
    SELECT i.id, i.name, i.image, i.price_fc, i.quality
    FROM items i
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY i.price_fc DESC
    LIMIT ${Math.max(1, Math.min(200, Number(limit) || 50))}
  `;
  const { rows } = await db.query(sql, vals);
  res.json(rows);
});

module.exports = router;
