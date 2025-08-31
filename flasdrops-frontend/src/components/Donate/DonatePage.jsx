// flashdrops-frontend/src/components/Donate/DonatePage.jsx
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './DonatePage.css';

export default function DonatePage() {
  const params = useParams();
  const handle = params?.handle;

  const title = useMemo(() => {
    if (!handle) return 'Roman Yu.';
    return handle
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }, [handle]);

  const [method, setMethod]   = useState('card'); // 'card' | 'sbp'
  const [amount, setAmount]   = useState(300);
  const [name, setName]       = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy]       = useState(false);
  const [note, setNote]       = useState('');

  const presets = [100, 300, 500, 1000, 2000];
  const valid = Number.isFinite(+amount) && +amount >= 10;

  const onPreset = (v) => setAmount(v);

  const emitBalance = (b) => {
    if (typeof b === 'number') {
      window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(b) || 0 }));
    }
  };

  async function pollStatus(depositId, { maxTries = 30, delayMs = 2000 } = {}) {
    for (let i = 0; i < maxTries; i++) {
      await new Promise(r => setTimeout(r, delayMs));
      try {
        const { data } = await axios.get(`/api/deposits/${depositId}/status`, {
          withCredentials: true,
          params: { _ts: Date.now() }
        });
        if (data?.status === 'succeeded') {
          if (typeof data.balance === 'number') emitBalance(data.balance);
          setNote('Платёж подтверждён. Баланс зачислен.');
          return true;
        }
        if (data?.status === 'failed' || data?.status === 'canceled') {
          setNote('Платёж отменён или не удался.');
          return false;
        }
      } catch {
        // ignore and keep polling
      }
    }
    setNote('Проверка платежа заняла слишком много времени. Обновите страницу или проверьте позже.');
    return false;
  }

  const onPay = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;

    setBusy(true);
    setNote('');
    try {
      const { data } = await axios.post('/api/deposits/create', {
        amount: Number(amount),
        method,
        name,
        message
      }, { withCredentials: true });

      if (!data?.confirmation_url) {
        setNote('Не удалось инициализировать оплату.');
        setBusy(false);
        return;
      }

      // Открываем оплату ЮKassa (карта/СБП с QR)
      window.open(data.confirmation_url, '_blank', 'noopener');

      // Ожидаем подтверждение
      await pollStatus(data.deposit_id);
    } catch (err) {
      setNote(err?.response?.data?.error || 'Ошибка инициализации платежа');
    } finally {
      setBusy(false);
    }
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
              disabled={busy}
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
                disabled={busy}
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
                  disabled={busy}
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
              disabled={busy}
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
                disabled={busy}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2Zm-2 6h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6Zm4 4h6v2H5v-2Z" fill="currentColor"/>
                </svg>
                Карты
              </button>
              <button
                type="button"
                className={`method ${method === 'sbp' ? 'selected' : ''}`}
                onClick={() => setMethod('sbp')}
                aria-pressed={method === 'sbp'}
                title="СБП"
                disabled={busy}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.7 3.7v7.98L12 19.7 5.3 16V8.02L12 4.3Z" fill="currentColor"/>
                </svg>
                СБП
              </button>
            </div>
          </div>

          <button className="pay-btn" type="submit" disabled={!valid || busy}>
            {busy ? 'Ожидание…' : 'Оплатить'}
          </button>

          {!!note && <div style={{ marginTop: 10 }}>{note}</div>}

          <p className="terms">
            Совершая платёж вы соглашаетесь с <a href="#" onClick={e => e.preventDefault()}>Условиями сервиса</a>.
          </p>
        </form>
      </div>
    </div>
  );
}
