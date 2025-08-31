'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../src/db');
const { updateMasterItemPrice, updateLegacyCaseItemPrice } = require('../src/services/priceService');

const STEP_MS = 1500; // пауза между запросами
const COOLDOWN_MS = Number(process.env.PRICE_RATE_LIMIT_COOLDOWN_MS) || 600000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function loadTargets(caseId) {
  const targets = [];

  // master через case_items_map (только то, что реально в кейсах)
  const params = [];
  let filter = '';
  if (caseId) { params.push(caseId); filter = 'AND cim.case_id = $1'; }
  const m = await db.query(
    `
    SELECT DISTINCT im.id, im.market_hash_name
      FROM items_master im
      JOIN case_items_map cim ON cim.item_id = im.id
     WHERE im.market_hash_name IS NOT NULL
       ${filter}
    `, params
  );
  m.rows.forEach(r => targets.push({ src: 'master', id: r.id, mhn: r.market_hash_name }));

  // legacy case_items (если такие есть)
  const params2 = [];
  let filter2 = '';
  if (caseId) { params2.push(caseId); filter2 = 'AND ci.case_id = $1'; }
  const l = await db.query(
    `
    SELECT ci.id, ci.market_hash_name
      FROM case_items ci
     WHERE ci.market_hash_name IS NOT NULL
       ${filter2}
    `, params2
  );
  l.rows.forEach(r => targets.push({ src: 'legacy', id: r.id, mhn: r.market_hash_name }));

  // дедуп по market_hash_name: приоритет master
  const byMHN = new Map();
  for (const t of targets) {
    const key = t.mhn.trim().toLowerCase();
    if (!key) continue;
    const exist = byMHN.get(key);
    if (!exist || (exist.src === 'legacy' && t.src === 'master')) {
      byMHN.set(key, t);
    }
  }
  return Array.from(byMHN.values());
}

(async () => {
  const argCase = process.argv.find(a => a.startsWith('--case='));
  const caseId = argCase ? argCase.split('=')[1] : null;

  const list = await loadTargets(caseId);
  console.log(`Repricing ${list.length} items${caseId ? ` for case ${caseId}` : ''} ...`);

  let ok = 0, fail = 0;
  for (const t of list) {
    try {
      const res = t.src === 'master'
        ? await updateMasterItemPrice(db, t.mhn)
        : await updateLegacyCaseItemPrice(db, t.id, t.mhn);

      if (res.ok) {
        ok++;
        console.log(`OK (${t.src}): ${t.mhn} → ${res.price}`);
      } else {
        if (res.error === 'rate-limit' || [429,403,503].includes(res.status)) {
          console.warn(`[rate-limit] cooldown ${Math.round(COOLDOWN_MS/60000)}m`);
          await sleep(COOLDOWN_MS);
          continue;
        }
        fail++;
        console.warn(`FAIL (${t.src}): ${t.mhn} — ${res.error} ${res.status || ''}`);
      }
    } catch (e) {
      fail++;
      console.warn(`ERR  (${t.src}): ${t.mhn} — ${e.code || e.message}`);
    }
    await sleep(STEP_MS);
  }

  console.log(`Done: ok=${ok}, fail=${fail}`);
  process.exit(0);
})();
