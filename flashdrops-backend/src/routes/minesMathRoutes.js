// routes/minesMathRoutes.js
const express = require('express');
const r = express.Router();
const MM = require('../utils/minesMath');

// GET /api/mines/mults?T=25&m=3&h=0.04
r.get('/mults', (req, res) => {
  const T = Number(req.query.T || 25);
  const m = Number(req.query.m || 3);
  const h = Number(req.query.h ?? 0.04);
  return res.json(MM.table(T, m, h));
});

// POST /api/mines/cashout { bet, T, m, k, h }
r.post('/cashout', (req, res) => {
  const { bet, T, m, k, h } = req.body || {};
  const amt = MM.cashoutAmount(Number(bet||0), Number(T||25), Number(m||3), Number(k||0), Number(h ?? 0.04));
  return res.json({ amount: amt });
});

// GET /api/mines/ui?bet=100&T=25&m=3&k=2&h=0.04
r.get('/ui', (req, res) => {
  const bet = Number(req.query.bet || 0);
  const T = Number(req.query.T || 25);
  const m = Number(req.query.m || 3);
  const k = Number(req.query.k || 0);
  const h = Number(req.query.h ?? 0.04);
  return res.json(MM.uiState({ bet, T, m, k, h }));
});

module.exports = r;
