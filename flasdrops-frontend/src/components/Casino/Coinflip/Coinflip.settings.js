// Все настройки в одном месте
export const COINFLIP_SETTINGS = {
  // геометрия/анимация
  coinSizePx: 450,     // диаметр монеты
  marginTopPx: 280,     // отступ сверху от тикера/шапки
  animationMs: 1150,   // длительность анимации кручения

  // режимы: имя, множитель выплаты, шанс выигрыша (0..1)
  modes: {
    easy:   { name: 'Лёгкая',  payout: 1.10, winChance: 0.40 },
    medium: { name: 'Средняя', payout: 1.35, winChance: 0.20 },
    hard:   { name: 'Сложная', payout: 1.50, winChance: 0.07 },
  }
};
