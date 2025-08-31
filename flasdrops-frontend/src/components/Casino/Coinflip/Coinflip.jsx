// flashdrops-frontend/src/components/Casino/Coinflip/Coinflip.jsx
import React, { useMemo, useState } from 'react';
import './Coinflip.css';
import { COINFLIP_SETTINGS } from './Coinflip.settings';
import { refreshBalanceAndBroadcast } from '../../../utils/balance';

// CT (heads) / T (tails)
const FACE_LABEL = { heads: 'CT', tails: 'T' };

export default function Coinflip() {
  const cfg = COINFLIP_SETTINGS;
  const [bet, setBet] = useState(100);
  const [mode, setMode] = useState('easy');          // easy | medium | hard
  const [choice, setChoice] = useState('heads');     // heads | tails

  const [flipKey, setFlipKey] = useState(0);         // перезапуск анимации
  const [spinning, setSpinning] = useState(false);

  const [hiddenResult, setHiddenResult] = useState(null); // результат сразу (скрытый)
  const [shownResult, setShownResult] = useState(null);   // показываем ПОСЛЕ анимации

  const m = cfg.modes[mode] || cfg.modes.easy;

  // аккуратный парсер ставки
  const betNum = useMemo(() => {
    const v = Number(bet);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.floor(v * 100) / 100;
  }, [bet]);

  const canSpin = betNum > 0 && !spinning;

  const spin = async () => {
    if (!canSpin) return;

    setSpinning(true);
    setShownResult(null);

    // решает бэкенд: списывает/выдаёт и возвращает новый баланс
    let data;
    try {
      const r = await fetch('/api/casino/coinflip/play', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: betNum, mode, choice })
      });
      data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'coinflip fail');
    } catch (e) {
      setSpinning(false);
      alert(e.message || 'Ошибка coinflip');
      return;
    }

    const immediate = {
      landed: data.landed,   // heads | tails
      outcome: data.outcome, // win | lose
      mode,
      payout: data.payout,
      delta: data.delta
    };

    // запускаем анимацию
    setHiddenResult(immediate);
    setFlipKey(k => k + 1);

    // показываем после окончания анимации
    setTimeout(() => {
      setShownResult(immediate);
      setSpinning(false);

      if (typeof data.balance === 'number') {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(data.balance) || 0 }));
      } else {
        refreshBalanceAndBroadcast();
      }
    }, cfg.animationMs);
  };

  // стиль-bridge для CSS-переменных
  const wrapStyle = {
    '--coin-size': `${cfg.coinSizePx}px`,
    '--flip-dur': `${cfg.animationMs}ms`
  };

  // фиксатор стороны ПОСЛЕ анимации
  const stayClass =
    shownResult
      ? (shownResult.landed === 'heads' ? 'stay-heads' : 'stay-tails')
      : '';

  // класс для ЗАПУСКА анимации
  const flipClass =
    hiddenResult
      ? `flipping ${hiddenResult.landed}` // flipping heads | flipping tails
      : '';

  return (
    <div className="coinflip-wrap">
      {/* верхний отступ регулируется в настройках */}
      <div style={{ height: `${cfg.marginTopPx}px` }} />

      <div className="cf-panel" style={{ textAlign: 'center' }}>
        {/* Монета */}
        <div className="coinflip-stage">
          <div className={`coin ${stayClass} ${flipClass}`} style={wrapStyle} key={flipKey}>
            <div className="side heads">CT</div>
            <div className="side tails">T</div>
          </div>
        </div>

        {/* Управление */}
        <div className="cf-controls">
          <input
            className="cf-input"
            type="number"
            min="1"
            step="1"
            value={bet}
            onChange={e => setBet(e.target.value)}
            placeholder="Ставка FC"
          />

          <select className="cf-select" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="easy">Лёгкая ×{cfg.modes.easy.payout}</option>
            <option value="medium">Средняя ×{cfg.modes.medium.payout}</option>
            <option value="hard">Сложная ×{cfg.modes.hard.payout}</option>
          </select>

          <select className="cf-select" value={choice} onChange={e => setChoice(e.target.value)}>
            <option value="heads">CT</option>
            <option value="tails">T</option>
          </select>

          <button className="cf-btn primary" onClick={spin} disabled={!canSpin}>
            {spinning ? 'Крутим…' : 'Крутить'}
          </button>
        </div>

        {/* Результат — в строку */}
        {shownResult && (
          <div className="cf-result-line">
            <span>Сложность: {COINFLIP_SETTINGS.modes[shownResult.mode].name},</span>
            <span>Выпало: {FACE_LABEL[shownResult.landed]},</span>
            <span
              className={'amt ' + (shownResult.outcome === 'win' ? 'plus' : 'minus')}
            >
              {shownResult.outcome === 'win'
                ? `+${(betNum * shownResult.payout).toFixed(2)} FC`
                : `-${betNum.toFixed(2)} FC`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
