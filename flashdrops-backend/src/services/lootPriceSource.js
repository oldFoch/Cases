'use strict';

// .env:
// LOOTFARM_CLIENT_MODULE=./src/services/lootFarmClient
// LOOTFARM_CLIENT_METHOD=getFullPriceMap

const modPath = process.env.LOOTFARM_CLIENT_MODULE || './src/services/lootFarmClient';
const method  = process.env.LOOTFARM_CLIENT_METHOD  || 'getFullPriceMap';

/**
 * Ожидается, что клиент вернёт одно из:
 *  1) Map<market_hash_name, rubNumber>
 *  2) Object { "name": rubNumber, ... }
 *  3) Array<{ market_hash_name|name, price|rub|last }>
 */
async function fetchLootPriceMap() {
  const client = require(require('path').resolve(modPath));
  if (!client || typeof client[method] !== 'function') {
    throw new Error(`LootFarm client "${modPath}" does not export method "${method}"`);
  }
  const data = await client[method]();

  const map = new Map();

  if (data instanceof Map) return data;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data)) {
      const name = String(k).trim();
      const rub  = typeof v === 'number' ? v : Number(v?.price ?? v?.rub ?? v?.last);
      if (name && Number.isFinite(rub) && rub > 0) map.set(name, rub);
    }
    return map;
  }

  if (Array.isArray(data)) {
    for (const x of data) {
      const name = String(x.market_hash_name || x.name || '').trim();
      const rub  = Number(x.price ?? x.rub ?? x.last);
      if (name && Number.isFinite(rub) && rub > 0) map.set(name, rub);
    }
    return map;
  }

  return map;
}

module.exports = { fetchLootPriceMap };
