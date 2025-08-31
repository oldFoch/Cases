#!/usr/bin/env node
'use strict';

require('dotenv').config();
const db = require('../src/db');
const { fetchSteamPrice } = require('../src/services/priceService');

(async () => {
  const name = process.argv.slice(2).join(' ').trim();
  if (!name) {
    console.error('Usage: npm run price:update:one -- "AWP | Mortis (Factory New)"');
    process.exit(2);
  }
  try {
    const { rows } = await db.query(
      `SELECT id FROM items_master WHERE market_hash_name=$1`,
      [name]
    );
    if (!rows.length) {
      console.error('Not found in items_master:', name);
      process.exit(3);
    }
    const price = await fetchSteamPrice(name);
    await db.query(`UPDATE items_master SET price=$1, price_updated_at=NOW() WHERE id=$2`, [price, rows[0].id]);
    console.log('OK:', name, price);
    process.exit(0);
  } catch (e) {
    console.error('FAIL:', e.message || e);
    process.exit(1);
  }
})();
