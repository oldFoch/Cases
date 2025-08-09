// flashdrops-backend/src/db.js

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl:      false
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', err => console.error('❌ PostgreSQL error:', err));

module.exports = { query: (t, p) => pool.query(t, p), pool };
