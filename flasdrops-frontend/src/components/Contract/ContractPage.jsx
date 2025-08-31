// flashdrops-frontend/src/components/Contract/ContractPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import './ContractCircle.css';
import './ContractAnim.css';
import {
  SLOT_COUNT,
  RADIUS,
  ROTATE_DEG,
  SPIN_MS,
  MERGE_MS,
  RESULT_STAY_MS
} from './contractAnim';

axios.defaults.withCredentials = true;

function FC({ value }) {
  const val = Math.round(Number(value || 0));
  return (
    <>
      {val}{' '}
      <img
        src="/images/fc.png"
        alt="FC"
        style={{ width: 14, height: 14, verticalAlign: 'middle' }}
      />
    </>
  );
}

export default function ContractPage() {
  const [inv, setInv] = useState([]);
  const [slots, setSlots] = useState(Array(SLOT_COUNT).fill(null));

  // анимация: idle → spinning → merging → result
  const [stage, setStage] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [resultItem, setResultItem] = useState(null);

  const dragData = useRef(null);

  const loadMe = async () => {
    try {
      const { data } = await axios.get('/api/users/me', {
        withCredentials: true,
        params: { _ts: Date.now() }
      });
      const items = Array.isArray(data.inventory)
        ? data.inventory.filter(x => !x.is_sold)
        : [];
      setInv(items);
      return items;
    } catch {
      setInv([]);
      return [];
    }
  };

  useEffect(() => { loadMe(); }, []);

  const pickedIds = useMemo(
    () => new Set(slots.filter(Boolean).map(s => s.id)),
    [slots]
  );

  // инвентарь: сортировка по цене (дороже → дешевле)
  const available = useMemo(() => {
    return inv
      .filter(x => !pickedIds.has(x.id))
      .slice()
      .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }, [inv, pickedIds]);

  const total = useMemo(
    () =>
      Math.round(
        slots.reduce((s, it) => s + (it ? (Number(it.price) || 0) : 0), 0)
      ),
    [slots]
  );
  const minP = Math.round(total * 0.7);  // −30%
  const maxP = Math.round(total * 1.15); // +15%
  const filledCount = useMemo(() => slots.filter(Boolean).length, [slots]);

  const canSubmit = filledCount >= 2 && !loading && stage === 'idle';

  const firstFreeSlot = () => slots.findIndex(s => !s);

  const addByClick = (item) => {
    if (pickedIds.has(item.id) || stage !== 'idle') return;
    const idx = firstFreeSlot();
    if (idx === -1) return;
    setSlots(prev => {
      const next = [...prev];
      next[idx] = item;
      return next;
    });
  };

  const clearSlot = (i) => {
    if (stage !== 'idle') return;
    setSlots(prev => {
      const next = [...prev];
      next[i] = null;
      return next;
    });
  };

  const clearAll = () => {
    if (stage !== 'idle') return;
    setSlots(Array(SLOT_COUNT).fill(null));
  };

  const shuffleFill = () => {
    if (stage !== 'idle') return;
    if (!available.length) return;
    const freeIdx = slots
      .map((v, i) => (v ? null : i))
      .filter(v => v !== null);
    const pool = [...available];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSlots(prev => {
      const next = [...prev];
      for (let i = 0; i < freeIdx.length && i < pool.length; i++) {
        next[freeIdx[i]] = pool[i];
      }
      return next;
    });
  };

  // DnD
  const onDragStartInv = (e, item) => {
    if (stage !== 'idle') return;
    dragData.current = { type: 'inv', itemId: item.id };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragStartSlot = (e, slotIndex) => {
    if (stage !== 'idle') return;
    if (!slots[slotIndex]) return;
    dragData.current = { type: 'slot', slotIndex };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverSlot = (e) => {
    if (stage === 'idle') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };
  const onDropSlot = (e, targetIndex) => {
    if (stage !== 'idle') return;
    e.preventDefault();
    const info = dragData.current;
    dragData.current = null;
    if (!info) return;

    setSlots(prev => {
      const next = [...prev];
      if (info.type === 'inv') {
        if (next[targetIndex]) return next;
        const item = inv.find(x => x.id === info.itemId);
        if (!item || pickedIds.has(item.id)) return next;
        next[targetIndex] = item;
        return next;
      } else {
        const fromIdx = info.slotIndex;
        if (fromIdx === targetIndex) return next;
        const a = next[fromIdx];
        const b = next[targetIndex];
        next[targetIndex] = a;
        next[fromIdx] = b || null;
        return next;
      }
    });
  };

  // запуск контракта с анимацией
  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setStage('spinning');

    let apiItem = null;
    try {
      const inventory_ids = slots.filter(Boolean).map(x => x.id);
      const { data } = await axios.post(
        '/api/contract',
        { inventory_ids },
        { withCredentials: true }
      );
      apiItem = data?.item || null;
    } catch (e) {
      setStage('idle');
      setLoading(false);
      alert(e.response?.data?.error || 'Ошибка контракта');
      return;
    }

    // крутим SPIN_MS
    setTimeout(() => {
      // слияние MERGE_MS
      setStage('merging');

      setTimeout(async () => {
        // показываем результат
        setResultItem(apiItem);
        setStage('result');

        // обновляем инвентарь (использованные исчезнут)
        await loadMe();
        setSlots(Array(SLOT_COUNT).fill(null));

        // держим результат RESULT_STAY_MS
        setTimeout(() => {
          setStage('idle');
          setResultItem(null);
          setLoading(false);
        }, RESULT_STAY_MS);
      }, MERGE_MS);
    }, SPIN_MS);
  };

  return (
    <div className="contract-circle-page">
      {/* Правая часть — КРУГ СЛОТОВ + АНИМАЦИЯ (ставим первой, чтобы визуально была слева),
          а инвентарь вынесем вторым — он окажется справа */}
      <main className="contract-circle-main">
        <div
          className={[
            'big-circle',
            stage === 'spinning' ? 'spinning' : '',
            stage === 'merging' ? 'merging' : ''
          ].join(' ')}
          style={{ ['--spin-ms']: `${SPIN_MS}ms`, ['--merge-ms']: `${MERGE_MS}ms` }}
        >
          {Array.from({ length: SLOT_COUNT }).map((_, i) => {
            const angle = ((i / SLOT_COUNT) * 2 * Math.PI) + (ROTATE_DEG * Math.PI / 180);
            const x = Math.cos(angle) * RADIUS;
            const y = Math.sin(angle) * RADIUS;
            const it = slots[i];

            return (
              <div
                key={i}
                className={[
                  'slot',
                  it ? 'filled' : '',
                  stage !== 'idle' ? 'locked' : ''
                ].join(' ')}
                style={{ transform: `translate(${x}px, ${y}px)` }}
                onClick={() => it && clearSlot(i)}
                onDragOver={onDragOverSlot}
                onDrop={(e) => onDropSlot(e, i)}
                draggable={!!it && stage === 'idle'}
                onDragStart={(e) => onDragStartSlot(e, i)}
                title={it ? 'Клик — убрать' : 'Пустой слот'}
              >
                {it ? <img src={it.image} alt={it.name} /> : <span className="plus">+</span>}
              </div>
            );
          })}

          <button className="contract-btn" onClick={submit} disabled={!canSubmit}>
            {loading || stage !== 'idle' ? '...' : 'Контракт'}
          </button>

          {/* Результат в центре */}
          {stage === 'result' && resultItem && (
            <div className="result-overlay">
              <div className="result-card">
                <img src={resultItem.image} alt={resultItem.name} />
                <div className="result-name">{resultItem.name}</div>
                <div className="result-price"><FC value={Number(resultItem.price) || 0} /></div>
              </div>
            </div>
          )}
        </div>

        {/* Итоги / меню ниже круга */}
        <div className="summary">
          <div>Выбрано: {filledCount}</div>
          <div>Сумма: <FC value={total} /></div>
          <div>Выпадет: <FC value={minP} /> — <FC value={maxP} /></div>
          <div className="summary-actions">
            <button
              className="btn ghost"
              onClick={clearAll}
              disabled={filledCount === 0 || stage !== 'idle'}
            >
              Очистить
            </button>
            <button
              className="btn ghost"
              onClick={shuffleFill}
              disabled={!available.length || stage !== 'idle'}
            >
              Заполнить
            </button>
            <button className="btn primary" onClick={submit} disabled={!canSubmit}>
              {loading || stage !== 'idle' ? '...' : 'Контракт'}
            </button>
          </div>
        </div>
      </main>

      {/* Правый столбец — ИНВЕНТАРЬ (идёт вторым в DOM, значит окажется справа) */}
      <aside className="inventory-list">
        <div className="inv-head">
          <h2>Ваши предметы</h2>
          <span className="inv-count">{available.length} шт</span>
        </div>

        <div className="items">
          {available.length === 0 ? (
            <div className="inv-empty">Нет доступных предметов</div>
          ) : (
            available.map(it => (
              <button
                key={it.id}
                type="button"
                className="item"
                draggable={stage === 'idle'}
                onDragStart={(e) => onDragStartInv(e, it)}
                onClick={() => addByClick(it)}
                title="Клик — добавить в слот"
              >
                <img src={it.image} alt={it.name} />
                <div className="name" title={it.name}>{it.name}</div>
                <div className="price"><FC value={Number(it.price) || 0} /></div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
