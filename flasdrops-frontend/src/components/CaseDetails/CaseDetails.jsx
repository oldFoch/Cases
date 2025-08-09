import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CaseDetails.css';

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState(null);

  // ---- Reel state ----
  const [stage, setStage] = useState('idle'); // idle | spinning | done
  const windowRef = useRef(null);
  const reelRef = useRef(null);
  const [reel, setReel] = useState([]);
  const [targetIndex, setTargetIndex] = useState(null);

  // Синхронизировано с CSS (.reel-card width и gap)
  const CARD_W = 180;
  const CARD_GAP = 16;
  const STEP = CARD_W + CARD_GAP;

  useEffect(() => {
    axios
      .get(`/api/cases/${id}?live`, { withCredentials: true })
      .then(res => setCaseData(res.data))
      .catch(() => setCaseData(null));
  }, [id]);

  const items = useMemo(() => caseData?.items ?? [], [caseData]);

  const buildReel = (baseItems, length = 140) => {
    const arr = [];
    const src = [...baseItems];
    for (let i = src.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [src[i], src[j]] = [src[j], src[i]];
    }
    while (arr.length < length) {
      for (let i = 0; i < src.length && arr.length < length; i++) {
        arr.push(src[i]);
      }
    }
    return arr;
  };

  // Предпросмотр ленты до старта
  useEffect(() => {
    if (!items.length || stage !== 'idle') return;
    setReel(buildReel(items, 140));
  }, [items, stage]);

  // Центровка ленты на середину (idle)
  useEffect(() => {
    if (stage !== 'idle' || !reel.length) return;
    const win = windowRef.current;
    const strip = reelRef.current;
    if (!win || !strip) return;

    const centerX = win.clientWidth / 2;
    const midIndex = Math.floor(reel.length / 2);
    const targetPixel = midIndex * STEP + CARD_W / 2;
    const translate = -(targetPixel - centerX);

    strip.style.transition = 'none';
    strip.style.transform = `translateX(${translate}px) translateY(-50%)`;
  }, [reel, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpin = async () => {
    if (opening || !items.length) return;
    setOpening(true);
    setResult(null);

    const freshReel = buildReel(items, 140);
    setReel(freshReel);
    setStage('spinning');

    try {
      const { data } = await axios.post(
        `/api/cases/${id}/open`,
        {},
        { withCredentials: true }
      );

      const drop = data.item;
      setResult(drop);

      const safeStart = 30;
      const safeEnd = freshReel.length - 20;
      const tIndex = Math.max(safeStart, Math.min(safeEnd, Math.floor(freshReel.length * 0.75)));
      freshReel[tIndex] = { ...drop, __forced: true };
      setReel([...freshReel]);
      setTargetIndex(tIndex);

      requestAnimationFrame(() => {
        const win = windowRef.current;
        const strip = reelRef.current;
        if (!win || !strip) return;

        const centerX = win.clientWidth / 2;
        const targetPixel = tIndex * STEP + CARD_W / 2;
        const translate = -(targetPixel - centerX);

        strip.style.transition = 'none';
        strip.style.transform = `translateX(0px) translateY(-50%)`;

        requestAnimationFrame(() => {
          const duration = 4200 + Math.floor(Math.random() * 800);
          strip.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.8, 0.25, 1)`;
          strip.style.transform = `translateX(${translate}px) translateY(-50%)`;
        });
      });
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка открытия кейса');
      setStage('idle');
    } finally {
      setOpening(false);
    }
  };

  const onReelTransitionEnd = () => {
    if (stage === 'spinning') setStage('done');
  };

  const handleSell = () => {
    navigate('/profile');
  };

  const handleSpinAgain = () => {
    setStage('idle');
    setResult(null);
    setReel([]);
    setTargetIndex(null);
  };

  if (!caseData) return <div className="loading">Загрузка…</div>;

  return (
    <div className="case-details">
      <h2 className="case-title">{caseData.name}</h2>

      {/* Зона рулетки */}
      <div className={`spin-area ${stage}`}>
        <div className="reel-window" ref={windowRef}>
          <div
            className="reel-strip"
            ref={reelRef}
            onTransitionEnd={onReelTransitionEnd}
          >
            {reel.map((it, idx) => (
              <div className="reel-card" key={`${it.name}-${idx}`}>
                <img src={it.image} alt={it.name} />
                <div className="reel-card-name">{it.name}</div>
              </div>
            ))}
          </div>
          <div className="center-marker" />
        </div>

        {/* Лого кейса поверх ленты — больше и может выходить за рамки */}
        <div className="case-cover" aria-hidden>
          <img className="case-banner-img" src={caseData.image} alt={caseData.name} />
        </div>
      </div>

      {/* Кнопка и цена ниже ленты */}
      <div className="open-controls">
        <div className="case-price-tag">{Number(caseData.price).toFixed(2)}₽</div>
        <button
          className="open-btn"
          onClick={handleSpin}
          disabled={opening || stage === 'spinning'}
        >
          {opening || stage === 'spinning' ? 'Крутим…' : 'Крутить'}
        </button>
      </div>

      {stage === 'done' && result && (
        <div className="result-actions">
          <div className="result-card">
            <img src={result.image} alt={result.name} />
            <div className="result-info">
              <div className="result-name">{result.name}</div>
              <div className="result-price">{result.price}₽</div>
            </div>
          </div>

          <div className="result-buttons">
            <button className="sell-btn2" onClick={handleSell}>
              Продать
            </button>
          </div>
        </div>
      )}

      <div className="items-list">
        {items.map((item) => (
          <div key={item.id || item.name} className="roulette-item">
            <img src={item.image} alt={item.name} className="item-image" />
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              <span className="item-price">{item.price}₽</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
