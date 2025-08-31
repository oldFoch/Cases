'use strict';
const cron = require('node-cron');
const { run } = require('../services/pricesIngest');

const CRON_EXPR = process.env.CRON_EXPR || '*/5 * * * *';

cron.schedule(CRON_EXPR, async () => {
  try {
    await run();
    console.log('[pricesCron] tick ok');
  } catch (e) {
    console.error('[pricesCron] fail', e);
  }
});

// запустить немедленно при старте
run().catch(e => console.error('[pricesCron] initial run fail', e));
