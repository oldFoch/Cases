// flashdrops-backend/src/services/steamFallback.js
// Фолбэк: получить минимальную цену с Steam по base_name, перебрав качества.

const { getPriceWithCache } = require('./priceService');

// порядок попыток качеств (без StatTrak™/Souvenir)
const WEARS = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred'
];

// попробуем без качества (на случай уникальных предметов), затем по качествам
async function bestPriceForBaseName(baseName) {
  const candidates = [`${baseName}`, ...WEARS.map(w => `${baseName} (${w})`)];
  const found = [];

  for (const mhn of candidates) {
    try {
      const p = await getPriceWithCache(mhn);
      if (Number.isFinite(p)) found.push(p);
    } catch {
      // молча пропускаем неудачные варианты
    }
  }

  if (!found.length) return null;
  return Math.min(...found);
}

module.exports = { bestPriceForBaseName };
