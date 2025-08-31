// Только конфиг — без JSX
export const PLINKO_CFG = {
  // геометрия сцены
  width: 820,
  height: 620,
  paddingX: 60,
  padTop: 40,
  groundOffset: 58,

  // ПИРАМИДА (вершина сверху)
  rows: 12,    // 12 рядов штырей
  // слоты — на одну больше, чем рядов (тут 13)
  slotCount: 13,
  slotHeight: 50,

  // коэфы по слотам (слева → справа), центр — самый «частый»
  slotCoeffs: [3.52, 1.65, 1.35, 1.10, 1.00, 0.88, 0.77, 0.66, 0.77, 0.88, 1.00, 1.10, 1.35],

  // размеры
  pegRadius: 4,
  ballRadius: 10, // шарик чуть больше, как просил

  // физика
  gravity: 1800,
  restitution: 0.52,
  wallRestitution: 0.35,
  tangentFriction: 0.98,
  airFriction: 0.02,
  fixedDt: 1 / 120,
  maxSubSteps: 8,

  // UI
  marginTopPx: 180,

  // значение по умолчанию для ставки
  defaultBet: 100,

  // вертикальный шаг минимум (только для подстраховки)
  gapYMin: 26,
};
