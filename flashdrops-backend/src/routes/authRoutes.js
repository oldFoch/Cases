'use strict';

const router = require('express').Router();
const passport = require('passport');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 🔹 Инициация входа через Steam
router.get('/steam',
  passport.authenticate('steam', {
    failureRedirect: `${FRONTEND_URL}/?auth=failed`
  })
);

// 🔹 Возврат от Steam после логина
router.get('/steam/return',
  passport.authenticate('steam', {
    failureRedirect: `${FRONTEND_URL}/?auth=failed`
  }),
  (_req, res) => {
    res.redirect(`${FRONTEND_URL}/?auth=ok`);
  }
);

// 🔹 Текущий пользователь
router.get('/me', (req, res) => {
  if (!req.user) return res.json(null);
  const {
    id, steam_id, username, avatar,
    balance, trade_url, is_admin, created_at
  } = req.user;

  res.json({ id, steam_id, username, avatar, balance, trade_url, is_admin, created_at });
});

// 🔹 Выход
router.post('/logout', (req, res) => {
  req.logout?.(() => {});
  req.session?.destroy?.(() => {});
  res.clearCookie('sid');
  res.json({ ok: true });
});

module.exports = router;
