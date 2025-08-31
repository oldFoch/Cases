'use strict';

const express = require('express');
const { syncOnce } = require('../../services/priceUpdaterWaxpeer');

const router = express.Router();

// GET /api/admin/waxpeer/sync?query=ak-47
router.get('/sync', async (req, res) => {
  try {
    const out = await syncOnce({ query: req.query?.query || undefined });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
