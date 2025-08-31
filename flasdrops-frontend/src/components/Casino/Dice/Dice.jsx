// flashdrops-frontend/src/components/Casino/Dice/Dice.jsx
import React, { useMemo, useRef, useState } from "react";
import "./Dice.css";
import axios from "axios";
import { DICE_CFG as CFG } from "./Dice.settings";
import { refreshBalanceAndBroadcast } from "../../../utils/balance";
axios.defaults.withCredentials = true;

export default function Dice() {
  const [bet, setBet] = useState(100);
  const [target, setTarget] = useState(50); // 1..99
  const [dir, setDir] = useState("over");   // over | under
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null); // { roll, win, payout, delta }

  // позиция и «прокрутка» шарика в ПИКСЕЛЯХ
  const [ballX, setBallX] = useState(0);    // px
  const [ballRot, setBallRot] = useState(0); // deg

  const barRef = useRef(null);

  // === НАСТРОЙКИ (из Dice.settings) ===
  const MARGIN_TOP = Number(CFG?.marginTopPx || 160);
  const MIN_BET = Number(CFG?.minBet || 1);
  const BALL_PX = Number(CFG?.ballPx || 32);
  const ALWAYS_FROM_ZERO = CFG?.alwaysFromZero ?? true;
  const SPEED_PX_PER_SEC = Number(CFG?.speedPxPerSec || 1120);

  const targetClamped = Math.min(99, Math.max(1, Math.floor(target)));
  const betNum = useMemo(() => {
    const v = Number(bet);
    if (!Number.isFinite(v) || v < MIN_BET) return 0;
    return Math.floor(v * 100) / 100;
  }, [bet]);

  const canSpin = betNum >= MIN_BET && !spinning;

  // подсветка выигрышной зоны (визуал)
  const winZone = useMemo(() => {
    if (dir === "under") {
      // roll < target
      return { left: 0, width: targetClamped };
    } else {
      // roll > target
      const count = 100 - (targetClamped + 1);
      return { left: targetClamped + 1, width: Math.max(0, count) };
    }
  }, [dir, targetClamped]);

  // перевод roll (0..99) → пиксели по треку
  function rollToXpx(roll, trackW) {
    const maxX = Math.max(0, trackW - BALL_PX); // правый предел с учётом диаметра
    return (roll / 99) * maxX;
  }

  const doSpin = async () => {
    if (!canSpin) return;
    setSpinning(true);
    setResult(null);

    let roll = 0, win = false, payout = 0;
    try {
      const { data } = await axios.post("/api/casino/dice/roll", {
        bet: betNum, target: targetClamped, dir
      });
      roll = Math.max(0, Math.min(99, Math.floor(data.roll)));
      win = !!data.win;
      payout = Number(data.payout || 0);
    } catch (e) {
      setSpinning(false);
      alert(e?.response?.data?.error || "Ошибка запроса");
      return;
    }

    const trackNode = barRef.current;
    const trackW = trackNode?.clientWidth || 600;
    const toX = rollToXpx(roll, trackW);
    const startX = ALWAYS_FROM_ZERO ? 0 : ballX;

    const distance = Math.abs(toX - startX);
    const durationMs = Math.max(
      1100,
      Math.min(5000, (distance / Math.max(1, SPEED_PX_PER_SEC)) * 1000)
    );

    const circumference = Math.PI * BALL_PX;
    const rotDeltaDeg = (distance / Math.max(1, circumference)) * 360;
    const toRot = (ALWAYS_FROM_ZERO ? 0 : ballRot) + rotDeltaDeg * (toX >= startX ? 1 : -1);

    if (trackNode) trackNode.style.setProperty("--ball-ms", `0ms`);
    setBallX(startX);
    setBallRot(ALWAYS_FROM_ZERO ? 0 : ballRot);

    requestAnimationFrame(() => {
      if (trackNode) trackNode.style.setProperty("--ball-ms", `${durationMs}ms`);
      requestAnimationFrame(() => {
        setBallX(toX);
        setBallRot(toRot);
      });
    });

    setTimeout(() => {
      const delta = win ? +(betNum * payout).toFixed(2) : -betNum;
      setResult({ roll, win, payout, delta });
      setSpinning(false);
      refreshBalanceAndBroadcast();
    }, durationMs + 30);
  };

  return (
    <div className="dice-page" style={{ paddingTop: `${MARGIN_TOP}px` }}>
      <div className="dice-card">
        {/* СЦЕНА */}
        <div className="track-stage">
          <div className="track" ref={barRef}>
            {/* зона выигрыша */}
            <div
              className="track-win"
              style={{ left: `${winZone.left}%`, width: `${winZone.width}%` }}
            />
            {/* деления */}
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="tick" style={{ left: `${i * 10}%` }} />
            ))}
            {/* шарик */}
            <div
              className={`ball ${spinning ? "moving" : ""}`}
              style={{
                "--ball-x": `${ballX}px`,
                "--ball-rot": `${ballRot}deg`,
              }}
              title={result ? `Ролл: ${String(result.roll).padStart(2, "0")}` : ""}
            />
          </div>
          <div className="track-labels">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* КОНТРОЛЫ */}
        <div className="dice-controls">
          <div className="ctrl">
            <div className="lb">Ставка</div>
            <input
              className="in"
              type="number"
              min={MIN_BET}
              step="1"
              value={bet}
              onChange={e => setBet(e.target.value)}
              disabled={spinning}
              placeholder="FC"
            />
          </div>

          <div className="ctrl">
            <div className="lb">Цель ({dir === "under" ? "МЕНЬШЕ" : "БОЛЬШЕ"})</div>
            <input
              className="in"
              type="range"
              min="1"
              max="99"
              value={targetClamped}
              onChange={e => setTarget(e.target.value)}
              disabled={spinning}
            />
            <div className="target-val">{targetClamped}</div>
          </div>

          <div className="ctrl">
            <div className="lb">Направление</div>
            <div className="seg">
              <button
                className={`seg-btn ${dir === "under" ? "active" : ""}`}
                onClick={() => !spinning && setDir("under")}
                disabled={spinning}
              >
                МЕНЬШЕ
              </button>
              <button
                className={`seg-btn ${dir === "over" ? "active" : ""}`}
                onClick={() => !spinning && setDir("over")}
                disabled={spinning}
              >
                БОЛЬШЕ
              </button>
            </div>
          </div>

          <button className="btn primary" onClick={doSpin} disabled={!canSpin}>
            {spinning ? "Крутится…" : "Крутить"}
          </button>
        </div>

        {/* РЕЗУЛЬТАТ */}
        {result && (
          <div className={`dice-result ${result.win ? "win" : "lose"}`}>
            Ролл: <b>{String(result.roll).padStart(2, "0")}</b> • {result.win ? "Победа" : "Проигрыш"} •{" "}
            <span className={`amt ${result.delta >= 0 ? "plus" : "minus"}`}>
              {result.delta >= 0 ? "+" : ""}
              {result.delta.toFixed(2)} FC
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
