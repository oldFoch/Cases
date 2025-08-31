'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../src/db');
const { updateMasterItemPrice, updateLegacyCaseItemPrice } = require('../src/services/priceService');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const STEP_MS = 1500;

async function pickMissing(caseId) {
  const params = [];
  let filterCase = '';
  if (caseId) { params.push(caseId); filterCase = 'AND cim.case_id = $1'; }

  const qMaster = await db.query(
    `
    SELECT im.id, im.market_hash_name, im.name_ru
      FROM items_master im
      JOIN case_items_map cim ON cim.item_id = im.id
     WHERE im.market_hash_name IS NOT NULL
       ${filterCase}
       AND (im.price IS NULL OR im.price <= 0 OR im.price_updated_at IS NULL)
    `,
    params
  );

  const params2 = [];
  let filterLegacy = '';
  if (caseId) { params2.push(caseId); filterLegacy = 'AND ci.case_id = $1'; }

  const qLegacy = await db.query(
    `
    SELECT ci.id, ci.market_hash_name, ci.name
      FROM case_items ci
     WHERE ci.market_hash_name IS NOT NULL
       ${filterLegacy}
       AND (ci.price IS NULL OR ci.price <= 0 OR ci.price_updated_at IS NULL)
    `,
    params2
  );

  return { master: qMaster.rows, legacy: qLegacy.rows };
}

(async () => {
  const caseIdArg = process.argv.find(a => a.startsWith('--case='));
  const caseId = caseIdArg ? caseIdArg.split('=')[1] : null;

  const lists = await pickMissing(caseId);
  const total = lists.master.length + lists.legacy.length;
  console.log(`Found missing prices: master=${lists.master.length}, legacy=${lists.legacy.length}, total=${total}`);
  if (!total) process.exit(0);

  let ok = 0, fail = 0;

  for (const r of lists.master) {
    const res = await updateMasterItemPrice(db, r.market_hash_name);
    if (res.ok) { ok++; console.log(`OK (master): ${r.market_hash_name} → ${res.price}`); }
    else { fail++; console.warn(`FAIL (master): ${r.market_hash_name} — ${res.error} ${res.status || ''}`); }
    await sleep(STEP_MS);
  }

  for (const r of lists.legacy) {
    const res = await updateLegacyCaseItemPrice(db, r.id, r.market_hash_name);
    if (res.ok) { ok++; console.log(`OK (legacy): ${r.market_hash_name} → ${res.price}`); }
    else { fail++; console.warn(`FAIL (legacy): ${r.market_hash_name} — ${res.error} ${res.status || ''}`); }
    await sleep(STEP_MS);
  }

  console.log(`Done: ok=${ok}, fail=${fail}`);
  process.exit(0);
})();
