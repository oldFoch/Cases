'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// PATCH /api/users/tradeurl { trade_url }
router.patch('/tradeurl', auth, async (req, res) => {
  try {
    const url = String(req.body?.trade_url || '').trim();
    if (!/^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=/.test(url)) {
      return res.status(400).json({ error: 'Invalid Steam trade URL' });
    }
    await db.query(`UPDATE users SET trade_url=$1 WHERE id=$2`, [url, req.user.id]);
    res.json({ ok: true, trade_url: url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
