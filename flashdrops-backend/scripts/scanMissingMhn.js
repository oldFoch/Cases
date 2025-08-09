// Запуск: node scripts/scanMissingMhn.js
require('dotenv').config();
const db = require('../src/db');

(async () => {
  try {
    const { rows } = await db.query(
      `SELECT ci.id, ci.case_id, c.name AS case_name, ci.name, ci.english_name, ci.wear, ci.market_hash_name
         FROM case_items ci
         JOIN cases c ON c.id = ci.case_id
        WHERE (ci.market_hash_name IS NULL OR ci.market_hash_name = '')
        ORDER BY ci.case_id, ci.id`
    );
    if (!rows.length) {
      console.log('✅ Все предметы имеют market_hash_name');
      process.exit(0);
    }
    console.log('❗ Предметы без market_hash_name:');
    for (const r of rows) {
      console.log(`#${r.id} [${r.case_id} ${r.case_name}] name="${r.name}" en="${r.english_name}" wear="${r.wear}"`);
    }
    process.exit(1);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
