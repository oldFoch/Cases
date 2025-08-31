// flashdrops-backend/src/routes/admin/itemsUniqueRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');

// Простая ручка администратора: дергает sync_items_unique()
router.post('/unique/sync', async (_req, res) => {
  try {
    const r = await db.query('SELECT sync_items_unique() AS cnt');
    res.json({ ok: true, synced: Number(r.rows?.[0]?.cnt || 0) });
  } catch (e) {
    console.error('[admin] sync unique error:', e);
    res.status(500).json({ ok: false, error: 'sync failed' });
  }
});

module.exports = router;
