// flashdrops-frontend/src/components/Casino/Mines/Mines.jsx
import React, { useMemo, useState } from 'react';
import { refreshBalanceAndBroadcast } from '../../../utils/balance';
import axios from 'axios'; // <-- добавить

axios.defaults.withCredentials = true;

const BOARD_SIZE = 820; // px
const SHIFT_X = -50;    // px
const MIN_BET = 10;

const MODES = [
  { key: 's', name: '5×5',  size: 5  },
  { key: 'm', name: '9×9',  size: 9  },
  { key: 'l', name: '21×21', size: 21 },
];

const DIFFS = [
  { key: 'easy',   name: 'Лёгкая',  pct: 0.10 },
  { key: 'medium', name: 'Средняя', pct: 0.18 },
  { key: 'hard',   name: 'Сложная', pct: 0.25 },
];

export default function Mines() {
  const [mode, setMode] = useState(MODES[0]);
  const [diff, setDiff] = useState(DIFFS[1]);
  const [bet, setBet]   = useState(100);

  const [running, setRunning] = useState(false);
  const [lost, setLost]       = useState(false);
  const [board, setBoard]     = useState([]);
  const [revealed, setRevealed] = useState(0);
  const [seed, setSeed]       = useState('');

  const [multiplier, setMultiplier] = useState(1);
  const [potentialWin, setPotentialWin] = useState(0);
  const [nextOdds, setNextOdds] = useState(null);

  const totalCells = mode.size * mode.size;
  const minesCount = useMemo(() => Math.max(1, Math.round(totalCells * diff.pct)), [totalCells, diff]);

  const gap = mode.size >= 21 ? 2 : mode.size >= 9 ? 4 : 6;
  const cell = Math.floor((BOARD_SIZE - gap * (mode.size - 1)) / mode.size);

  const canStart = !running && Number(bet) >= MIN_BET;
  const canCash  = running && !lost && revealed > 0;

  // ——— Вспом: сид и «детерминированный» рандом
  function newSeed() {
    return Math.random().toString(36).slice(2, 10);
  }
  function seededRandom(idx, sd) {
    let h = 2166136261;
    const s = `${sd}:${idx}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h % 100000) / 100000; // 0..1
  }

  async function fetchUi(k) {
    try {
      const res = await fetch(`/api/mines/ui?bet=${bet}&T=${totalCells}&m=${minesCount}&k=${k}&h=0.04`);
      const d = await res.json();
      if (res.ok) {
        setMultiplier(d.currentMult);
        setPotentialWin(Math.floor(d.currentCashout));
        setNextOdds(d.nextOdds);
      } else {
        console.warn('UI error', d);
      }
    } catch (e) {
      console.error('fetchUi fail', e);
    }
  }

  async function startGame() {
    if (!canStart) return;
    try {
      const r = await fetch('/api/casino/mines/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: Math.floor(Number(bet) || 0) })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'mines start fail');

      if (typeof d.balance === 'number') {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(d.balance) || 0 }));
      } else {
        await refreshBalanceAndBroadcast();
      }
    } catch (e) {
      alert(e.message || 'Недостаточно средств');
      return;
    }

    const sd = newSeed();
    setSeed(sd);
    setLost(false);
    setRevealed(0);

    const idxs = Array.from({ length: totalCells }, (_, i) => i);
    idxs.sort((a, b) => seededRandom(a, sd) - seededRandom(b, sd));
    const mines = new Set(idxs.slice(0, minesCount));

    const b = Array.from({ length: totalCells }, (_, i) => ({
      mine: mines.has(i),
      open: false,
    }));
    setBoard(b);
    setRunning(true);

    fetchUi(0);
  }

  function stopGame() {
    setRunning(false);
    setLost(false);
    setRevealed(0);
    setBoard([]);
    setSeed('');
    setMultiplier(1);
    setPotentialWin(0);
    setNextOdds(null);
  }

  async function cashout() {
    if (!canCash) return;
    try {
      const r = await fetch('/api/mines/cashout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: Math.floor(Number(bet) || 0), T: totalCells, m: minesCount, k: revealed, h: 0.04 })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'mines cashout fail');

      if (typeof d.balance === 'number') {
        window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(d.balance) || 0 }));
      } else {
        await refreshBalanceAndBroadcast();
      }
    } catch (e) {
      console.warn(e);
      await refreshBalanceAndBroadcast();
    }
    stopGame();
  }

  function clickCell(i) {
    if (!running || lost) return;
    setBoard(prev => {
      const next = [...prev];
      if (next[i].open) return prev;

      if (next[i].mine) {
        next[i] = { ...next[i], open: true };
        setLost(true);
        setRunning(false);
        setTimeout(() => {
          setBoard(p => p.map(c => c.mine ? { ...c, open: true } : c));
        }, 120);
        return next;
      } else {
        next[i] = { ...next[i], open: true };
        setRevealed(r => {
          const newR = r + 1;
          fetchUi(newR);
          return newR;
        });
        return next;
      }
    });
  }

  function renderCell(i) {
    const c = board[i];
    const base = {
      width: cell,
      height: cell,
      lineHeight: `${cell}px`,
      fontSize: Math.max(10, Math.floor(cell * 0.35)),
    };

    if (!running) {
      return <div key={i} style={{ ...styles.cell, ...base, opacity: .35 }} />;
    }

    const isMine = c.mine && c.open;
    const isSafe = !c.mine && c.open;

    return (
      <button
        key={i}
        onClick={() => clickCell(i)}
        style={{
          ...styles.cell,
          ...base,
          borderColor: isMine ? '#ff3b30' : isSafe ? '#ffd000' : '#2b2b2b',
          background: isSafe ? 'linear-gradient(180deg, rgba(255,208,0,0.08), rgba(255,208,0,0.03))' : '#1a1a1a'
        }}
      >
        {isMine ? '💣' : isSafe ? '•' : ''}
      </button>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.wrap, transform: `translateX(${SHIFT_X}px)` }}>
        <div style={{ ...styles.box, width: BOARD_SIZE, height: BOARD_SIZE }}>
          <div
            style={{
              ...styles.board,
              width: BOARD_SIZE,
              height: BOARD_SIZE,
              gap: gap,
              gridTemplateColumns: `repeat(${mode.size}, ${cell}px)`,
            }}
          >
            {Array.from({ length: totalCells }, (_, i) => renderCell(i))}
          </div>
        </div>

        <div style={{ ...styles.box, width: BOARD_SIZE, height: BOARD_SIZE }}>
          <div style={styles.panel}>
            <div style={styles.block}>
              <div style={styles.title}>Режим</div>
              <div style={styles.row}>
                {MODES.map(m => (
                  <button
                    key={m.key}
                    onClick={() => { if (!running) { setMode(m); setBoard([]); setRevealed(0); setLost(false); } }}
                    disabled={running}
                    style={{ ...styles.chip, ...(mode.key === m.key ? styles.chipActive : null) }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.block}>
              <div style={styles.title}>Сложность</div>
              <div style={styles.row}>
                {DIFFS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => { if (!running) setDiff(d); }}
                    disabled={running}
                    style={{ ...styles.chip, ...(diff.key === d.key ? styles.chipActive : null) }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
              <div style={{ opacity:.8, marginTop:6, fontSize:13 }}>
                Мин: <b>{minesCount}</b> из <b>{totalCells}</b>
              </div>
            </div>

            <div style={styles.block}>
              <div style={styles.title}>Ставка</div>
              <div style={styles.row}>
                <input
                  type="number"
                  min={MIN_BET}
                  value={bet}
                  disabled={running}
                  onChange={e => setBet(e.target.value)}
                  style={styles.input}
                  placeholder={`${MIN_BET} FC минимум`}
                />
                <span style={{ opacity:.7, fontSize:13 }}>мин: {MIN_BET} FC</span>
              </div>
            </div>

            <div style={styles.block}>
              <div style={{ opacity:.9 }}>
                Открыто: <b>{revealed}</b><br/>
                Множитель: <b>{multiplier.toFixed(2)}x</b><br/>
                Потенциал: <b>{potentialWin} FC</b><br/>
                {nextOdds !== null && <span style={{ fontSize:12, opacity:.7 }}>Шанс следующей: {(nextOdds*100).toFixed(1)}%</span>}
              </div>
            </div>

            <div style={styles.actions}>
              {!running ? (
                <button
                  onClick={startGame}
                  disabled={!canStart}
                  style={{ ...styles.btn, ...styles.primary }}
                >
                  Старт
                </button>
              ) : (
                <>
                  <button onClick={stopGame} style={{ ...styles.btn, ...styles.ghost }}>Сброс</button>
                  <button onClick={cashout} disabled={!canCash} style={{ ...styles.btn, ...styles.primary }}>
                    Забрать {canCash ? `${potentialWin} FC` : ''}
                  </button>
                </>
              )}
            </div>

            {lost && (
              <div style={{ marginTop: 10, color:'#ff3b30', fontWeight:800 }}>
                Упс! Мина. Ставка сгорела.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { width:'100%', display:'flex', justifyContent:'center', marginTop: '200px', padding:'20px', color:'#f6d645' },
  wrap: { display:'flex', gap: 24, alignItems:'flex-start' },
  box: {
    background:'#141414',
    border:'1px solid #2b2b2b',
    borderRadius:14,
    padding:10,
    boxSizing:'content-box',
  },
  board: {
    display:'grid',
    placeItems:'center',
    background:'#121212',
    border:'1px solid #2b2b2b',
    borderRadius:10,
    padding:8,
  },
  cell: {
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    background:'#1a1a1a',
    border:'1px solid #2b2b2b',
    color:'#fff',
    borderRadius:6,
    cursor:'pointer',
    userSelect:'none',
    transition:'transform .05s ease, border-color .12s ease',
  },
  panel: { display:'flex', flexDirection:'column', gap:14, width:'100%', height:'100%' },
  block: {
    background:'#1a1a1a',
    border:'1px solid #2b2b2b',
    borderRadius:10,
    padding:10
  },
  title: { fontWeight:800, marginBottom:8 },
  row: { display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' },
  chip: {
    padding:'8px 12px',
    borderRadius:10,
    border:'1px solid #2b2b2b',
    background:'#111',
    color:'#fff',
    cursor:'pointer'
  },
  chipActive: {
    borderColor:'#ffd000',
    boxShadow:'0 0 0 2px #ffd00033 inset',
    background:'linear-gradient(180deg, rgba(255,208,0,0.08), rgba(255,208,0,0.03))'
  },
  input: { background:'#111', border:'1px solid #2b2b2b', color:'#fff', borderRadius:10, padding:'8px 10px', outline:'none', width:140 },
  actions: { marginTop:'auto', display:'flex', gap:10 },
  btn: { padding:'10px 14px', borderRadius:12, border:'0', fontWeight:800, cursor:'pointer' },
  primary: { background:'#ffd000', color:'#111' },
  ghost: { background:'#2b2b2b', color:'#fff' },
};
