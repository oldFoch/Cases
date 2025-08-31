// src/config/currency.js
module.exports = {
  CURRENCY_CODE: 'FC',           // наш код
  CURRENCY_SYMBOL: 'FC',         // как отображаем
  BASE_RATE_TO_RUB: 1,           // 1 FC == 1 RUB
  // если в будущем захочешь курс — просто поменяешь тут
  format(amount) {
    // храним как число, округляем до 2 знаков на отдачу
    const v = Math.round(Number(amount || 0) * 100) / 100;
    return `${v}${this.CURRENCY_SYMBOL}`;
  },
  toRUB(amountFC) {
    return Math.round(Number(amountFC || 0) * this.BASE_RATE_TO_RUB * 100) / 100;
  },
  fromRUB(amountRUB) {
    return Math.round(Number(amountRUB || 0) / this.BASE_RATE_TO_RUB * 100) / 100;
  },
};
