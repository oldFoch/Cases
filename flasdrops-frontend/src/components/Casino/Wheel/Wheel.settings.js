// Конфиг колеса (синхронизированный раунд)
export const WHEEL_CFG = {
  segments: 37,                  // 0..36
  yellowIndex: 0,                // жёлтый сектор (аналог "0")

  // Выплаты — UI; реальный расчёт делает бэк
  payout: {
    color: 1.3,                  // красный/чёрный
    yellow: 10.0,                // жёлтый (один сектор)
    number: 8.0                 // точное число
  },

  // Хронометраж: 22s ставки + 23s спин = 45s
  roundMs: 45000,
  betWindowMs: 22000,            // приём ставок 22s
  spinMs: 23000,                 // кручение ~23s

  // Геометрия (уменьшено ~10% от прошлой версии)
  wheelSize: 1008,
  centerButton: 252,
  marginTopPx: 20,

  // Анимация
  minTurns: 6,
  maxTurnsRand: 4,

  // Цвета
  colorRed:   '#ff3b30',
  colorBlack: '#1f1f1f',
  colorYellow:'#ffd000',
  labelColor: '#f6d645'
};

// Цвет сектора по индексу
export function colorOf(index, cfg = WHEEL_CFG) {
  if (index === cfg.yellowIndex) return 'yellow';
  return (index % 2 === 0) ? 'black' : 'red';
}

// Детерминированный индекс по номеру раунда — у всех одинаково
export function seededIndexByRound(roundId, segments = 37) {
  let x = (roundId ^ 0x9e3779b9) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) % segments;
}
