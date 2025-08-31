'use strict';

require('dotenv').config();
const { updateAllPrices } = require('../src/services/priceUpdater');

(async () => {
  try {
    const res = await updateAllPrices();
    console.log('[prices] updated:', res.updated || 0);
  } catch (e) {
    console.error('[prices] ERROR:', e?.message || e);
    process.exit(1);
  }
})();
