"use strict";
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const db = require("../src/db");
const { updateMasterItemPrice, updateLegacyCaseItemPrice } = require("../src/services/priceService");

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const STEP_MS = 1500;

(async () => {
  const caseId = process.argv[2];
  if (!caseId) { console.log("Usage: node scripts/updateCasePrices.js <caseId>"); process.exit(1); }

  // master через map
  const master = await db.query(
    `SELECT im.id, im.market_hash_name
       FROM case_items_map cim
       JOIN items_master im ON im.id = cim.item_id
      WHERE cim.case_id = $1 AND im.market_hash_name IS NOT NULL
      ORDER BY cim.id`, [caseId]
  );

  // legacy
  const legacy = await db.query(
    `SELECT id, market_hash_name
       FROM case_items
      WHERE case_id = $1 AND market_hash_name IS NOT NULL
      ORDER BY id`, [caseId]
  );

  console.log(`Updating case ${caseId}: master=${master.rowCount}, legacy=${legacy.rowCount}`);
  let ok = 0, fail = 0;

  for (const r of master.rows) {
    const res = await updateMasterItemPrice(db, r.market_hash_name);
    if (res.ok) { ok++; console.log("OK (master):", r.market_hash_name, res.price); }
    else { fail++; console.warn("FAIL (master):", r.market_hash_name, res.error); }
    await delay(STEP_MS);
  }
  for (const r of legacy.rows) {
    const res = await updateLegacyCaseItemPrice(db, r.id, r.market_hash_name);
    if (res.ok) { ok++; console.log("OK (legacy):", r.market_hash_name, res.price); }
    else { fail++; console.warn("FAIL (legacy):", r.market_hash_name, res.error); }
    await delay(STEP_MS);
  }

  console.log(`Done: ok=${ok}, fail=${fail}`);
  process.exit(0);
})();
