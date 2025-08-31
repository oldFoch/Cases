// глобальные настройки валюты (FC)
export const MONEY_CFG = {
  code: 'FC',
  decimals: 2,
  symbol: 'FC',            // текстовый символ
  iconUrl: '/images/fc.png' // путь к картинке монетки (положи /public/images/fc.png)
};

export function formatMoneyFC(v) {
  const n = Number(v) || 0;
  return `${n.toFixed(MONEY_CFG.decimals)} ${MONEY_CFG.code}`;
}

// диспатч в UI отформатированного баланса
export function broadcastBalanceFC(raw) {
  const val = Number(raw) || 0;
  const formatted = formatMoneyFC(val);
  window.dispatchEvent(
    new CustomEvent('balance:update:fc', { detail: { raw: val, formatted } })
  );
}
