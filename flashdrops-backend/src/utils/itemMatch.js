// flashdrops-backend/src/utils/itemMatch.js

function baseFromMHN(mhn) {
  if (!mhn) return null;
  let s = mhn.replace(/^Souvenir\s+|^StatTrak™\s+/i, '');
  s = s.replace(/\s*\([^)]+\)\s*$/, '');
  return s.trim();
}

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[™®]/g, '')
    .trim();
}

function normArray(arr) {
  return (arr || []).map(norm);
}

/**
 * Все предметы — Desert Eagle.
 * RU → EN (base_name без качества):
 *  - Код красный           → Desert Eagle | Code Red
 *  - Гипноз                → Desert Eagle | Hypnotic
 *  - Океанское побережье   → Desert Eagle | Ocean Drive
 *  - Оксидное пламя        → Desert Eagle | Oxide Blaze
 *  - Метеорит              → Desert Eagle | Meteorite
 *  - Золотой карп          → Desert Eagle | Golden Koi
 */
function ru2enCandidates(ruName) {
  const n = norm(ruName);
  switch (n) {
    case 'код красный':           return ['Desert Eagle | Code Red'];
    case 'гипноз':                return ['Desert Eagle | Hypnotic'];
    case 'океанское побережье':   return ['Desert Eagle | Ocean Drive'];
    case 'оксидное пламя':        return ['Desert Eagle | Oxide Blaze'];
    case 'метеорит':              return ['Desert Eagle | Meteorite'];
    case 'золотой карп':          return ['Desert Eagle | Golden Koi'];
    default:                      return [ruName];
  }
}

function resolveBaseKeys(item) {
  if (item?.english_name) return [item.english_name];
  if (item?.market_hash_name) {
    const b = baseFromMHN(item.market_hash_name);
    return b ? [b] : [];
  }
  return ru2enCandidates(item?.name || '');
}

module.exports = { baseFromMHN, norm, normArray, resolveBaseKeys };
