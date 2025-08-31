// flashdrops-backend/src/services/fxService.js
'use strict';
const db = require('../db');

const FX_TTL_MINUTES   = Number(process.env.FX_TTL_MINUTES   || 720);  // 12h
const FETCH_TIMEOUT_MS = Number(process.env.FX_FETCH_TIMEOUT_MS || 2500);

const PROVIDERS = [
  ({ base, quote }) => `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`,
  ({ base, quote }) => `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`,
  ({ base })         => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`
];

const mem = new Map(); // "BASE->QUOTE" → { rate, exp }

const now = () => Date.now();
const ms  = (m) => m * 60 * 1000;
const k   = (b,q) => `${b.toUpperCase()}->${q.toUpperCase()}`;
const fresh = (e) => e && e.exp > now();

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw Object.assign(new Error(`fx-bad-status:${res.status}`), { status: res.status });
    return await res.json();
  } finally { clearTimeout(t); }
}

function pickRate(json, base, quote) {
  if (json?.rates && typeof json.rates[quote] === 'number') return json.rates[quote];         // frankfurter/exchangerate.host
  if (json?.result === 'success' && json?.rates && typeof json.rates[quote] === 'number') return json.rates[quote]; // open.er-api
  return null;
}

async function fetchOnline(base, quote) {
  let last;
  for (const build of PROVIDERS) {
    try {
      const j = await fetchWithTimeout(build({ base, quote }));
      const r = pickRate(j, base, quote);
      if (r && isFinite(r) && r > 0) return Number(r);
    } catch (e) { last = e; }
  }
  throw last || new Error('fx-no-provider');
}

async function readDb(base, quote) {
  const { rows } = await db.query(
    `SELECT rate, updated_at FROM fx_rates WHERE base=$1 AND quote=$2`, [base, quote]
  );
  if (!rows.length) return null;
  const rate = Number(rows[0].rate);
  const ok = now() - new Date(rows[0].updated_at).getTime() < ms(FX_TTL_MINUTES);
  return { rate, fresh: ok };
}

async function writeDb(base, quote, rate) {
  await db.query(
    `INSERT INTO fx_rates (base, quote, rate, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (base, quote)
     DO UPDATE SET rate=EXCLUDED.rate, updated_at=NOW()`,
    [base, quote, rate]
  );
}

async function getFx(base, quote, { forceRefresh = false } = {}) {
  base = base.toUpperCase(); quote = quote.toUpperCase();
  if (base === quote) return 1;

  const key = k(base, quote);
  const m = mem.get(key);
  if (!forceRefresh && fresh(m)) return m.rate;

  if (!forceRefresh) {
    const dbRow = await readDb(base, quote);
    if (dbRow?.fresh) {
      mem.set(key, { rate: dbRow.rate, exp: now() + ms(5) });
      return dbRow.rate;
    }
  }

  const rate = await fetchOnline(base, quote);
  mem.set(key, { rate, exp: now() + ms(FX_TTL_MINUTES) });
  try { await writeDb(base, quote, rate); } catch {}
  return rate;
}

// Steam codes: 5=RUB, 3=EUR, 1=USD
async function toRub(amount, steamCurrencyCode) {
  const n = Number(amount) || 0;
  if (steamCurrencyCode === 5) return n;
  if (steamCurrencyCode === 3) {
    const eurRub = await getFx('EUR', 'RUB');
    return Math.round(n * eurRub * 100) / 100;
  }
  if (steamCurrencyCode === 1) {
    const usdRub = await getFx('USD', 'RUB');
    return Math.round(n * usdRub * 100) / 100;
  }
  // fallback по env при нестандартном коде
  if (steamCurrencyCode === 3 && process.env.FX_EUR_RUB) return Math.round(n * Number(process.env.FX_EUR_RUB) * 100) / 100;
  if (steamCurrencyCode === 1 && process.env.FX_USD_RUB) return Math.round(n * Number(process.env.FX_USD_RUB) * 100) / 100;
  throw new Error('unsupported-currency');
}

async function refreshAll() {
  const pairs = [['EUR','RUB'], ['USD','RUB']];
  for (const [b,q] of pairs) {
    try {
      const r = await fetchOnline(b,q);
      await writeDb(b,q,r);
      mem.set(k(b,q), { rate: r, exp: now() + ms(FX_TTL_MINUTES) });
      console.log(`[fx] updated ${b}->${q}: ${r}`);
    } catch (e) {
      console.warn(`[fx] update fail ${b}->${q}: ${e.message}`);
    }
  }
}

module.exports = { getFx, toRub, refreshAll };
