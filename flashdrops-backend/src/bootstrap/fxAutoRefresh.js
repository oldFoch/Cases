// flashdrops-backend/src/bootstrap/fxAutoRefresh.js
'use strict';
const { refreshAll } = require('../services/fxService');

const FX_REFRESH_MINUTES = Number(process.env.FX_REFRESH_MINUTES || 360); // 6h

setTimeout(() => {
  (async function loop() {
    try {
      console.log('[fx] refresh start');
      await refreshAll();
      console.log('[fx] refresh done');
    } catch (e) {
      console.warn('[fx] refresh error:', e.message);
    } finally {
      setTimeout(loop, FX_REFRESH_MINUTES * 60 * 1000);
    }
  })();
}, 10_000);
