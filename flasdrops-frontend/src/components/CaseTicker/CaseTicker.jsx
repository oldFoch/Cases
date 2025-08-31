// flashdrops-frontend/src/components/CaseTicker/CaseTicker.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './CaseTicker.css';
import PriceFC from '../PriceFC.jsx';

export default function CaseTicker() {
  const [items, setItems] = useState([]);
  const knownIds = useRef(new Set());

  const POLL_MS = 5000;   // опрос бэка
  const MAX_VISIBLE = 12; // максимум карточек

  useEffect(() => {
    let timer;
    const tick = async () => {
      try {
        const { data } = await axios.get('/api/drops/recent', {
          withCredentials: true,
          params: { _ts: Date.now() }
        });
        const fresh = normalize(data);
        if (!fresh.length) return;

        if (items.length === 0 && knownIds.current.size === 0) {
          for (const d of fresh) knownIds.current.add(d.id);
          const initial = sortDescByTime(fresh).slice(0, MAX_VISIBLE);
          setItems(initial);
          return;
        }

        const onlyNew = sortAscByTime(fresh).filter(d => !knownIds.current.has(d.id));
        if (!onlyNew.length) return;

        for (const d of onlyNew) knownIds.current.add(d.id);

        setItems(prev => {
          const next = [...onlyNew, ...prev];
          return next.slice(0, MAX_VISIBLE);
        });
      } catch {
        // ignore
      } finally {
        timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();
    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items.length) return null;

  return (
    <div className="ticker">
      <div className="ticker-track">
        {items.map(o => {
          const previewSrc = o.caseImage || '/images/case1.png';
          return (
            <Link
              to={o.caseId ? `/cases/${o.caseId}` : '#'}
              className="ticker-item"
              key={o.id}
              title={o.caseName ? `Кейс: ${o.caseName}` : undefined}
            >
              <div className="ticker-box">
                {o.itemImage && (
                  <img
                    className="drop-img"
                    src={o.itemImage}
                    alt={o.itemName}
                    onError={onImgError}
                  />
                )}
                <div className="t-left">
                  <div className="t-name">{o.itemName}</div>
                  <div className="t-meta">
                    <span className="t-user">{o.username}</span>
                    <span className="t-dot">•</span>
                    <span className="sum"><PriceFC value={o.itemPrice} /></span>
                  </div>
                </div>
              </div>
              <div className="case-preview">
                <img
                  className="case-preview-img"
                  src={previewSrc}
                  alt={o.caseName || 'case'}
                  onError={onImgError}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* Helpers */
function normalize(data) {
  const arr = Array.isArray(data) ? data : [];
  return arr.map(d => ({
    id: d.id,
    caseId: d.case_id,
    caseName: d.case_name,
    caseImage: d.case_image || null,
    itemName: d.item_name,
    itemImage: d.item_image,
    itemPrice: d.item_price,
    username: d.username,
    avatar: d.avatar,
    createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
  }));
}

function sortAscByTime(list) {
  return [...list].sort((a, b) => a.createdAt - b.createdAt);
}
function sortDescByTime(list) {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
function onImgError(ev) {
  const t = ev.currentTarget;
  if (t.dataset.fallbackTried === '1') return;
  t.dataset.fallbackTried = '1';
  if (t.src.endsWith('.png')) t.src = t.src.replace(/\.png$/i, '.jpg');
  else if (t.src.match(/\.jpe?g$/i)) t.src = t.src.replace(/\.jpe?g$/i, '.png');
}
