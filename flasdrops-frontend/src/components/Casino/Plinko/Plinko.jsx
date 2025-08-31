// src/components/Casino/Plinko/Plinko.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { PLINKO_CFG as CFG } from './Plinko.settings';

axios.defaults.withCredentials = true;

export default function Plinko() {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(0);
  const lastTsRef   = useRef(0);
  const runningRef  = useRef(false);
  const settledRef  = useRef(false);

  const [bet, setBet] = useState(CFG.defaultBet);

  const W = CFG.width;
  const H = CFG.height;
  const padX = CFG.paddingX;
  const topY = CFG.padTop;
  const groundY = H - CFG.groundOffset;
  const innerW = W - padX * 2;

  const gapY = useMemo(() => {
    const usableH = groundY - topY - 40;
    return Math.max(usableH / (CFG.rows - 1), CFG.gapYMin);
  }, [groundY, topY]);

  // === ПИРАМИДА ===
  const pegs = useMemo(() => {
    const arr = [];
    const rows = CFG.rows;
    const baseGapX = innerW / (rows - 1);
    for (let r = 0; r < rows; r++) {
      const count = r + 1;
      const rowY = topY + r * gapY;
      const rowWidth = (count - 1) * baseGapX;
      const leftX = W/2 - rowWidth / 2;
      for (let i = 0; i < count; i++) {
        const x = leftX + i * baseGapX;
        const safeX = Math.max(padX + CFG.pegRadius, Math.min(W - padX - CFG.pegRadius, x));
        arr.push({ x: safeX, y: rowY });
      }
    }
    return arr;
  }, [W, innerW, padX, topY, gapY]);

  // шар
  const [ball, setBall] = useState(null);
  const ballRef = useRef(null);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  // DPR + первичная прорисовка поля (чтобы до броска было видно сцену)
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(null); // <- сразу рисуем поле без шара
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  // Если изменилась геометрия пегов/слотов — перерисуем статичную сцену
  useEffect(() => {
    if (!runningRef.current) drawScene(ballRef.current || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pegs, groundY, innerW]);

  /* ===== баланс: списание/начисление ===== */
  async function placeBet(amount) {
    const val = Math.floor(Number(amount) || 0);
    if (!val || val <= 0) { alert('Неверная ставка'); return false; }
    try {
      const { data } = await axios.post('/api/casino/plinko/bet', { amount: val });
      if (data?.balance != null) {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(data.balance) }));
      }
      return true;
    } catch (e) {
      alert(e?.response?.data?.error || 'Не удалось сделать ставку');
      return false;
    }
  }
  async function settleWin(amount, coeff, slotIndex) {
    try {
      const { data } = await axios.post('/api/casino/plinko/settle', {
        amount: Math.floor(Number(amount) || 0),
        coeff: Number(coeff) || 0,
        slot: slotIndex
      });
      if (data?.balance != null) {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(data.balance) }));
      }
    } catch (e) {
      console.warn('settle error:', e?.response?.data?.error || e.message);
    }
  }

  /* ===== старт/луп/физика ===== */
  const start = async () => {
    if (runningRef.current) return;

    const betNum = Math.floor(Number(bet) || 0);
    if (betNum <= 0) { alert('Введите ставку'); return; }

    const ok = await placeBet(betNum);
    if (!ok) return;

    setResult(null);
    setSpinning(true);
    runningRef.current = true;
    settledRef.current = false;

    const startX = W / 2 + (Math.random() * 50 - 25);
    const startY = topY - 40;

    const b = {
      x: startX,
      y: startY,
      vx: (Math.random() * 120 - 60),
      vy: 0,
      r: CFG.ballRadius,
      rot: 0,
    };
    ballRef.current = b;
    setBall(b);

    lastTsRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  };

  const stop = () => {
    runningRef.current = false;
    setSpinning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    // перерисуем статичную сцену (без шара), чтобы холст не оставался пустым
    drawScene(null);
  };

  const loop = (ts) => {
    const b = ballRef.current;
    if (!b) return stop();

    if (!lastTsRef.current) lastTsRef.current = ts;
    let acc = Math.min(0.08, (ts - lastTsRef.current) / 1000);
    lastTsRef.current = ts;

    let sub = 0;
    while (acc > 1e-6 && sub < CFG.maxSubSteps) {
      const dt = Math.min(CFG.fixedDt, acc);
      physicsStep(b, dt);
      acc -= dt;
      sub++;
    }

    drawScene(b);

    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  function physicsStep(b, dt) {
    b.vy += CFG.gravity * dt;
    b.vx *= (1 - CFG.airFriction);
    b.vy *= (1 - CFG.airFriction * 0.5);

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    const R = b.r + CFG.pegRadius;
    for (let i = 0; i < pegs.length; i++) {
      const p = pegs[i];
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const dist2 = dx*dx + dy*dy;
      if (dist2 <= R*R) {
        const dist = Math.max(0.0001, Math.sqrt(dist2));
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = R - dist + 0.01;

        b.x += nx * overlap;
        b.y += ny * overlap;

        const vn = b.vx * nx + b.vy * ny;
        const tx = -ny, ty = nx;
        const vt = b.vx * tx + b.vy * ty;

        const vnAfter = -vn * CFG.restitution;
        const vtAfter = vt * CFG.tangentFriction;

        b.vx = vnAfter * nx + vtAfter * tx;
        b.vy = vnAfter * ny + vtAfter * ty;

        b.rot += (vtAfter * dt) / (Math.PI * b.r);
      }
    }

    const minX = padX + b.r;
    const maxX = W - padX - b.r;
    if (b.x < minX) {
      b.x = minX;
      b.vx = Math.abs(b.vx) * CFG.wallRestitution;
    } else if (b.x > maxX) {
      b.x = maxX;
      b.vx = -Math.abs(b.vx) * CFG.wallRestitution;
    }

    if (b.y + b.r >= groundY) {
      b.y = groundY - b.r;
      const slotIndex = xToSlot(b.x);
      const coeff = Array.isArray(CFG.slotCoeffs) && CFG.slotCoeffs[slotIndex] != null
        ? Number(CFG.slotCoeffs[slotIndex]) || 1
        : 1;

      setResult({ slot: slotIndex, coeff });
      stop();

      if (!settledRef.current) {
        settledRef.current = true;
        const betNum = Math.floor(Number(bet) || 0);
        settleWin(betNum, coeff, slotIndex);
      }
    }

    setBall({ ...b });
  }

  function xToSlot(x) {
    const slotW = innerW / CFG.slotCount;
    let t = (x - padX) / innerW;
    t = Math.max(0, Math.min(1, t));
    const idx = Math.round(t * (CFG.slotCount - 1));
    return Math.max(0, Math.min(CFG.slotCount - 1, idx));
  }

  /* ===== рисуем ===== */
  function drawScene(b) {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#2b2b2b';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(padX, topY - 20);
    ctx.lineTo(padX, groundY);
    ctx.moveTo(W - padX, topY - 20);
    ctx.lineTo(W - padX, groundY);
    ctx.stroke();

    drawSlots(ctx);

    ctx.fillStyle = '#ffd000';
    for (const p of pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, CFG.pegRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (b) drawBall(ctx, b);
  }

  function drawSlots(ctx) {
    const slotW = innerW / CFG.slotCount;
    const y = groundY;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(padX, y, innerW, CFG.slotHeight);

    ctx.strokeStyle = '#2b2b2b';
    for (let i = 0; i <= CFG.slotCount; i++) {
      const x = padX + i * slotW;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + CFG.slotHeight);
      ctx.stroke();
    }

    if (Array.isArray(CFG.slotCoeffs) && CFG.slotCoeffs.length === CFG.slotCount) {
      ctx.fillStyle = '#ffea76';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < CFG.slotCount; i++) {
        const cx = padX + (i + 0.5) * slotW;
        ctx.fillText(`×${CFG.slotCoeffs[i]}`, cx, y + CFG.slotHeight - 8);
      }
    }
  }

  function drawBall(ctx, b) {
    const r = b.r;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);

    const grad = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#ffe680');
    grad.addColorStop(1, '#ffd000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.45, r * 0.25, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  return (
    <div style={{ padding: '0 16px', color: '#f6d645' }}>
      <div style={{ height: `${CFG.marginTopPx}px` }} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ background: '#141414', border: '1px solid #2b2b2b', borderRadius: 12, padding: 10 }}>
          <canvas ref={canvasRef} width={W} height={H} />
        </div>

        <div style={{ width: 300, background: '#141414', border: '1px solid #2b2b2b', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Plinko</div>
          <div style={{ opacity: .8, marginBottom: 10 }}>
            Шар падает под гравитацией, меняет траекторию только при столкновениях. Пирамида — вершиной вверх.
          </div>

          <div style={{ display:'grid', gap:10, marginBottom:10 }}>
            <label style={{ fontSize:13, opacity:.9 }}>Ставка</label>
            <div style={{ display:'flex', gap:8 }}>
              <input
                type="number"
                min="1"
                value={bet}
                onChange={e => setBet(Math.max(1, Math.floor(Number(e.target.value)||0)))}
                style={{ flex:1, background:'#1a1a1a', border:'1px solid #2b2b2b', color:'#fff', borderRadius:10, padding:'10px 12px', outline:'none' }}
                placeholder="Ставка FC"
              />
              <span style={{ alignSelf:'center', opacity:.7 }}>FC</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={start}
              disabled={spinning}
              style={{ padding: '10px 14px', borderRadius: 12, border: 0, fontWeight: 800, background: '#ffd000', color: '#111', cursor: 'pointer' }}
            >
              {spinning ? 'Идёт…' : `Бросить (−${Math.floor(Number(bet)||0)} FC)`}
            </button>
            <button
              onClick={() => { stop(); setBall(null); setResult(null); }}
              style={{ padding: '10px 14px', borderRadius: 12, border: 0, fontWeight: 800, background: '#2b2b2b', color: '#fff', cursor: 'pointer' }}
            >
              Сброс
            </button>
          </div>

          {result && (
            <div style={{ marginTop: 12, background: '#1a1a1a', border: '1px solid #2b2b2b', borderRadius: 10, padding: 10, fontWeight: 700 }}>
              Итоговый слот: {result.slot + 1} / {CFG.slotCount}
              {result.coeff != null && (
                <div style={{ marginTop: 6, opacity: .85 }}>Выплата: ×{result.coeff}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
