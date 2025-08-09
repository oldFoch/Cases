import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import './DonatePage.css';

export default function DonatePage() {
  const { handle } = useParams?.() || {};
  const title = useMemo(() => {
    if (!handle) return 'Roman Yu.';
    // Красиво форматируем handle из URL: romanyu -> Roman Yu.
    return handle
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w ? w[0].toUpperCase() + w.slice(1) : '')
      .join(' ');
  }, [handle]);

  const [method, setMethod] = useState('card'); // 'card' | 'sbp'
  const [amount, setAmount] = useState(300);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const presets = [100, 300, 500, 1000, 2000];

  const valid = Number.isFinite(+amount) && +amount >= 10;

  const onPreset = v => setAmount(v);

  const onPay = e => {
    e.preventDefault();
    if (!valid) return;
    // TODO: здесь подключите свой бэкенд платежей
    alert(`Оплата: ${amount} ₽, метод: ${method}\nИмя: ${name || 'Аноним'}\nСообщение: ${message || '—'}`);
  };

  return (
    <div className="donate-page">
      <div className="donate-card">
        <div className="donate-header">
          <div className="avatar" aria-hidden />
          <h1 className="creator">{title}</h1>
        </div>

        <form className="form" onSubmit={onPay}>
          <label className="field">
            <span className="label">Ваше имя</span>
            <input
              className="input"
              type="text"
              placeholder="Как к вам обращаться?"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={64}
            />
          </label>

          <label className="field">
            <span className="label">Сумма</span>
            <div className="amount-wrap">
              <input
                className="input amount"
                type="number"
                min={10}
                step="10"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <span className="ruble">₽</span>
            </div>
            <div className="presets">
              {presets.map(v => (
                <button
                  type="button"
                  key={v}
                  className={`chip ${+amount === v ? 'active' : ''}`}
                  onClick={() => onPreset(v)}
                >
                  {v} ₽
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span className="label">Ваше сообщение</span>
            <textarea
              className="input textarea"
              placeholder="Напишите что-нибудь приятное :)"
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={400}
              rows={3}
            />
          </label>

          <div className="pay-methods">
            <span className="label">С помощью:</span>
            <div className="methods">
              <button
                type="button"
                className={`method ${method === 'card' ? 'selected' : ''}`}
                onClick={() => setMethod('card')}
                aria-pressed={method === 'card'}
                title="Банковская карта"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2Zm-2 6h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6Zm4 4h6v2H5v-2Z" fill="currentColor"/></svg>
                Карты
              </button>
              <button
                type="button"
                className={`method ${method === 'sbp' ? 'selected' : ''}`}
                onClick={() => setMethod('sbp')}
                aria-pressed={method === 'sbp'}
                title="СБП"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.7 3.7v7.98L12 19.7 5.3 16V8.02L12 4.3Z" fill="currentColor"/></svg>
                СБП
              </button>
            </div>
          </div>

          <button className="pay-btn" type="submit" disabled={!valid}>
            Оплатить
          </button>

          <p className="terms">
            Совершая платёж вы соглашаетесь с <a href="#" onClick={e => e.preventDefault()}>Условиями сервиса</a>.
          </p>
        </form>
      </div>
    </div>
  );
}
