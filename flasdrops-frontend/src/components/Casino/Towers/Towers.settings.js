// Все настройки и «подкрутки» для Towers в одном месте
export const TOWERS_CFG = {
  // ширина поля в колонках
  cols: 10,

  // пресеты размеров поля
  rowModes: [
    { key: 'r3', rows: 3, title: '3 × 10' },
    { key: 'r5', rows: 5, title: '5 × 10' },
  ],

  // сложности: базовые бомбы/колонку и множитель за шаг
  diffs: [
    { key: 'easy',   title: 'Лёгкая',  bombsPerCol: 1, coefPerStep: 1.10 },
    { key: 'medium', title: 'Средняя', bombsPerCol: 2, coefPerStep: 1.25 },
    { key: 'hard',   title: 'Сложная', bombsPerCol: 3, coefPerStep: 1.55 },
  ],

  // Переопределение кол-ва бомб для конкретных размеров:
  // пример из твоего запроса: для 5×10 сделать 2/3/4 вместо 1/2/3
  bombsOverride(rows, diffKey, base) {
    if (rows === 5) {
      if (diffKey === 'easy')   return 2;
      if (diffKey === 'medium') return 3;
      if (diffKey === 'hard')   return 4;
    }
    return base; // для 3×10 — как было
  },

  // UI-параметры (можно смело крутить размеры поля)
  ui: {
    minCellPx: 40,          // минимальный размер клетки
    stageHeightVH: 0.7,     // доля высоты окна, которую может занять поле (без панели)
    sidePanelWidthPx: 300,  // ширина правой панели
    gapPx: 8,               // зазоры между клетками
  }
};
