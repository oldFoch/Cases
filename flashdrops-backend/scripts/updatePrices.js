#!/usr/bin/env node
'use strict';

require('dotenv').config();
const db = require('../src/db');
const { updateAllPrices } = require('../src/services/priceUpdater');

(async () => {
  try {
    await db.query('SELECT 1');
    console.log('[prices] starting full update…');
    await updateAllPrices();
    console.log('[prices] done');
    process.exit(0);
  } catch (e) {
    console.error('[prices] update error:', e);
    process.exit(1);
  }
})();
