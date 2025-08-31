// src/components/Casino/Wheel/Wheel.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Wheel.css';
import axios from 'axios';
import { WHEEL_CFG as CFG, colorOf, seededIndexByRound } from './Wheel.settings';
import { refreshBalanceAndBroadcast } from '../../../utils/balance';

axios.defaults.withCredentials = true;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;

export default function Wheel() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    let mounted = true;
    axios.get('/api/users/me', { params: { _ts: Date.now() }})
      .then(r => { if (mounted) setMe(r.data || null); })
      .catch(() => { if (mounted) setMe(null); });
    return () => { mounted = false; };
  }, []);
  
  // ПРАВИЛЬНОЕ получение истории - ИСПРАВЛЕНО!
  useEffect(() => {
    let mounted = true;
    axios.get('/api/casino/wheel/history', { params: { _ts: Date.now() }})
      .then(r => {
        if (!mounted) return;
        const arr = Array.isArray(r.data) ? r.data : [];
        console.log('History from backend:', arr); // для отладки
        setHistory(arr.map(x => ({ 
          idx: x.winning_number,  // ПРАВИЛЬНОЕ поле
          col: x.winning_color    // ПРАВИЛЬНОЕ поле
        })));
      })
      .catch(e => console.error('History load error:', e));
    return () => { mounted = false; };
  }, []);

  const [betColor, setBetColor] = useState('');
  const [amountColor, setAmountColor] = useState('');
  const [betNumber, setBetNumber] = useState('');
  const [amountNumber, setAmountNumber] = useState('');

  const [liveColor, setLiveColor]   = useState([]);
  const [liveNumber, setLiveNumber] = useState([]);

  const [angle, setAngle] = useState(0);
  const segAngle = 360 / CFG.segments;

  const [nowMs, setNowMs] = useState(Date.now());
  const roundId    = Math.floor(nowMs / CFG.roundMs);
  const roundStart = roundId * CFG.roundMs;
  const tInRound   = nowMs - roundStart;
  const inBetting  = tInRound < CFG.betWindowMs;
  const inSpin     = !inBetting;

  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [uiWinLoss, setUiWinLoss] = useState(null);

  const canvasRef = useRef(null);
  const segments = useMemo(
    () => Array.from({ length: CFG.segments }, (_, i) => ({
      index: i,
      color: colorOf(i, CFG),
      label: String(i)
    })),
    []
  );

  const animRef  = useRef(0);
  const t0Ref    = useRef(0);
  const startRef = useRef(0);
  const endRef   = useRef(0);
  const startedForRoundRef = useRef(null);

  useEffect(() => {
    let raf;
    const tick = () => { setNowMs(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (inBetting) {
      setLiveColor([]);
      setLiveNumber([]);
      setUiWinLoss(null);
    }
  }, [roundId, inBetting]);

  useEffect(() => {
    if (inSpin && startedForRoundRef.current !== roundId) {
      const tSpin = tInRound - CFG.betWindowMs;
      const remain = clamp(CFG.spinMs - tSpin, 0, CFG.spinMs);

      const targetIndex = seededIndexByRound(roundId, CFG.segments);
      const targetColor = colorOf(targetIndex, CFG);
      
      spinTo(targetIndex, remain, async () => {
        const res = { index: targetIndex, color: targetColor };
        setLastResult(res);
        
        // Сохраняем в историю фронтенда
        setHistory(h => [{ idx: targetIndex, col: targetColor }, ...h].slice(0, 18));

        try {
          // ПРАВИЛЬНЫЙ вызов settle - ИСПРАВЛЕНО!
          await axios.post('/api/casino/wheel/settle', {
            winning_number: targetIndex,
            winning_color: targetColor,
            bets: {
              color_bet: liveColor.length > 0 ? { 
                color: liveColor[0]?.color, 
                amount: liveColor.reduce((sum, bet) => sum + bet.amount, 0)
              } : null,
              number_bet: liveNumber.length > 0 ? {
                number: liveNumber[0]?.number,
                amount: liveNumber.reduce((sum, bet) => sum + bet.amount, 0)
              } : null
            }
          });
          refreshBalanceAndBroadcast();
        } catch (e) {
          console.error('Settle error:', e);
        }

        settleLocal(res);
      });

      startedForRoundRef.current = roundId;
    }
    if (inBetting && startedForRoundRef.current !== null && startedForRoundRef.current !== roundId) {
      startedForRoundRef.current = null;
    }
  }, [roundId, inSpin]); // eslint-disable-line

  useEffect(() => { drawWheel(angle); /* eslint-disable-next-line */ }, [angle]);

  const placeBet = async () => {
    if (!inBetting) return;
    if (!me?.id) { alert('Войдите через Steam, чтобы сделать ставку'); return; }

    const colorAmount = Math.max(0, Number(amountColor)||0);
    const numberAmount= Math.max(0, Number(amountNumber)||0);
    const numberVal   = Number(betNumber);

    const useColor = betColor && colorAmount>0;
    const useNumber = Number.isFinite(numberVal) && numberVal>=0 && numberVal<CFG.segments && numberAmount>0;
    if (!useColor && !useNumber) { alert('Укажите корректную ставку'); return; }

    try {
      const payload = {
        round_id: roundId,
        color_bet: useColor ? { color: betColor, amount: colorAmount } : null,
        number_bet: useNumber ? { number: numberVal, amount: numberAmount } : null
      };
      await axios.post('/api/casino/wheel/bet', payload);
      refreshBalanceAndBroadcast();

      const meName = me?.username || 'You';
      if (payload.color_bet) {
        setLiveColor(prev => [...prev, { user: meName, color: payload.color_bet.color, amount: payload.color_bet.amount }].slice(-200));
      }
      if (payload.number_bet) {
        const num = payload.number_bet.number;
        setLiveNumber(prev => [...prev, { user: meName, number: num, color: colorOf(num, CFG), amount: payload.number_bet.amount }].slice(-200));
      }

      setAmountColor('');
      setAmountNumber('');
    } catch (e) {
      alert(e?.response?.data?.error || 'Не удалось сделать ставку');
    }
  };

  function settleLocal(res) {
    const totalBet = liveTotalBet();
    if (totalBet <= 0) { setUiWinLoss(null); return; }

    let win = 0;
    for (const b of liveColor) {
      if (b.color === 'yellow') {
        if (res.index === CFG.yellowIndex) win += b.amount * CFG.payout.yellow;
      } else if (b.color === res.color) {
        win += b.amount * CFG.payout.color;
      }
    }
    for (const b of liveNumber) {
      if (b.number === res.index) win += b.amount * CFG.payout.number;
    }

    setUiWinLoss({
      totalBet: Math.round(totalBet * 100) / 100,
      totalWin: Math.round(win * 100) / 100
    });
  }
  function liveTotalBet() {
    const s1 = liveColor.reduce((s,b)=>s+(b.amount||0),0);
    const s2 = liveNumber.reduce((s,b)=>s+(b.amount||0),0);
    return s1 + s2;
  }

  // === ГЛАВНОЕ ИСПРАВЛЕНИЕ: целимся под СТРЕЛКУ СВЕРХУ (offset 90°) ===
  function spinTo(idx, remainMs, onDone) {
    const duration = Math.max(300, Math.min(CFG.spinMs, remainMs || CFG.spinMs));
    setSpinning(true);

    const current = ((angle % 360) + 360) % 360;

    // центр сектора i (0° — вправо)
    const centerDeg = idx * segAngle;

    // хотим центр под ВЕРХНЕЙ стрелкой ⇒ −90° от “вправо”
    // (canvas крутится по часовой при положительном угле, поэтому берём -90 - centerDeg)
    const targetDegRaw = -90 - centerDeg;

    const targetDeg = ((targetDegRaw % 360) + 360) % 360;
    const baseDelta = (targetDeg - current + 360) % 360;

    const turns = CFG.minTurns + Math.floor(Math.random() * (CFG.maxTurnsRand + 1));

    startRef.current = angle;
    endRef.current   = angle + baseDelta + turns * 360;
    t0Ref.current    = 0;

    const tick = (ts) => {
      if (!t0Ref.current) t0Ref.current = ts;
      const t  = Math.max(0, Math.min(1, (ts - t0Ref.current) / duration));
      const te = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setAngle(startRef.current + (endRef.current - startRef.current) * te);

      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setAngle(endRef.current);
        setSpinning(false);
        onDone && onDone();
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  }

  function drawWheel(aDeg) {
    const size = CFG.wheelSize;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cvs.width = size * dpr; cvs.height = size * dpr;
    cvs.style.width = `${size}px`; cvs.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const r = size / 2, cx = r, cy = r;
    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#141414';
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((aDeg * Math.PI) / 180);

    const segRad = (Math.PI * 2) / CFG.segments;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const start = i * segRad - segRad / 2;
      const end   = (i + 1) * segRad - segRad / 2;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0, r, start, end);
      ctx.closePath();

      let fill = CFG.colorBlack;
      if (s.color === 'red') fill = CFG.colorRed;
      if (s.color === 'yellow') fill = CFG.colorYellow;
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      const mid = (start + end) / 2;
      const tx = Math.cos(mid) * (r * 0.72);
      const ty = Math.sin(mid) * (r * 0.72);
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = CFG.labelColor;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // чат
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const logRef = useRef(null);
  const sendMsg = () => {
    const t = (msg || '').trim();
    if (!t) return;
    const author = {
      name: me?.username || 'Гость',
      avatar: me?.avatar || '/images/avatar-placeholder.png'
    };
    setChat((c) => [...c, { a: author, t, ts: Date.now() }].slice(-200));
    setMsg('');
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 0);
  };

  const secsBet = Math.max(0, Math.ceil((CFG.betWindowMs - tInRound) / 1000));

  return (
    <div className="wheel-page" style={{ '--top-gap': `${CFG.marginTopPx}px` }}>
      <div className="wheel-top-gap" />

      <div className="wheel-wrap">
        {/* ЛЕВО — колесо */}
        <div className="wheel-card">
          <div className="wheel-stage" style={{ width: CFG.wheelSize, height: CFG.wheelSize }}>
            <div className="wheel-pointer" />
            <canvas ref={canvasRef} className="wheel-canvas" />
            <div
              className="wheel-center"
              style={{
                width: CFG.centerButton,
                height: CFG.centerButton,
                left: (CFG.wheelSize - CFG.centerButton) / 2,
                top: (CFG.wheelSize - CFG.centerButton) / 2
              }}
            >
              WHEEL
            </div>
          </div>
        </div>

        {/* СЕРЕДИНА — панель ставок и лайв-ставки */}
        <div className="wheel-card panel">
          <div className="block">
            <div className="ttl">Раунд</div>
            <div className="timer">
              <div>{inBetting ? 'Можно ставить' : 'Крутится…'}</div>
              <div className="big">{inBetting ? `${secsBet}s` : ''}</div>
            </div>
          </div>

          <div className="block">
            <div className="ttl">Ставка на цвет</div>
            <div className="row">
              <select
                className="select"
                value={betColor}
                onChange={(e) => setBetColor(e.target.value)}
                disabled={!inBetting || !me}
                title={!me ? 'Войдите через Steam' : undefined}
              >
                <option value="">— не ставить —</option>
                <option value="red">Красный (нечёт) ×{CFG.payout.color}</option>
                <option value="black">Чёрный (чёт) ×{CFG.payout.color}</option>
                <option value="yellow">Жёлтый ×{CFG.payout.yellow}</option>
              </select>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder="Сумма FC"
                value={amountColor}
                onChange={(e) => setAmountColor(e.target.value)}
                disabled={!inBetting || !me}
                title={!me ? 'Войдите через Steam' : undefined}
              />
            </div>
          </div>

          <div className="block">
            <div className="ttl">Ставка на число</div>
            <div className="row">
              <input
                className="input"
                type="number"
                min="0"
                max={CFG.segments - 1}
                placeholder={`0..${CFG.segments - 1}`}
                value={betNumber}
                onChange={(e) => setBetNumber(e.target.value)}
                disabled={!inBetting || !me}
                title={!me ? 'Войдите через Steam' : undefined}
              />
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder="Сумма FC"
                value={amountNumber}
                onChange={(e) => setAmountNumber(e.target.value)}
                disabled={!inBetting || !me}
                title={!me ? 'Войдите через Steam' : undefined}
              />
            </div>
            <div className="small">Можно комбинировать.</div>
          </div>

          <div className="block">
            <div className="row" style={{ justifyContent:'space-between' }}>
              <button className="btn primary" onClick={placeBet} disabled={!inBetting || !me}>
                Поставить
              </button>
              <div className="small">Поставлено: {liveTotalBet()} FC</div>
            </div>
          </div>

          <div className="block">
            <div className="ttl">Ставки (онлайн)</div>
            <div className="live-bets" style={{ maxHeight: 360, overflow: 'auto' }}>
              <div className="live-col">
                <div className="cap">Цвет</div>
                {liveColor.length === 0 && <div className="small">Нет ставок</div>}
                {liveColor.map((b, i) => (
                  <div key={i} className="bet-item">
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span className={`dot ${b.color}`} />
                      <span>{b.user}</span>
                    </div>
                    <div className="sum">{b.amount} FC</div>
                  </div>
                ))}
              </div>
              <div className="live-col">
                <div className="cap">Число</div>
                {liveNumber.length === 0 && <div className="small">Нет ставок</div>}
                {liveNumber.map((b, i) => (
                  <div key={i} className="bet-item">
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span className={`pill ${b.color}`}>{b.number}</span>
                      <span>{b.user}</span>
                    </div>
                    <div className="sum">{b.amount} FC</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="block">
            <div className="ttl">Текущий раунд</div>
            <div className="round-info">
              <div>
                {lastResult
                  ? <>Выпало: <b>#{lastResult.index}</b> • <span className="round-pill">{lastResult.color}</span></>
                  : 'Ожидаем первый спин'}
              </div>
              <div className="round-pill">{inBetting ? 'Ставки' : 'Спин'}</div>
            </div>
          </div>

          {uiWinLoss && (
            <div className="block">
              <div className="ttl">Итог вашей ставки (UI)</div>
              <div className="round-info">
                <div>Поставлено: {uiWinLoss.totalBet} FC</div>
                <div style={{ color: uiWinLoss.totalWin >= uiWinLoss.totalBet ? '#32cd32' : '#ff3b30' }}>
                  {uiWinLoss.totalWin} FC
                </div>
              </div>
            </div>
          )}

          <div className="block">
            <div className="ttl">История</div>
            <div className="history">
              {history.map((h, i) => (
                <div key={i} className={`hist-pill ${h.col}`}>
                  {h.idx}
                </div>
              ))}
              {!history.length && <div className="small">Пока пусто</div>}
            </div>
          </div>
        </div>

        {/* ПРАВО — чат (высотой со ставками) */}
        <div className="wheel-card chat-side">
          <div className="block chat" style={{ height: '100%', display:'flex', flexDirection:'column' }}>
            <div className="ttl">Чат</div>
            <div className="chat-log" ref={logRef} style={{ flex:1 }}>
              {chat.map((m, i) => (
                <div className="msg" key={i}>
                  <img className="avatar" src={m.a.avatar} alt={m.a.name} />
                  <div className="body">
                    <div className="meta">
                      <div className="name">{m.a.name}</div>
                      <div className="time">{new Date(m.ts).toLocaleTimeString()}</div>
                    </div>
                    <div className="text">{m.t}</div>
                  </div>
                </div>
              ))}
              {!chat.length && <div className="small">Скажи что-нибудь…</div>}
            </div>
            <div className="chat-input">
              <input
                value={msg}
                onChange={(e)=>setMsg(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==='Enter') sendMsg(); }}
                placeholder={me ? 'Сообщение…' : 'Войдите, чтобы писать в чат'}
                disabled={!me}
              />
              <button className="btn primary" onClick={sendMsg} disabled={!me}>Отправить</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}