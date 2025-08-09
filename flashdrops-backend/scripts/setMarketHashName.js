// node scripts/setMarketHashName.js
require('dotenv').config();
const db = require('../src/db');

// Заполните соответствия: id предмета -> market_hash_name
const MAP = new Map([
  [101, 'AK-47 | Redline (Field-Tested)'],
  [102, '★ Karambit | Doppler (Factory New)'],
  [103, 'StatTrak™ M4A1-S | Printstream (Minimal Wear)'],
]);

(async () => {
  try {
    for (const [id, mhn] of MAP.entries()) {
      await db.query(
        'UPDATE case_items SET market_hash_name = $1 WHERE id = $2',
        [mhn, id]
      );
      console.log(`OK: item ${id} -> ${mhn}`);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
