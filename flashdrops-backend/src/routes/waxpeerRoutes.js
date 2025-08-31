'use strict';
const express = require('express');
const router = express.Router();
const { syncFromWaxpeer } = require('../services/waxpeerService');

router.post('/init-items', async (req, res) => {
  try {
    const { limit, markup } = req.body || {};
    const r = await syncFromWaxpeer({
      limit: Number(limit) || 400,
      defaultMarkup: Number(markup) || 10
    });
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { limit, markup } = req.body || {};
    const r = await syncFromWaxpeer({
      limit: Number(limit) || 400,
      defaultMarkup: Number(markup) || 10
    });
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
