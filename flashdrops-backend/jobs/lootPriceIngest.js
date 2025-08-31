'use strict';

require('dotenv').config();
const { Client } = require('pg');
const { fetchLootPriceMap } = require('../src/services/lootPriceSource');

const {
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS,
} = process.env;

const CONN = {
  host: DB_HOST,
  port: Number(DB_PORT || 5432),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASS,
};

async function getLastPriceRub(client, name) {
  const sql = `
    SELECT price_rub
    FROM loot_price_hist
    WHERE market_hash_name = $1
    ORDER BY fetched_at DESC
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [name]);
  return rows[0]?.price_rub ?? null;
}

async function insertHistBatch(client, rows) {
  if (!rows.length) return 0;
  const values = rows.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(',');
  const params = [];
  for (const r of rows) { params.push(r.market_hash_name, r.price_rub); }
  const sql = `INSERT INTO loot_price_hist (market_hash_name, price_rub) VALUES ${values}`;
  await client.query(sql, params);
  return rows.length;
}

async function upsertIndexBatch(client, rows) {
  if (!rows.length) return 0;
  const values = rows.map((_, i) => `($${i*2+1}, $${i*2+2}, NOW())`).join(',');
  const params = [];
  for (const r of rows) { params.push(r.market_hash_name, r.price_rub); }
  const sql = `
    INSERT INTO loot_price_index (market_hash_name, price_rub, updated_at)
    VALUES ${values}
    ON CONFLICT (market_hash_name)
    DO UPDATE SET price_rub = EXCLUDED.price_rub,
                  updated_at = NOW()
  `;
  await client.query(sql, params);
  return rows.length;
}

async function run() {
  const client = new Client(CONN);
  await client.connect();
  try {
    const map = await fetchLootPriceMap(); // Map<name, rub>
    if (!(map instanceof Map) || map.size === 0) {
      console.log('[lootIngest] empty source');
      return { inserted: 0, upserted: 0 };
    }

    const histToInsert = [];
    const indexToUpsert = [];

    for (const [name, rub] of map.entries()) {
      if (!Number.isFinite(rub) || rub <= 0) continue;

      // индекс обновляем всегда
      indexToUpsert.push({ market_hash_name: name, price_rub: rub });

      // историю пишем при сдвиге > 1% или если истории нет
      const last = await getLastPriceRub(client, name);
      if (last == null) {
        histToInsert.push({ market_hash_name: name, price_rub: rub });
      } else {
        const diff = Math.abs(Number(rub) - Number(last)) / Number(last || 1);
        if (diff > 0.01) histToInsert.push({ market_hash_name: name, price_rub: rub });
      }
    }

    await client.query('BEGIN');
    const ins = await insertHistBatch(client, histToInsert);
    const ups = await upsertIndexBatch(client, indexToUpsert);
    await client.query('COMMIT');

    console.log(`[lootIngest] hist/index: ${ins}/${ups}`);
    return { inserted: ins, upserted: ups };
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('[lootIngest] ERROR', e.message || e);
    throw e;
  } finally {
    await client.end();
  }
}

module.exports = { run };
