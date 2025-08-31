'use strict';

const { Pool } = require('pg');
require('dotenv').config(); // ← подхватываем .env всегда
const env = process.env;
const mask = (s) => {
  if (s == null) return '';
  const str = String(s);
  if (!str.length) return '';
  if (str.length <= 4) return '****';
  return str.slice(0, 1) + '***' + str.slice(-1);
};

const HAS_DB_BLOCK = env.DB_HOST || env.DB_PORT || env.DB_NAME || env.DB_USER || env.DB_PASS;
const HAS_PG_BLOCK = env.PGHOST || env.PGPORT || env.PGDATABASE || env.PGUSER || env.PGPASSWORD;
const HAS_URL = !!env.DATABASE_URL;
const toBool = (v) => String(v || '').toLowerCase() === 'true';

let poolConfig;

if (HAS_DB_BLOCK) {
  poolConfig = {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME || 'flashdrops',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASS != null ? String(env.DB_PASS) : undefined,
    ssl: toBool(env.DB_SSL) ? { rejectUnauthorized: false } : false,
  };
  console.log('[db] using DB_* env vars:', {
    host: poolConfig.host, port: poolConfig.port, db: poolConfig.database,
    user: poolConfig.user, pass: mask(poolConfig.password), ssl: !!poolConfig.ssl
  });
} else if (HAS_URL) {
  poolConfig = {
    connectionString: String(env.DATABASE_URL),
    ssl: toBool(env.PGSSL || env.DB_SSL) ? { rejectUnauthorized: false } : false,
  };
  console.log('[db] using DATABASE_URL (masked)');
} else if (HAS_PG_BLOCK) {
  poolConfig = {
    host: env.PGHOST || '127.0.0.1',
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE || 'flashdrops',
    user: env.PGUSER || 'postgres',
    password: env.PGPASSWORD != null ? String(env.PGPASSWORD) : undefined,
    ssl: toBool(env.PGSSL || env.DB_SSL) ? { rejectUnauthorized: false } : false,
  };
  console.log('[db] using PG_* env vars:', {
    host: poolConfig.host, port: poolConfig.port, db: poolConfig.database,
    user: poolConfig.user, pass: mask(poolConfig.password), ssl: !!poolConfig.ssl
  });
} else {
  poolConfig = {
    host: '127.0.0.1',
    port: 5432,
    database: 'flashdrops',
    user: 'postgres',
    // НЕ передаём password, если его нет
    ssl: false,
  };
  console.log('[db] using defaults (localhost)');
}

// страховка: если password задан, делаем строкой; если пустая строка — удаляем ключ
if (Object.prototype.hasOwnProperty.call(poolConfig, 'password')) {
  const pw = poolConfig.password;
  if (pw == null) {
    delete poolConfig.password;
  } else {
    const s = String(pw);
    if (s.length === 0) delete poolConfig.password;
    else poolConfig.password = s;
  }
}

const pool = new Pool(poolConfig);

async function query(text, params) { return pool.query(text, params); }
async function getClient() { return pool.connect(); }

module.exports = { pool, query, getClient };
