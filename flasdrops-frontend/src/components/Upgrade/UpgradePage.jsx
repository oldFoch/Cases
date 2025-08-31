// src/components/Upgrade/UpgradePage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './UpgradeWheelImage.css';

/**
 * Колесо-изображение (21 сектор):
 *  - указатель фиксирован сверху
 *  - колесо крутится CSS-rotate
 *  - центр — выбор твоего предмета (из инвентаря)
 *  - справа — выбор цели (из базы)
 *  - исход полностью решает бэкенд (POST /api/upgrade/try)
 */

axios.defaults.withCredentials = true;

// === Настройки анимации ===
const SPIN_MS = 2000;
const TURNS_MIN = 4;
const TURNS_RAND = 3;

// 21 сектор (сверху по часовой). Цифры только для «типа сектора» (win/stay/lose).
const SECTORS_NUMBERS = [1,3,1,5,1,10,1,3,1,5,1,20,1,3,1,5,1,10,1,3,1];

const NUMBER_TO_OUTCOME = (n) => {
  if (n === 10) return 'win';   // новый скин
  if (n === 1)  return 'stay';  // оставить свой
  return 'lose';                // бомба (3/5/20)
};

// угол центра сектора i (с учётом половинки сегмента)
const angleForIndex = (i, total) => (360 / total) * (i + 0.5);

function FC({ value }) {
  const val = Number(value || 0).toFixed(0);
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

export default function UpgradePage() {
  const [source, setSource] = useState(null);   // твой скин (user_inventory)
  const [target, setTarget] = useState(null);   // цель (items_master)
  const [modal, setModal]   = useState(null);   // 'source' | 'target' | null

  const [sources, setSources] = useState([]);
  const [targets, setTargets] = useState([]);
  const [q, setQ]     = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const ringRef = useRef(null);
  const currentAngleRef = useRef(0); // накопленный угол

  const total = SECTORS_NUMBERS.length;

  // Предрасчёт секторов (тип: win/stay/lose)
  const sectors = useMemo(
    () => SECTORS_NUMBERS.map((n, i) => ({ num: n, outcome: NUMBER_TO_OUTCOME(n), index: i })),
    []
  );

  // Источники (инвентарь юзера) грузим один раз и после спинов
  useEffect(() => {
    loadSources().catch(() => {});
  }, []);

  // Цели (из базы) грузим по фильтрам
  useEffect(() => {
    loadTargets().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, min, max]);

  async function loadSources() {
    const { data } = await axios.get('/api/upgrade/sources', { params: { _ts: Date.now() } });
    setSources(Array.isArray(data) ? data : []);
  }

  async function loadTargets() {
    const params = { _ts: Date.now() };
    if (q) params.q = q;
    if (min) params.min = min;
    if (max) params.max = max;
    const { data } = await axios.get('/api/upgrade/targets', { params });
    setTargets(Array.isArray(data) ? data : []);
  }

  const spin = async () => {
    if (!source || !target || spinning) return;

    setResult(null);
    setSpinning(true);

    // просим бэк посчитать исход
    let outcome, reward;
    try {
      const { data } = await axios.post('/api/upgrade/try', {
        source_inventory_id: source.id,
        target_item_master_id: target.item_master_id
      });
      outcome = String(data.outcome || '').toLowerCase(); // 'win'|'stay'|'lose'
      reward  = data.reward || null;
    } catch (e) {
      setSpinning(false);
      if (e?.response?.status === 401) { window.location.href = '/api/auth/steam'; return; }
      alert(e?.response?.data?.error || 'Ошибка апгрейда');
      return;
    }

    // выбираем сектор подходящего типа (любой)
    const candidates = sectors.filter(s => s.outcome === outcome);
    const picked = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : sectors[0];

    // Снимаем прошлый transition, чтобы задать новый
    const wheel = ringRef.current;
    if (wheel) {
      wheel.style.transition = 'none';
      // фиксируем текущее положение (без дёрганий)
      wheel.style.transform = `rotate(${currentAngleRef.current}deg)`;
      // принудительный reflow
      // eslint-disable-next-line no-unused-expressions
      wheel.offsetHeight;
    }

    // Рассчитываем «куда крутить»:
    //  - currentAngleRef хранит накопленный угол поворота колеса
    //  - у нас стрелка фиксирована сверху, значит надо довернуть так,
    //    чтобы центр выбранного сектора оказался как бы «вверх».
    const fromMod = ((currentAngleRef.current % 360) + 360) % 360;
    const toCenter = angleForIndex(picked.index, total);
    // Поскольку мы вращаем именно КОЛЕСО, чтобы сектор пришёл вверх, угол должен сместиться на (360 - toCenter)
    const baseDelta = (360 - toCenter - fromMod + 360) % 360;

    const turns = TURNS_MIN + Math.floor(Math.random() * (TURNS_RAND + 1));
    const final = currentAngleRef.current + turns * 360 + baseDelta;

    if (wheel) {
      wheel.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.8, 0.25, 1)`;
      wheel.style.transform = `rotate(${final}deg)`;
    }
    currentAngleRef.current = final;

    // по завершению анимации — показать результат и обновить источники
    window.setTimeout(async () => {
      setResult({ outcome, reward });
      setSpinning(false);
      try {
        await loadSources();
        if (outcome !== 'stay') setSource(null); // сгорел/обменялся — убираем из центра
      } catch {}
    }, SPIN_MS + 50);
  };

  return (
    <div className="upimg-page">
      {/* ЛЕВО — колесо */}
      <div className="upimg-left">
        <div className="upimg-wheel-wrap">
          <div className="upimg-pointer" />
          <div className="upimg-wheel" ref={ringRef}>
            {/* важна ровная круглая текстура (разметка 21 сектор) */}
            <img src="/images/wheel.png" alt="wheel" draggable="false" />
          </div>

          {/* Центр: твой предмет */}
          <button
            className="upimg-center"
            onClick={() => setModal('source')}
            disabled={spinning}
            title="Выбрать ваш предмет"
          >
            {source ? (
              <>
                <img src={source.image} alt={source.name} />
                <div className="cn">{source.name}</div>
                <div className="cp"><FC value={Number(source.price||0)} /></div>
              </>
            ) : (
              <div className="ph">Ваш скин</div>
            )}
          </button>
        </div>

        <div className="upimg-actions">
          <button
            className="btn primary big"
            onClick={spin}
            disabled={!source || !target || spinning}
          >
            {spinning ? 'Крутим…' : 'Крутить'}
          </button>
        </div>

        {result && (
          <div className={`panel res ${result.outcome}`}>
            {result.outcome === 'win'   && <div className="rt">УСПЕХ! Получен апгрейд.</div>}
            {result.outcome === 'stay'  && <div className="rt">Ваш предмет остался.</div>}
            {result.outcome === 'lose'  && <div className="rt">Предмет сгорел.</div>}
            {result.reward && (
              <div className="rrow">
                <img src={result.reward.image} alt={result.reward.name} />
                <div className="rmeta">
                  <div className="rname">{result.reward.name}</div>
                  <div className="rprice"><FC value={Number(result.reward.price||0)} /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ПРАВО — выбор цели */}
      <div className="upimg-right">
        <div className="panel sel">
          <div className="ttl">Цель</div>
          <div className="sub">Выберите скин из базы</div>

          {!target ? (
            <button className="btn ghost full big" onClick={() => setModal('target')}>Выбрать цель</button>
          ) : (
            <div className="tcard">
              <img src={target.image} alt={target.name} />
              <div className="ti">
                <div className="tn">{target.name}</div>
                <div className="tp"><FC value={Number(target.price||0)} /></div>
                <div className="ta">
                  <button className="btn ghost" onClick={() => setModal('target')}>Изменить</button>
                  <button className="btn ghost" onClick={() => setTarget(null)}>Сбросить</button>
                </div>
              </div>
            </div>
          )}

          <div className="filters">
            <input className="input" placeholder="Поиск…" value={q} onChange={e=>setQ(e.target.value)} />
            <input className="input short" type="number" placeholder="Мин FC" value={min} onChange={e=>setMin(e.target.value)} />
            <input className="input short" type="number" placeholder="Макс FC" value={max} onChange={e=>setMax(e.target.value)} />
            <button className="btn ghost" onClick={()=>{setQ('');setMin('');setMax('');}}>Сброс</button>
          </div>

          <div className="grid picks">
            {targets.map(t => (
              <button key={t.item_master_id} className="card" onClick={() => setTarget(t)}>
                <div className="imgbox"><img src={t.image} alt={t.name} /></div>
                <div className="name">{t.name}</div>
                <div className="price"><FC value={Number(t.price||0)} /></div>
              </button>
            ))}
            {!targets.length && <div className="muted center" style={{padding:'6px'}}>Ничего не найдено</div>}
          </div>
        </div>
      </div>

      {/* Модалки выбора */}
      {modal && (
        <PickerModal
          title={modal === 'source' ? 'Выберите ваш предмет' : 'Выберите цель'}
          onClose={() => setModal(null)}
        >
          {modal === 'source' ? (
            <>
              {!sources.length && <div className="muted center">Инвентарь пуст</div>}
              <div className="grid picks">
                {sources.map(s => (
                  <button key={s.id} className="card" onClick={() => { setSource(s); setModal(null); }}>
                    <div className="imgbox"><img src={s.image} alt={s.name} /></div>
                    <div className="name">{s.name}</div>
                    <div className="price"><FC value={Number(s.price||0)} /></div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="filters">
                <input className="input" placeholder="Поиск…" value={q} onChange={e=>setQ(e.target.value)} />
                <input className="input short" type="number" placeholder="Мин FC" value={min} onChange={e=>setMin(e.target.value)} />
                <input className="input short" type="number" placeholder="Макс FC" value={max} onChange={e=>setMax(e.target.value)} />
                <button className="btn ghost" onClick={()=>{setQ('');setMin('');setMax('');}}>Сброс</button>
              </div>
              <div className="grid picks">
                {targets.map(t => (
                  <button key={t.item_master_id} className="card" onClick={() => { setTarget(t); setModal(null); }}>
                    <div className="imgbox"><img src={t.image} alt={t.name} /></div>
                    <div className="name">{t.name}</div>
                    <div className="price"><FC value={Number(t.price||0)} /></div>
                  </button>
                ))}
                {!targets.length && <div className="muted center" style={{padding:'6px'}}>Ничего не найдено</div>}
              </div>
            </>
          )}
        </PickerModal>
      )}
    </div>
  );
}

function PickerModal({ title, onClose, children }) {
  return (
    <div className="upimg-modal-backdrop" onClick={onClose}>
      <div className="upimg-modal" onClick={e=>e.stopPropagation()}>
        <div className="upimg-modal-head">
          <div className="upimg-modal-title">{title}</div>
          <button className="btn ghost" onClick={onClose}>Закрыть</button>
        </div>
        <div className="upimg-modal-body">{children}</div>
      </div>
    </div>
  );
}
