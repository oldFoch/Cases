// flashdrops-backend/scripts/fxRefresh.js
'use strict';
require('dotenv').config();
const { refreshAll } = require('../src/services/fxService');

(async () => {
  try {
    await refreshAll();
    console.log('FX refreshed.');
    process.exit(0);
  } catch (e) {
    console.error('FX refresh failed:', e);
    process.exit(1);
  }
})();
