'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');

const db = require('./db');

const app = express();
const minesMathRoutes = require('./routes/minesMathRoutes');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const IS_PROD = NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','X-Requested-With','Accept'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret';
const sameSite = (FRONTEND_URL.includes('localhost') || FRONTEND_URL.includes('127.0.0.1')) ? 'lax' : 'none';
app.use(session({
  name: 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite,
    secure: sameSite === 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());
require('./passport')(passport);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/mines', require('./routes/minesMathRoutes'));
function mount(path, mod) {
  app.use(path, require(mod));
  console.log(`✔ route ${path} -> ${mod}`);
}

mount('/api/auth', './routes/authRoutes');

mount('/api/users', './routes/userRoutes');
mount('/api/cases', './routes/caseRoutes');
mount('/api/contract', './routes/contractRoutes');
mount('/api/drops', './routes/dropsRoutes');
mount('/api/admin', './routes/adminRoutes');
mount('/api/deposits', './routes/depositRoutes');
mount('/api/stats', './routes/statsRoutes');

mount('/api/withdraw', './routes/withdrawRoutes');
mount('/api/lis', './routes/lisRoutes');
mount('/api/admin/waxpeer', './routes/admin/waxpeerAdminRoutes');
mount('/api/waxpeer', './routes/waxpeerRoutes');

mount('/api/casino', './routes/casinoRoutes');
mount('/api/casino/towers', './routes/casino/towersRoutes');
mount('/api/casino/mines', './routes/casino/minesRoutes');
mount('/api/casino/dice', './routes/casino/diceRoutes');
mount('/api/casino/plinko', './routes/casino/plinkoRoutes');
mount('/api/casino/wheel', './routes/casino/wheelRoutes');
mount('/api/admin/cases', './routes/admin/casesAdminRoutes');
mount('/api/items', './routes/itemsRoutes');
mount('/api/admin/items', './routes/admin/itemsAdminRoutes');
mount('/api/admin/items', './routes/admin/itemsUniqueRoutes');
mount('/api/upgrade', './routes/upgradeRoutes');

(async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } catch (e) {
    console.error('❌ PostgreSQL connection error:', e);
  }
})();

/* Глобальный ловец ошибок: вернёт details в DEV/DEBUG_ERRORS */
app.use((err, _req, res, _next) => {
  const expose = process.env.DEBUG_ERRORS === '1' || !IS_PROD;
  console.error('[UNHANDLED]', err && err.stack ? err.stack : err);
  return res.status(500).json({
    error: 'Internal error',
    ...(expose ? { details: String(err?.message || err) } : {})
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports = app;
