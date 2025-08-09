// flashdrops-backend/src/utils/marketName.js

const WEAR_MAP_RU_TO_EN = new Map([
  ['Прямо с завода', 'Factory New'],
  ['Немного поношенное', 'Minimal Wear'],
  ['После полевых испытаний', 'Field-Tested'],
  ['Поношенное', 'Well-Worn'],
  ['Закалённое в боях', 'Battle-Scarred'],
]);

function toWearEN(wear) {
  if (!wear) return null;
  if (WEAR_MAP_RU_TO_EN.has(wear)) return WEAR_MAP_RU_TO_EN.get(wear);
  return wear; // уже на EN
}

function buildMarketHashName({ english_name, wear, is_stattrak = false, is_souvenir = false }) {
  if (!english_name || !wear) return null;
  const prefix = is_souvenir ? 'Souvenir ' : (is_stattrak ? 'StatTrak™ ' : '');
  return `${prefix}${english_name} (${wear})`;
}

/**
 * Нормализация ответа Steam классов (GetAssetClassInfo)
 * classInfo.tags → ищем Exterior / StatTrak / Souvenir
 */
function normalizeClassInfo(classInfo) {
  const english_name = classInfo?.market_name || classInfo?.name || null;
  const tags = Array.isArray(classInfo?.tags) ? classInfo.tags : [];
  let wear = null;
  let is_stattrak = false;
  let is_souvenir = false;

  for (const t of tags) {
    const cat = (t.category || '').toLowerCase();
    const name = t.name || '';
    if (cat.includes('exterior')) {
      wear = toWearEN(name);
    }
    // некоторые классы помечают stattrak/souvenir не только тегом type, но и market_name
    if (/^stattrak/i.test(name) || /StatTrak/i.test(classInfo?.market_name || '')) {
      is_stattrak = true;
    }
    if (/Souvenir/i.test(name) || /Souvenir/i.test(classInfo?.market_name || '')) {
      is_souvenir = true;
    }
  }

  const image = classInfo?.icon_url ? `https://steamcommunity-a.akamaihd.net/economy/image/${classInfo.icon_url}/512x384` : null;

  const mhn =
    classInfo?.market_hash_name ||
    buildMarketHashName({ english_name, wear, is_stattrak, is_souvenir });

  return {
    english_name,
    wear,
    is_stattrak,
    is_souvenir,
    market_hash_name: mhn,
    image,
    display_name: classInfo?.name || english_name || mhn || 'Unknown'
  };
}

module.exports = { buildMarketHashName, normalizeClassInfo, toWearEN };
// Собираем market_hash_name из english_name + wear + флаги
function buildMarketHashName({ english_name, wear, is_stattrak = false, is_souvenir = false }) {
  if (!english_name || !wear) return null;
  const prefix = is_souvenir ? 'Souvenir ' : (is_stattrak ? 'StatTrak™ ' : '');
  return `${prefix}${english_name} (${wear})`;
}

module.exports = { buildMarketHashName };
