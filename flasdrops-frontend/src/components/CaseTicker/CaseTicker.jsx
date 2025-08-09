import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './CaseTicker.css';

export default function CaseTicker() {
  const [items, setItems] = useState([]);
  const [moving, setMoving] = useState(false);
  const [translate, setTranslate] = useState(0);

  const trackRef = useRef(null);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const normalize = (data) =>
    (Array.isArray(data) ? data : []).map(d => ({
      id: d.id,
      caseId: d.case_id,
      caseName: d.case_name,
      caseImage: d.case_image, // может быть null — дадим fallback ниже
      itemName: d.item_name,
      itemImage: d.item_image,
      itemPrice: d.item_price,
      username: d.username,
      avatar: d.avatar,
      createdAt: d.created_at,
    }));

  const load = async () => {
    try {
      const { data } = await axios.get('/api/drops/recent', { withCredentials: true });
      const fresh = normalize(data).reverse();

      if (items.length === 0) {
        const ids = new Set(fresh.map(d => d.id));
        knownIdsRef.current = ids;
        setItems(fresh);
        return;
      }

      const known = knownIdsRef.current;
      const onlyNew = fresh.filter(d => !known.has(d.id));
      if (onlyNew.length === 0) return;

      const next = [...items, ...onlyNew];
      onlyNew.forEach(d => known.add(d.id));

      const stepWidth = getStepWidth() * onlyNew.length;
      setItems(next);
      requestAnimationFrame(() => {
        setMoving(true);
        setTranslate(-stepWidth);
      });
    } catch {
      /* ignore */
    }
  };

  const onTransitionEnd = () => {
    if (!moving) return;
    const stepCount = Math.round(Math.abs(translate) / getStepWidth());
    const sliced = items.slice(stepCount);
    setItems(sliced);
    setMoving(false);
    requestAnimationFrame(() => setTranslate(0));
  };

  const getStepWidth = () => {
    const el = trackRef.current?.querySelector('.ticker-item');
    if (!el) return 260; // запас
    const styles = getComputedStyle(el);
    const mr = parseFloat(styles.marginRight || '0');
    return el.offsetWidth + mr;
  };

  const trackStyle = useMemo(
    () => ({
      transform: `translateX(${translate}px)`,
      transition: moving ? 'transform 650ms ease' : 'none',
    }),
    [translate, moving]
  );

  // общий обработчик фолбэка для картинок
  const onImgError = (ev) => {
    const t = ev.currentTarget;
    if (t.dataset.fallbackTried === '1') return;
    t.dataset.fallbackTried = '1';
    // пробуем .jpg если .png не существует (или наоборот)
    if (t.src.endsWith('.png')) t.src = t.src.replace(/\.png$/i, '.jpg');
    else if (t.src.endsWith('.jpg') || t.src.endsWith('.jpeg')) t.src = t.src.replace(/\.jpe?g$/i, '.png');
  };

  if (items.length === 0) return null;

  return (
    <div className="ticker">
      <div
        className="ticker-track"
        ref={trackRef}
        style={trackStyle}
        onTransitionEnd={onTransitionEnd}
      >
        {items.map(o => {
          const previewSrc = o.caseImage || '/images/case1.png'; // ← твой логотип кейса
          return (
            <Link
              to={o.caseId ? `/cases/${o.caseId}` : '#'}
              className="ticker-item"
              key={o.id}
              title={o.caseName ? `Кейс: ${o.caseName}` : undefined}
            >
              <div className="ticker-box">
                {o.itemImage && (
                  <img className="drop-img" src={o.itemImage} alt={o.itemName} onError={onImgError} />
                )}
                <div className="t-left">
                  <div className="t-name">{o.itemName}</div>
                  <div className="t-meta">
                    <span className="t-user">{o.username}</span>
                    <span className="t-dot">•</span>
                    <span className="t-price">
                      {o.itemPrice != null ? `${Number(o.itemPrice).toFixed(2)}₽` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="case-preview">
                <img className="case-preview-img" src={previewSrc} alt={o.caseName || 'case'} onError={onImgError} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
