// flashdrops-frontend/src/components/Upgrade/UpgradeWheelImage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

// Анимация
const SPIN_MS = 2200;
const TURNS_MIN = 4;
const TURNS_RAND = 2;

// 42 сектора (удвоенная 21)
const BASE_21 = [1,3,1,5,1,10,1,3,1,5,1,20,1,3,1,5,1,10,1,3,1];
const SECTORS_NUMBERS = [...BASE_21, ...BASE_21];

// Исходы и цвета
const NUMBER_TO_OUTCOME = (n) => (n === 10 ? 'win' : n === 1 ? 'stay' : 'lose');
const OUTCOME_COLOR = { win:'#2aa8ff', stay:'#ffd000', lose:'#ff3b30' };

const angleForIndex = (i, total) => (360 / total) * (i + 0.5);

export default function UpgradeWheelImage() {
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [modal, setModal]   = useState(null);

  const [sources, setSources] = useState([]);
  const [targets, setTargets] = useState([]);
  const [q, setQ] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  const [spinning, setSpinning] = useState(false);

  // результат для «всплывашки»
  const [result, setResult] = useState(null);        // { outcome, reward }
  const [showToast, setShowToast] = useState(false); // показать всплывающее окно

  const wheelRef = useRef(null);
  const currentAngleRef = useRef(0);
  const [imgOk, setImgOk] = useState(true);

  const sectors = useMemo(
    () => SECTORS_NUMBERS.map((n, i) => ({ index: i, outcome: NUMBER_TO_OUTCOME(n) })),
    []
  );

  useEffect(() => { loadSources().catch(()=>{}); }, []);
  useEffect(() => { loadTargets().catch(()=>{}); }, [q, min, max]);

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
    setShowToast(false);
    setSpinning(true);

    let outcome, reward;
    try {
      const { data } = await axios.post('/api/upgrade/try', {
        source_inventory_id: source.id,
        target_item_master_id: target.item_master_id
      });
      outcome = String(data.outcome || '').toLowerCase();
      reward  = data.reward || null;
    } catch (e) {
      setSpinning(false);
      if (e?.response?.status === 401) { window.location.href = '/api/auth/steam'; return; }
      alert(e?.response?.data?.error || 'Ошибка апгрейда');
      return;
    }

    const candidates = sectors.filter(s => s.outcome === outcome);
    const picked = candidates.length ? candidates[(Math.random()*candidates.length)|0] : sectors[0];

    const node = wheelRef.current;
    if (node) {
      node.style.transition = 'none';
      node.style.transform = `rotate(${currentAngleRef.current}deg)`;
      // reflow
      // eslint-disable-next-line no-unused-expressions
      node.offsetHeight;
    }

    const total = sectors.length;
    const fromMod = ((currentAngleRef.current % 360) + 360) % 360;
    const toCenter = angleForIndex(picked.index, total);
    const baseDelta = (360 - toCenter - fromMod + 360) % 360;
    const turns = TURNS_MIN + Math.floor(Math.random() * (TURNS_RAND + 1));
    const final = currentAngleRef.current + turns * 360 + baseDelta;

    if (node) {
      node.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.8, 0.25, 1)`;
      node.style.transform = `rotate(${final}deg)`;
    }
    currentAngleRef.current = final;

    setTimeout(async () => {
      setSpinning(false);

      // обновим инвентарь (если скин сгорел/поменялся)
      try {
        await loadSources();
        if (outcome !== 'stay') setSource(null);
      } catch {}

      // показываем всплывающее окно с текстом
      const payload = { outcome, reward };
      setResult(payload);
      setShowToast(true);

      // авто-закрытие через 3 сек
      setTimeout(() => setShowToast(false), 3000);
    }, SPIN_MS + 50);
  };

  // текст и цвет для всплывашки
  const toastText =
    result?.outcome === 'win'
      ? `Вы получили скин${result?.reward?.name ? `: ${result.reward.name}` : ''}`
      : result?.outcome === 'stay'
      ? 'Вы ничего не потеряли'
      : result?.outcome === 'lose'
      ? 'Ваш предмет сгорел'
      : '';

  const toastColor =
    result?.outcome === 'win'
      ? OUTCOME_COLOR.win
      : result?.outcome === 'stay'
      ? OUTCOME_COLOR.stay
      : OUTCOME_COLOR.lose;

  return (
    <div style={S.page}>
      <div style={S.left}>
        <div style={S.wheelWrap}>
          {/* Указатель — чёрный, вниз */}
          <div style={S.pointerDown} />

          {/* Колесо */}
          <div ref={wheelRef} style={S.wheel}>
            {imgOk ? (
              <img
                src="/images/wheel.png"
                alt="wheel"
                draggable="false"
                style={S.wheelImg}
                onError={() => setImgOk(false)}
              />
            ) : (
              <FallbackWheel sectors={sectors} size={S._WHEEL_SIZE}/>
            )}
          </div>

          {/* Центр — выбор вашего скина */}
          <button
            onClick={() => setModal('source')}
            disabled={spinning}
            title="Выбрать ваш предмет"
            style={S.centerBtn}
          >
            {source ? (
              <>
                <img src={source.image} alt={source.name} style={S.centerImg}/>
                <div style={S.centerName}>{source.name}</div>
                <div style={S.centerPrice}>{Math.round(Number(source.price||0))}₽</div>
              </>
            ) : (
              <div style={{opacity:.7}}>Ваш скин</div>
            )}
          </button>
        </div>

        {/* Легенда цветов */}
        <div style={S.legend}>
          <div style={S.legendItem}>
            <span style={{...S.legendDot, background:OUTCOME_COLOR.stay}}></span>
            <span>Вернул свой скин</span>
          </div>
          <div style={S.legendItem}>
            <span style={{...S.legendDot, background:OUTCOME_COLOR.lose}}></span>
            <span>Проиграл</span>
          </div>
          <div style={S.legendItem}>
            <span style={{...S.legendDot, background:OUTCOME_COLOR.win}}></span>
            <span>Выпал новый скин</span>
          </div>
        </div>

        {/* Кнопка */}
        <div style={S.actions}>
          <button
            onClick={spin}
            disabled={!source || !target || spinning}
            style={{...S.btn, ...S.btnPrimary, fontSize:22, padding:'16px 22px'}}
          >
            {spinning ? 'Крутим…' : 'Крутить'}
          </button>
        </div>
      </div>

      {/* Правая колонка: выбор цели */}
      <div style={S.right}>
        <div style={S.panel}>
          <div style={{fontWeight:800, fontSize:20, marginBottom:2}}>Цель</div>
          <div style={{opacity:.75, marginBottom:10}}>Выберите скин из базы</div>

          {!target ? (
            <button style={{...S.btn, ...S.btnGhost, width:'100%', padding:'12px 14px', fontSize:16}} onClick={() => setModal('target')}>Выбрать цель</button>
          ) : (
            <div style={S.targetCard}>
              <img src={target.image} alt={target.name} style={S.tImg}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{target.name}</div>
                <div style={{opacity:.85, margin:'6px 0'}}>{Math.round(Number(target.price||0))}₽</div>
                <div style={{display:'flex', gap:8}}>
                  <button style={{...S.btn, ...S.btnGhost}} onClick={() => setModal('target')}>Изменить</button>
                  <button style={{...S.btn, ...S.btnGhost}} onClick={() => setTarget(null)}>Сбросить</button>
                </div>
              </div>
            </div>
          )}

          <div style={S.filters}>
            <input style={S.input} placeholder="Поиск…" value={q} onChange={e=>setQ(e.target.value)} />
            <input style={{...S.input, width:100}} type="number" placeholder="Мин ₽" value={min} onChange={e=>setMin(e.target.value)} />
            <input style={{...S.input, width:100}} type="number" placeholder="Макс ₽" value={max} onChange={e=>setMax(e.target.value)} />
            <button style={{...S.btn, ...S.btnGhost}} onClick={()=>{setQ('');setMin('');setMax('');}}>Сброс</button>
          </div>

          <div style={S.grid}>
            {targets.map(t => (
              <button key={t.item_master_id} style={S.card} onClick={() => setTarget(t)}>
                <div style={S.cardImgBox}><img src={t.image} alt={t.name} style={S.cardImg}/></div>
                <div style={S.cardName}>{t.name}</div>
                <div style={S.cardPrice}>{Math.round(Number(t.price||0))}₽</div>
              </button>
            ))}
            {!targets.length && <div style={{opacity:.7, padding:'6px'}}>Ничего не найдено</div>}
          </div>
        </div>
      </div>

      {/* Модалка выбора (источник/цель) */}
      {modal && (
        <div style={S.modalBack} onClick={() => setModal(null)}>
          <div style={S.modalBody} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={{fontWeight:800}}>{modal === 'source' ? 'Выберите ваш предмет' : 'Выберите цель'}</div>
              <button style={{...S.btn, ...S.btnGhost}} onClick={() => setModal(null)}>Закрыть</button>
            </div>

            {modal === 'source' ? (
              <>
                {!sources.length && <div style={{opacity:.7}}>Инвентарь пуст</div>}
                <div style={S.grid}>
                  {sources.map(s => (
                    <button key={s.id} style={S.card} onClick={() => { setSource(s); setModal(null); }}>
                      <div style={S.cardImgBox}><img src={s.image} alt={s.name} style={S.cardImg}/></div>
                      <div style={S.cardName}>{s.name}</div>
                      <div style={S.cardPrice}>{Math.round(Number(s.price||0))}₽</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={S.filters}>
                  <input style={S.input} placeholder="Поиск…" value={q} onChange={e=>setQ(e.target.value)} />
                  <input style={{...S.input, width:100}} type="number" placeholder="Мин ₽" value={min} onChange={e=>setMin(e.target.value)} />
                  <input style={{...S.input, width:100}} type="number" placeholder="Макс ₽" value={max} onChange={e=>setMax(e.target.value)} />
                  <button style={{...S.btn, ...S.btnGhost}} onClick={()=>{setQ('');setMin('');setMax('');}}>Сброс</button>
                </div>
                <div style={S.grid}>
                  {targets.map(t => (
                    <button key={t.item_master_id} style={S.card} onClick={() => { setTarget(t); setModal(null); }}>
                      <div style={S.cardImgBox}><img src={t.image} alt={t.name} style={S.cardImg}/></div>
                      <div style={S.cardName}>{t.name}</div>
                      <div style={S.cardPrice}>{Math.round(Number(t.price||0))}₽</div>
                    </button>
                  ))}
                  {!targets.length && <div style={{opacity:.7}}>Ничего не найдено</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ВСПЛЫВАЮЩЕЕ ОКНО РЕЗУЛЬТАТА */}
      {showToast && result && (
        <div style={S.toastBack} onClick={() => setShowToast(false)}>
          <div
            style={{
              ...S.toastBody,
              borderColor: toastColor,
              boxShadow: `0 10px 30px rgba(0,0,0,.5), 0 0 0 2px ${toastColor}33 inset`
            }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <span style={{
                width:12, height:12, borderRadius:'50%', background:toastColor,
                boxShadow:'0 0 10px rgba(0,0,0,.35)'
              }} />
              <div style={{fontWeight:800, fontSize:18}}>
                {result?.outcome === 'win'   && `Вы получили скин${result?.reward?.name ? `: ${result.reward.name}` : ''}`}
                {result?.outcome === 'stay'  && 'Вы ничего не потеряли'}
                {result?.outcome === 'lose'  && 'Ваш предмет сгорел'}
              </div>
            </div>
            <button style={{...S.btn, ...S.btnGhost, padding:'8px 10px', fontSize:13}} onClick={()=>setShowToast(false)}>
              ОК
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FallbackWheel({ sectors, size }) {
  const r = size/2;
  const cx = r, cy = r;
  const a = 360 / sectors.length;

  const slices = sectors.map((s, i) => {
    const start = (i * a - 90) * Math.PI/180;
    const end   = ((i+1) * a - 90) * Math.PI/180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = a > 180 ? 1 : 0;
    const color = OUTCOME_COLOR[s.outcome] || '#444';

    return (
      <g key={i}>
        <path
          d={`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`}
          fill={color}
          opacity="0.9"
          stroke="#222"
          strokeWidth="1"
        />
      </g>
    );
  });

  return (
    <svg width={size} height={size} style={{display:'block', borderRadius:'50%'}}>
      {slices}
      <circle cx={cx} cy={cy} r={r-1} fill="none" stroke="#333" strokeWidth="2"/>
    </svg>
  );
}

/* === размеры (уменьшено ~на 15%) и чёрный указатель вниз === */
const BIG    = 952;   // диаметр колеса
const CENTER = 306;   // диаметр центральной кнопки
const POINTER_W = 28; // половина основания треугольника
const POINTER_H = 99; // высота треугольника

const S = {
  _WHEEL_SIZE: BIG,

  page: { display:'flex', gap:24, padding:'20px', color:'#f6d645' },
  left: { flex:'1 1 auto' },
  right:{ width:460 },

  // смещение колеса ниже — регулируй margin top
  wheelWrap:{ position:'relative', width:BIG, height:BIG, margin:'170px auto 0' },

  // указатель (чёрный, указывает вниз)
  pointerDown:{
    position:'absolute',
    top:-36, left:'50%',
    transform:'translateX(-50%)',
    width:0, height:0,
    borderLeft:`${POINTER_W}px solid transparent`,
    borderRight:`${POINTER_W}px solid transparent`,
    borderTop:`${POINTER_H}px solid #000`,
    zIndex:3
  },

  wheel:{
    position:'absolute',
    inset:0,
    borderRadius:'50%',
    overflow:'hidden',
    display:'grid', placeItems:'center',
    background:'radial-gradient(circle, rgba(255,208,0,0.05), transparent)',
    border:'1px solid #2b2b2b'
  },
  wheelImg:{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' },

  centerBtn:{
    position:'absolute',
    top:'50%', left:'50%',
    transform:'translate(-50%,-50%)',
    width:CENTER, height:CENTER,
    borderRadius:'50%',
    border:'1px solid #2b2b2b',
    background:'#1a1a1a',
    color:'#ffd000',
    fontWeight:800,
    display:'grid', placeItems:'center',
    cursor:'pointer',
    zIndex:4,
    boxShadow:'0 0 28px rgba(255,208,0,0.18) inset'
  },
  centerImg:{ width:CENTER*0.5, height:CENTER*0.5, objectFit:'contain', borderRadius:16, marginBottom:8 },
  centerName:{ fontSize:16, maxWidth:CENTER*0.85, textAlign:'center' },
  centerPrice:{ fontSize:16, opacity:.9 },

  // легенда под рулеткой
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: 28,
    marginTop: 24,
    marginBottom: 18,
    fontSize: 15,
    color: '#fff',
    textAlign: 'center'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    display: 'inline-block',
    boxShadow: '0 0 6px rgba(0,0,0,.4)'
  },

  actions:{ display:'flex', justifyContent:'center', marginTop:8 },

  btn:{ padding:'10px 12px', borderRadius:12, border:'0', fontWeight:800, cursor:'pointer' },
  btnPrimary:{ background:'#ffd000', color:'#111' },
  btnGhost:{ background:'#2b2b2b', color:'#fff' },

  panel:{ marginTop:18, background:'#141414', border:'1px solid #2b2b2b', borderRadius:12, padding:12 },

  targetCard:{ display:'flex', gap:12, alignItems:'center', background:'#1a1a1a', border:'1px solid #2b2b2b', borderRadius:10, padding:10, margin:'10px 0 12px' },
  tImg:{ width:86, height:86, objectFit:'contain', borderRadius:10, background:'#111' },

  filters:{ display:'flex', gap:8, alignItems:'center', margin:'8px 0 10px' },
  input:{ flex:1, minWidth:0, background:'#1a1a1a', border:'1px solid #2b2b2b', color:'#fff', borderRadius:10, padding:'10px 12px', outline:'none' },

  grid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12, maxHeight:'60vh', overflow:'auto', paddingRight:4 },
  card:{ background:'#1a1a1a', border:'1px solid #2b2b2b', color:'#fff', borderRadius:10, padding:10, display:'grid', gap:8, cursor:'pointer', textAlign:'center' },
  cardImgBox:{ height:110, display:'grid', placeItems:'center', background:'#111', borderRadius:8 },
  cardImg:{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' },
  cardName:{ fontSize:14, lineHeight:1.2, maxHeight:'2.6em', overflow:'hidden' },
  cardPrice:{ fontSize:13, color:'#ffea76' },

  modalBack:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'grid', placeItems:'center', zIndex:50 },
  modalBody:{ width:'min(100%, 1100px)', maxHeight:'80vh', overflow:'auto', background:'#141414', border:'1px solid #2b2b2b', borderRadius:14, padding:14 },
  modalHead:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },

  // всплывающее окно результата
  toastBack:{ position:'fixed', inset:0, display:'grid', placeItems:'center', background:'rgba(0,0,0,0.35)', zIndex:60 },
  toastBody:{
    width: 'min(92vw, 520px)',
    background:'#141414',
    border:'2px solid #444',
    borderRadius:16,
    padding:'16px 18px',
    color:'#fff',
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between',
    gap:16
  }
};
