'use strict';

// .env подтягиваем из backend/.env
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const axios = require('axios');
const { Pool } = require('pg');

const API_BASE = process.env.WAXPEER_API_BASE || 'https://api.waxpeer.com';
const API_KEY  = process.env.WAXPEER_KEY || '';

function toBool(v){ return String(v||'').toLowerCase()==='true'; }

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'flashdrops',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS != null ? String(process.env.DB_PASS) : '',
  ssl: toBool(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
});

// несколько вариантов заголовков (на случай разных требований API)
const headersList = [
  API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
  API_KEY ? { 'X-Api-Key': API_KEY } : {},
  API_KEY ? { 'x-api-key': API_KEY } : {},
];

const http = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

const WEAR_RANK = {
  'factory new': 1,
  'minimal wear': 2,
  'field-tested': 3,
  'well-worn': 4,
  'battle-scarred': 5,
};

function normalizeBaseName(name) {
  if (!name) return '';
  let s = String(name);
  s = s.replace(/\s+\(([^)]+)\)\s*$/i, ''); // убрать качество
  s = s.replace(/^\s*★\s*/i, '');
  s = s.replace(/^\s*StatTrak[™\s]*\s*/i, '');
  s = s.replace(/^\s*Souvenir\s+/i, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}
function extractWear(name) {
  const m = String(name||'').match(/\(([^)]+)\)\s*$/);
  if (!m) return 9;
  const w = m[1].toLowerCase();
  return WEAR_RANK[w] || 9;
}

async function tryGet(url) {
  for (const headers of headersList) {
    try {
      const { data } = await http.get(url, { headers });
      return data;
    } catch (e) {
      // пробуем следующий вариант заголовков
    }
  }
  return null;
}

// набор возможных прайс-эндпоинтов (перебираем)
const PRICE_URLS = [
  '/v1/prices?app=730',
  '/v1/prices-all?app=730',
  '/v1/items/prices?app=730',
];

async function fetchPrices() {
  for (const url of PRICE_URLS) {
    const data = await tryGet(url);
    if (!data) continue;
    const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    if (arr.length) {
      return arr.map(it => ({
        name: it.market_hash_name || it.name,
        image: it.icon_url || it.image || null,
        price: Number(it.price ?? it.min_price ?? 0),
      })).filter(x => x.name && x.price > 0);
    }
  }
  return [];
}

function buildBestByBase(prices) {
  const best = new Map();
  for (const it of prices) {
    const base = normalizeBaseName(it.name);
    if (!base) continue;
    const wearRank = extractWear(it.name);
    const pm = Math.round(it.price * 100);
    if (!pm || pm <= 0) continue;

    const prev = best.get(base);
    if (!prev || wearRank < prev.wearRank || (wearRank === prev.wearRank && pm > prev.pm)) {
      best.set(base, { pm, image: it.image || null, wearRank });
    }
  }
  // упростим
  const out = new Map();
  for (const [k, v] of best.entries()) out.set(k, { pm: v.pm, image: v.image });
  return out;
}

async function getPlaceholders(client) {
  const q = await client.query(`
    SELECT id, base_name, market_hash_name, image, price_minor
    FROM items_unique
    WHERE price_minor IS NULL OR price_minor=0 OR price_minor<=10
  `);
  return q.rows;
}

async function updateBatch(client, rows) {
  if (!rows.length) return 0;
  let cnt = 0;
  for (const r of rows) {
    await client.query(
      `UPDATE items_unique
         SET price_minor=$1,
             price_minor_backup=COALESCE(price_minor_backup,$1),
             image=COALESCE(NULLIF(image,''),$2),
             updated_at=now()
       WHERE id=$3`,
      [r.pm, r.image || null, r.id]
    );
    cnt++;
  }
  return cnt;
}

// Фолбэк: берём лучшие цены из items_master по base_name (FN→…→BS, при равенстве — дороже)
async function fallbackFromItemsMaster(client, placeholders) {
  if (!placeholders.length) return 0;

  // подготавливаем список base_name
  const bases = [...new Set(placeholders.map(r => r.base_name).filter(Boolean))];
  if (!bases.length) return 0;

  const { rows: best } = await client.query(`
    WITH mm AS (
      SELECT
        regexp_replace(m.market_hash_name, ' \\(([^)]+)\\)$', '', 'g') AS base_name,
        m.image,
        m.price_rub,
        CASE lower(regexp_replace(m.market_hash_name, '.*\\(([^)]+)\\).*', '\\1'))
          WHEN 'factory new'    THEN 1
          WHEN 'minimal wear'   THEN 2
          WHEN 'field-tested'   THEN 3
          WHEN 'well-worn'      THEN 4
          WHEN 'battle-scarred' THEN 5
          ELSE 9
        END AS wear_rank
      FROM items_master m
      WHERE regexp_replace(m.market_hash_name, ' \\(([^)]+)\\)$', '', 'g') = ANY($1)
    ),
    pick AS (
      SELECT base_name, image, price_rub,
             ROW_NUMBER() OVER (
               PARTITION BY lower(base_name)
               ORDER BY wear_rank ASC, price_rub DESC NULLS LAST
             ) rn
      FROM mm
    )
    SELECT base_name, image, (COALESCE(price_rub,0)*100)::bigint AS pm
    FROM pick
    WHERE rn=1
  `, [bases]);

  // мапа base_name → pm,img
  const map = new Map(best.map(b => [String(b.base_name).toLowerCase(), { pm: Number(b.pm)||0, image: b.image||null }]));

  const updates = [];
  for (const r of placeholders) {
    const k = String(r.base_name||'').toLowerCase();
    const m = map.get(k);
    if (m && m.pm > 10) updates.push({ id: r.id, pm: m.pm, image: m.image });
  }
  return updateBatch(client, updates);
}

async function run() {
  console.log('[fillMissingPrices] start');
  const client = await pool.connect();
  try {
    const placeholders = await getPlaceholders(client);
    console.log('[fillMissingPrices] placeholders:', placeholders.length);

    console.log('[fillMissingPrices] fetching Waxpeer prices…', API_BASE);
    const prices = await fetchPrices();
    console.log('[fillMissingPrices] fetched', prices.length, 'price rows');

    let updated = 0;
    if (prices.length) {
      const bestMap = buildBestByBase(prices);
      const toUpdate = [];
      for (const r of placeholders) {
        const key = normalizeBaseName(r.base_name);
        const best = bestMap.get(key);
        if (!best) continue;
        if (best.pm > 10) toUpdate.push({ id: r.id, pm: best.pm, image: best.image });
      }

      await client.query('BEGIN');
      await client.query('ALTER TABLE items_unique DISABLE TRIGGER USER');
      updated += await updateBatch(client, toUpdate);
      await client.query('ALTER TABLE items_unique ENABLE TRIGGER USER');
      await client.query('COMMIT');
      console.log(`[fillMissingPrices] updated from Waxpeer: ${updated}`);
    }

    // фолбэк, если после Waxpeer остались placeholders
    const remaining = await getPlaceholders(client);
    if (remaining.length) {
      console.log('[fillMissingPrices] fallback from items_master for', remaining.length, 'rows');
      await client.query('BEGIN');
      await client.query('ALTER TABLE items_unique DISABLE TRIGGER USER');
      const upd2 = await fallbackFromItemsMaster(client, remaining);
      await client.query('ALTER TABLE items_unique ENABLE TRIGGER USER');
      await client.query('COMMIT');
      updated += upd2;
      console.log(`[fillMissingPrices] updated from items_master: ${upd2}`);
    }

    console.log('[fillMissingPrices] total updated:', updated);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[fillMissingPrices] ERROR:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) run();
module.exports = { run };
