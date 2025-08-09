// Запуск: node scripts/setMhnMap.js
// Отредактируй MAPPING: слева локальное имя из БД (например, "Гипноз"),
// справа точный Steam market_hash_name (например, "Desert Eagle | Hypnotic (Factory New)")

require('dotenv').config();
const db = require('../src/db');

const CASE_NAME = 'ВАШ_КЕЙС'; // либо null, если по всем кейсам
const MAPPING = {
  // ЛОКАЛЬНОЕ_ИМЯ : 'Steam Market Hash Name'
  'Гипноз': 'Desert Eagle | Hypnotic (Factory New)',
  // 'Красная линия': 'AK-47 | Redline (Field-Tested)',
};

(async () => {
  try {
    for (const [localName, mhn] of Object.entries(MAPPING)) {
      const args = [mhn, localName];
      let sql = `UPDATE case_items SET market_hash_name = $1 WHERE name = $2`;
      if (CASE_NAME) {
        sql += ` AND case_id = (SELECT id FROM cases WHERE name = $3)`;
        args.push(CASE_NAME);
      }
      const r = await db.query(sql, args);
      console.log(`${localName} -> ${mhn} | updated: ${r.rowCount}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
