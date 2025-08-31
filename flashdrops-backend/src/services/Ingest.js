'use strict';

const axios = require('axios');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const PRICE_FEED_URL = process.env.PRICE_FEED_URL;
const SOURCE_FIELD = process.env.SOURCE_FIELD || 'last';
const ANOMALY_K = Number(process.env.ANOMALY_K || 6);
const VOL_CAP = Number(process.env.VOLATILITY_CAP_PCT || 30);

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!PRICE_FEED_URL) throw new Error('PRICE_FEED_URL is required');

const CALC_VERSION = 'rub-v1';

function toMinorRub(val) {
  // вход: число в рублях (твоя внутренняя валюта 1:1)
  return Math.round(Number(val) * 100);
}

async function fetchFeed() {
  const { data } = await axios.get(PRICE_FEED_URL, { timeout: 30000 });
  // ожидается массив объектов:
  // { market_hash_name: string, last: number, lowest_price?: number, currency: 'RUB' }
  if (!Array.isArray(data)) return [];
  return data
    .filter(x => x && x.market_hash_name && (x[SOURCE_FIELD] != null))
    .map(x => ({
      market_hash_name: String(x.market_hash_name).trim(),
      raw_price: Number(x[SOURCE_FIELD]),
      currency: String(x.currency || 'RUB').toUpperCase(),
      source_field: SOURCE_FIELD
    }));
}

async function withPg(fn) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

async function getHistStats(client, name) {
  const q = `
    WITH hist AS (
      SELECT price_minor
      FROM prices_ingest
      WHERE lower(market_hash_name)=lower($1)
        AND created_at >= now() - interval '7 days'
    ),
    m AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_minor)::bigint AS med FROM hist
    ),
    dev AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abs(price_minor - m.med))::bigint AS mad
      FROM hist, m
    ),
    prev AS (
      SELECT u.price_minor AS prev_minor
      FROM items_unique u
      WHERE lower(u.market_hash_name)=lower($1)
      LIMIT 1
    )
    SELECT COALESCE((SELECT med FROM m), NULL) AS med,
           COALESCE((SELECT mad FROM dev), 0) AS mad,
           COALESCE((SELECT prev_minor FROM prev), NULL) AS prev_minor;
  `;
  const { rows } = await client.query(q, [name]);
  return rows[0] || { med: null, mad: 0, prev_minor: null };
}

function passAnomaly(newMinor, med, mad) {
  if (!med || mad === 0) return true; // нет истории — пропускаем
  const diff = Math.abs(newMinor - med);
  return diff <= ANOMALY_K * mad;
}

function capVolatility(newMinor, prevMinor) {
  if (!prevMinor || prevMinor <= 0) return newMinor;
  const upCap = Math.round(prevMinor * (1 + VOL_CAP / 100));
  const downCap = Math.round(prevMinor * (1 - VOL_CAP / 100));
  if (newMinor > upCap) return upCap;
  if (newMinor < downCap) return downCap;
  return newMinor;
}

async function insertIngest(client, rows) {
  if (rows.length === 0) return;
  const values = [];
  const params = [];
  let i = 1;
  for (const r of rows) {
    values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    params.push(
      r.market_hash_name,
      r.price_minor,
      r.source,
      r.source_field,
      r.currency,
      1,                // fx_used = 1 (RUB)
      CALC_VERSION
    );
  }
  const sql = `
    INSERT INTO prices_ingest
      (market_hash_name, price_minor, source, source_field, source_currency, fx_used, calc_version)
    VALUES ${values.join(',')}
  `;
  await client.query(sql, params);
}

async function upsertToMain(client) {
  const sql = await require('fs').promises.readFile(require('path').resolve(__dirname, '../sql/upsert_prices.sql'), 'utf8');
  await client.query(sql);
}

async function run() {
  const feed = await fetchFeed();
  const prepared = [];

  await withPg(async (client) => {
    for (const row of feed) {
      if (row.currency !== 'RUB') continue; // только RUB
      const minor = toMinorRub(row.raw_price);
      if (!(minor > 0)) continue;

      const { med, mad, prev_minor } = await getHistStats(client, row.market_hash_name);
      if (!passAnomaly(minor, med, mad)) continue;

      const finalMinor = capVolatility(minor, prev_minor);

      prepared.push({
        market_hash_name: row.market_hash_name,
        price_minor: finalMinor,
        source: 'price-feed',
        source_field: row.source_field,
        currency: 'RUB'
      });
    }

    if (prepared.length) {
      await insertIngest(client, prepared);
      await upsertToMain(client);
    }
  });
}

if (require.main === module) {
  run().catch(err => {
    console.error('[pricesIngest] ERROR:', err);
    process.exit(1);
  });
}

module.exports = { run };
