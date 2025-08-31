import React, { useMemo, useState, useEffect, useRef } from 'react';
import './Towers.css';
import { TOWERS_CFG as CFG } from './Towers.settings';
import { refreshBalanceAndBroadcast } from '../../../utils/balance';

const COLS = CFG.cols;
const ROW_MODES = CFG.rowModes;
const DIFFS = CFG.diffs;

export default function Towers() {
  const [mode, setMode] = useState(ROW_MODES[0]);
  const [diff, setDiff] = useState(DIFFS[0]);
  const [bet, setBet] = useState(100);

  const [grid, setGrid] = useState([]);
  const [col, setCol] = useState(0);
  const [revealed, setRevealed] = useState({});
  const [status, setStatus] = useState('idle'); // idle | playing | boom | cashout
  const [mult, setMult] = useState(1);

  const [boardKey, setBoardKey] = useState(0);
  const boardWrapRef = useRef(null);
  const panelRef = useRef(null);

  const rows = mode.rows;
  const payout = useMemo(() => Math.floor(bet * mult), [bet, mult]);

  // --- СТАРТ (теперь списывает ставку) ---
  const start = async () => {
    try {
      const r = await fetch('/api/casino/towers/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Ошибка старта');
      if (typeof d.balance === 'number') {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(d.balance) || 0 }));
      } else {
        await refreshBalanceAndBroadcast();
      }
    } catch (e) {
      alert(e.message || 'Недостаточно средств');
      return;
    }

    // базовое значение из сложности
    const base = diff.bombsPerCol;
    let bombsPerCol = CFG.bombsOverride(rows, diff.key, base);
    bombsPerCol = Math.min(bombsPerCol, Math.max(1, rows - 1));

    const colsArr = [];
    for (let c = 0; c < COLS; c++) {
      const bombs = new Set();
      while (bombs.size < bombsPerCol) bombs.add(Math.floor(Math.random() * rows));
      colsArr.push({ bombs });
    }
    setGrid(colsArr);
    setCol(0);
    setRevealed({});
    setStatus('playing');
    setMult(1);
    setBoardKey(k => k + 1);
  };

  // --- CASHOUT (теперь добавляет выигрыш) ---
  const cashout = async () => {
    if (status !== 'playing') return;
    setStatus('cashout');

    try {
      const r = await fetch('/api/casino/towers/cashout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet, mult })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Ошибка кэш-аута');

      if (typeof d.balance === 'number') {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(d.balance) || 0 }));
      } else {
        await refreshBalanceAndBroadcast();
      }
    } catch (e) {
      console.warn(e);
      await refreshBalanceAndBroadcast();
    }
  };

  const onPick = (r) => {
    if (status !== 'playing') return;
    const bombs = grid[col]?.bombs || new Set();
    const key = `${r}-${col}`;
    if (revealed[key]) return;

    const next = { ...revealed };
    if (bombs.has(r)) {
      next[key] = 'bomb';
      setRevealed(next);
      setStatus('boom');
      refreshBalanceAndBroadcast(); // проигрыш → обновить баланс
      return;
    }

    next[key] = 'safe';
    setRevealed(next);

    const nextMult = +(mult * diff.coefPerStep).toFixed(4);
    setMult(nextMult);

    if (col < COLS - 1) setCol(col + 1);
    else setStatus('cashout');
  };

  useEffect(() => {
    setStatus('idle');
    setGrid([]);
    setCol(0);
    setRevealed({});
    setMult(1);
    setBoardKey(k => k + 1);
  }, [mode, diff]);

  useEffect(() => {
    const board = boardWrapRef.current;
    if (!board) return;

    const measure = () => {
      const panelW = CFG.ui.sidePanelWidthPx;
      const gap = CFG.ui.gapPx;

      const containerW = board.parentElement?.getBoundingClientRect().width || window.innerWidth;
      const availableW = Math.max(
        320,
        Math.floor(containerW - panelW - 20)
      );

      const styles = getComputedStyle(board);
      const padH = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
      const padV = parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0');
      const head = board.querySelector('.board-head');
      const headH = head ? head.getBoundingClientRect().height : 0;

      const cellFromWidth = Math.floor((availableW - padH - (COLS - 1) * gap) / COLS);
      const suggestedMaxH = Math.floor(window.innerHeight * CFG.ui.stageHeightVH);
      const cellFromHeight = Math.floor((suggestedMaxH - headH - padV - (rows - 1) * gap) / rows);

      const cell = Math.max(CFG.ui.minCellPx, Math.min(cellFromWidth, cellFromHeight));
      const gridW = cell * COLS + (COLS - 1) * gap;
      const gridH = cell * rows + (rows - 1) * gap;
      const boardH = headH + padV + gridH;

      board.style.setProperty('--cell-size', `${cell}px`);
      board.style.setProperty('--grid-gap', `${gap}px`);
      board.style.setProperty('--board-height', `${boardH}px`);
      board.style.setProperty('--board-width', `${gridW + padH}px`);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [rows, boardKey]);

  useEffect(() => {
    if (status === 'boom' || status === 'cashout') {
      refreshBalanceAndBroadcast();
    }
  }, [status]);

  return (
    <div className="towers-viewport">
      <div className="towers-wrap centered">
        {/* ЛЕВО: поле */}
        <div className="board-wrap square" ref={boardWrapRef}>
          <div className="board-head">
            <div className="ttl">Towers</div>
            <div className={`st ${status}`}>
              {status === 'idle' && 'Готов к игре'}
              {status === 'playing' && `Колонка ${col + 1} / ${COLS}`}
              {status === 'boom' && 'БОМБА 💥'}
              {status === 'cashout' && 'КЭШ-АУТ ✅'}
            </div>
          </div>

          <div
            key={boardKey}
            className="board-grid horizontal"
            style={{
              gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
              gridTemplateColumns: `repeat(${COLS}, var(--cell-size))`,
              gap: 'var(--grid-gap)',
              width: 'var(--board-width)',
              height: 'calc(var(--board-height) - var(--head-height, 0px))',
            }}
          >
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: COLS }).map((_, c) => {
                const key = `${r}-${c}`;
                const rv = revealed[key];
                const isActiveCol = status === 'playing' && c === col;
                return (
                  <button
                    key={key}
                    className={`cell ${rv || ''} ${isActiveCol ? 'active' : ''}`}
                    onClick={() => (isActiveCol ? onPick(r) : null)}
                    disabled={!isActiveCol || !!rv}
                    title={isActiveCol ? 'Выбрать' : undefined}
                  >
                    {rv === 'bomb' ? (
                      <img
                        src="/images/bomb.png"
                        alt="bomb"
                        onError={(e) => (e.currentTarget.outerHTML = '💣')}
                      />
                    ) : rv === 'safe' ? '✓' : ''}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ПРАВО: панель */}
        <div className="side-wrap" ref={panelRef}>
          <div className="panel">
            <div className="row2">
              <label className="lb">Размер поля</label>
              <div className="diffs">
                {ROW_MODES.map(m => (
                  <button
                    key={m.key}
                    className={`chip ${mode.key === m.key ? 'active' : ''}`}
                    onClick={() => setMode(m)}
                    disabled={status === 'playing'}
                  >
                    {m.title}
                  </button>
                ))}
              </div>
              <div className="hint">Ходы слева → направо. Активна только текущая колонка.</div>
            </div>

            <div className="row2">
              <label className="lb">Сложность</label>
              <div className="diffs">
                {DIFFS.map(d => (
                  <button
                    key={d.key}
                    className={`chip ${diff.key === d.key ? 'active' : ''}`}
                    onClick={() => setDiff(d)}
                    disabled={status === 'playing'}
                  >
                    {d.title}
                  </button>
                ))}
              </div>
              <div className="hint">
                Бомб/колонку: <b>{
                  Math.min(CFG.bombsOverride(rows, diff.key, diff.bombsPerCol), Math.max(1, rows - 1))
                }</b> • шаг: ×{diff.coefPerStep}
              </div>
            </div>

            <div className="row2">
              <label className="lb">Ставка</label>
              <div className="bet">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bet}
                  onChange={(e) => setBet(Math.max(1, Math.floor(+e.target.value || 0)))}
                />
                <span>₽</span>
              </div>
            </div>

            <div className="row2">
              <div className="lb">Множитель</div>
              <div className="big">{mult.toFixed(2)}×</div>
            </div>

            <div className="row2">
              <div className="lb">Выплата (кэш-аут)</div>
              <div className="big">{payout} ₽</div>
            </div>

            <div className="actions">
              {status !== 'playing' ? (
                <button className="btn primary" onClick={start}>Старт</button>
              ) : (
                <>
                  <button className="btn ghost" onClick={cashout}>Кэш-аут</button>
                  <button className="btn danger" onClick={() => setStatus('boom')}>Сдаться</button>
                </>
              )}
            </div>

            <div className="desc">
              <ul>
                <li>Выбирай клетки только в <b>текущей колонке</b>.</li>
                <li>Двигайся слева → направо. Можно забрать в любой момент.</li>
                <li>Бомба — проигрыш раунда.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
