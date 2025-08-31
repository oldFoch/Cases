'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    // лёгкая статистика; если таблиц нет — отвечаем дефолтом
    let users = 0, opens = 0, totalDeposits = 0;
    try {
      const u = await db.query('SELECT COUNT(*)::int AS c FROM users');
      users = u.rows[0]?.c || 0;
    } catch {}

    try {
      const t = await db.query(`SELECT COUNT(*)::int AS c FROM transactions WHERE type='case_open'`);
      opens = t.rows[0]?.c || 0;
    } catch {}

    try {
      const d = await db.query(`SELECT COALESCE(SUM(amount),0)::numeric AS s FROM deposits WHERE status='succeeded'`);
      totalDeposits = Number(d.rows[0]?.s || 0);
    } catch {}

    res.json({ users, opens, totalDeposits });
  } catch (e) {
    res.json({ users: 0, opens: 0, totalDeposits: 0 });
  }
});

module.exports = router;
