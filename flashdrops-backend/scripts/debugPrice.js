'use strict';
require('dotenv').config();
const { fetchSteamRawPriceRUB } = require('../services/priceService');

(async () => {
  const name = process.argv.slice(2).join(' ');
  if (!name) { console.log('Usage: node src/scripts/debugPrice.js "Desert Eagle | Trigger Discipline (Factory New)"'); process.exit(1); }
  try {
    const p = await fetchSteamRawPriceRUB(name);
    console.log('RAW price:', p);
  } catch (e) {
    console.error('ERR', e.code || e.message, e.status || '');
  }
})();
