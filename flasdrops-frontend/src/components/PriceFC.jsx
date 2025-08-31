import React from 'react';
import { formatMoneyFC } from '../config/money';
import '../styles/money.css'; // чтобы были стили с иконкой при желании

export default function PriceFC({ value, withIcon = false }) {
  const text = formatMoneyFC(value);
  if (withIcon) {
    return <span className="user-balance">{text}</span>; // переиспользуем стиль с иконкой
  }
  return <span>{text}</span>;
}
