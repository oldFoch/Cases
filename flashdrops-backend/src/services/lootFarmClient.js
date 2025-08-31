'use strict';
const axios = require('axios');

async function tryEndpoint(url) {
  const { data } = await axios.get(url, { timeout: 15000 });
  const map = new Map();

  // Формат 1: { "Name": 12345, ... }  (копейки)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data)) {
      const cents = Number(v?.price ?? v);         // иногда вложено как {price: ...}
      if (!Number.isFinite(cents) || cents <= 0) continue;
      map.set(String(k).trim(), cents / 100);      // → рубли
    }
    return map;
  }

  // Формат 2: [ { name|market_hash_name, price|rub|last } ]
  if (Array.isArray(data)) {
    for (const x of data) {
      const name = String(x.market_hash_name || x.name || '').trim();
      const rub  = Number(x.rub ?? x.price ?? x.last);
      if (name && Number.isFinite(rub) && rub > 0) map.set(name, rub);
    }
    return map;
  }

  return map;
}

async function getFullPriceMap() {
  // Пробуем оба известных URL
  return (await tryEndpoint('https://loot.farm/fullprice.json')).size
    ? await tryEndpoint('https://loot.farm/fullprice.json')
    : await tryEndpoint('https://loot.farm/prices.json');
}

module.exports = { getFullPriceMap };
