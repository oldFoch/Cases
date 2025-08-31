// backend/utils/minesMath.js
// Математика минного поля по твоему описанию.
// T — всего клеток, m — мин, k — число УЖЕ пройденных безопасных кликов.
// h — рейк (например, 0.04 = 4%). Все формулы — без замены.

// --- базовые утилы ---
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * Вероятность пройти РОВНО следующий шаг (k -> k+1), если уже k пройдено.
 * P(next safe | k done) = (T - m - k) / (T - k)
 */
function pNextSafe(T, m, k) {
  if (k < 0 || k >= T) return 0;
  return (T - m - k) / (T - k);
}

/**
 * Вероятность пройти k шагов подряд без взрыва:
 * P_k = Π_{j=0..k-1} (T - m - j) / (T - j)
 */
function pK(T, m, k) {
  if (k <= 0) return 1;
  k = Math.floor(k);
  if (k > T - m) return 0; // нельзя пройти больше, чем безопасных клеток
  let p = 1;
  for (let j = 0; j < k; j++) {
    p *= (T - m - j) / (T - j);
  }
  return p;
}

/**
 * Честный множитель за k шагов: 1 / P_k
 */
function fairMult(T, m, k) {
  const pk = pK(T, m, k);
  if (pk <= 0) return Infinity;
  return 1 / pk;
}

/**
 * Казино-множитель с рейком h: M_k = (1 / P_k) * (1 - h)
 */
function houseMult(T, m, k, h = 0.04) {
  h = clamp(h, 0, 0.99);
  const fm = fairMult(T, m, k);
  if (!isFinite(fm)) return Infinity;
  return fm * (1 - h);
}

/**
 * Предрасчёт таблицы на все шаги (1..T-m)
 * row: { step, pStep, pCum, fair, house }
 */
function table(T, m, h = 0.04) {
  const maxSteps = Math.max(0, T - m);
  const out = [];
  let pCum = 1;
  for (let k = 0; k < maxSteps; k++) {
    const pStep = pNextSafe(T, m, k);
    pCum *= pStep; // = P_{k+1}
    const step = k + 1;
    out.push({
      step,
      pStep,              // шанс именно следующего шага
      pCum,               // шанс дожить до этого шага суммарно
      fair: 1 / pCum,     // честный множитель за "step"
      house: (1 / pCum) * (1 - h),
    });
  }
  return out;
}

/**
 * Сумма к выплате при кэш-ауте после k безопасных кликов.
 * bet может быть в FC (float) или в "минорах" (инт), см. свои деньги.
 * Роундим до 2 знаков (убери/измени под свою систему).
 */
function cashoutAmount(bet, T, m, k, h = 0.04) {
  const mult = houseMult(T, m, k, h);
  const raw = bet * mult;
  return Math.round(raw * 100) / 100;
}

/**
 * Удобная обёртка под UI:
 *   - currentK: сколько уже открыто безопасно
 *   - nextOdds: шанс, что следующий клик пройдёт
 *   - currentCashout: сколько выплатится прямо сейчас
 *   - nextTargetMult: множитель, если сделать ещё один безопасный клик (k+1)
 */
function uiState({ bet, T, m, k, h = 0.04 }) {
  const nextOdds = pNextSafe(T, m, k);
  const currentMult = houseMult(T, m, k, h);
  const nextMult = houseMult(T, m, k + 1, h);
  return {
    nextOdds,                 // 0..1
    currentMult,              // текущий множитель
    currentCashout: Math.round(bet * currentMult * 100) / 100,
    nextTargetMult: nextMult, // целевой множитель после ещё одного шага
  };
}

module.exports = {
  pNextSafe,
  pK,
  fairMult,
  houseMult,
  table,
  cashoutAmount,
  uiState,
};
