import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CaseDetails.css';
import PriceFC from '../PriceFC.jsx';

export default function CaseDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [itemQualities, setItemQualities] = useState({});
  const [loadingQualities, setLoadingQualities] = useState({});
  const [userBalance, setUserBalance] = useState(0);

  const [stage, setStage] = useState('idle'); // idle, spinning, done
  const windowRef = useRef(null);
  const stripRef = useRef(null);
  const [reel, setReel] = useState([]);
  const [targetIndex, setTargetIndex] = useState(null);

  const ITEM_WIDTH = 180;
  const ITEM_GAP = 20;
  const STEP = ITEM_WIDTH + ITEM_GAP;

  // Загрузка данных кейса
  useEffect(() => {
    let alive = true;
    axios
      .get(`/api/cases/${encodeURIComponent(slug)}`, { withCredentials: true })
      .then(res => { 
        if (alive) setCaseData(res.data); 
      })
      .catch(() => { 
        if (alive) setCaseData(null); 
      });
    
    // Загрузка баланса пользователя
    axios
      .get('/api/user/balance', { withCredentials: true })
      .then(res => {
        if (alive && res.data?.balance) {
          setUserBalance(res.data.balance);
        }
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [slug]);

  const items = useMemo(() => caseData?.items ?? [], [caseData]);

  // Функция для получения цен по качествам
  const fetchItemQualities = async (itemName, itemId) => {
    if (!itemName) return;
    
    setLoadingQualities(prev => ({ ...prev, [itemId]: true }));
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(itemName)}/qualities`);
      const data = await response.json();
      setItemQualities(prev => ({ ...prev, [itemId]: data }));
    } catch (error) {
      console.error('Error fetching qualities:', error);
      setItemQualities(prev => ({ ...prev, [itemId]: [] }));
    }
    setLoadingQualities(prev => ({ ...prev, [itemId]: false }));
  };

  const handleItemMouseEnter = (item, index) => {
    const itemName = item.name || item.market_hash_name;
    const itemId = item.id || index;
    setHoveredItem(itemId);
    if (!itemQualities[itemId]) {
      fetchItemQualities(itemName, itemId);
    }
  };

  const handleItemMouseLeave = () => {
    setHoveredItem(null);
  };

  // Создание рулетки
  const buildReel = (baseItems, length = 100) => {
    const arr = [];
    const src = [...baseItems];
    
    // Перемешиваем
    for (let i = src.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [src[i], src[j]] = [src[j], src[i]];
    }
    
    // Заполняем массив
    while (arr.length < length) {
      for (let i = 0; i < src.length && arr.length < length; i++) {
        arr.push(src[i]);
      }
    }
    
    return arr;
  };

  // Обновление баланса
  const updateBalance = (newBalance) => {
    if (typeof newBalance === 'number') {
      setUserBalance(newBalance);
      window.dispatchEvent(new CustomEvent('balance:update', { detail: newBalance }));
    }
  };

  // Обработка открытия кейса
  const handleSpin = async () => {
    if (opening || !items.length || !caseData?.id) return;

    setOpening(true);
    setResult(null);

    const freshReel = buildReel(items, 100);
    setReel(freshReel);
    setStage('spinning');

    try {
      const { data } = await axios.post(
        `/api/cases/open`,
        { case_id: Number(caseData.id) },
        { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
      );

      const drop = data.won
        ? { name: data.won.name, image: data.won.image, price_rub: data.won.price }
        : (data.item || null);

      if (data.balance != null) updateBalance(data.balance);
      if (!drop) throw new Error('Bad response');

      setResult(drop);

      // Устанавливаем выигрышный предмет в нужную позицию
      const targetIdx = Math.floor(freshReel.length * 0.75);
      freshReel[targetIdx] = { ...drop, __won: true };
      setReel([...freshReel]);
      setTargetIndex(targetIdx);

      // Анимация прокрутки
      setTimeout(() => {
        const win = windowRef.current;
        const strip = stripRef.current;
        if (!win || !strip) return;

        const windowWidth = win.clientWidth;
        const centerX = windowWidth / 2;
        const targetPixel = targetIdx * STEP + (ITEM_WIDTH / 2);
        const finalOffset = centerX - targetPixel;

        strip.style.transition = 'none';
        strip.style.transform = `translateX(0px)`;

        setTimeout(() => {
          const duration = 4000 + Math.floor(Math.random() * 1000);
          strip.style.transition = `transform ${duration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
          strip.style.transform = `translateX(${finalOffset}px)`;
        }, 50);
      }, 100);
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка открытия кейса');
      setStage('idle');
      setOpening(false);
    }
  };

  // Обработка завершения анимации
  const onTransitionEnd = () => {
    if (stage === 'spinning') {
      setStage('done');
      setOpening(false);
    }
  };

  // Действия с результатом
  const handleSell = () => { 
    navigate('/profile'); 
  };
  
  const handleUpgrade = () => { 
    navigate('/upgrade'); 
  };
  
  const handleSpinAgain = () => {
    setStage('idle');
    setResult(null);
    setReel([]);
    setTargetIndex(null);
  };

  // Быстрое открытие
  const handleQuickOpen = () => {
    // Логика быстрого открытия без анимации
    console.log('Quick open');
  };

  // Определение редкости предмета по его атрибутам или цене
  const getItemRarity = (item) => {
    // Проверяем наличие поля rarity в предмете
    if (item.rarity) {
      const rarityMap = {
        'covert': 'red',
        'classified': 'pink',
        'restricted': 'purple',
        'mil-spec': 'blue',
        'milspec': 'blue',
        'industrial': 'lightblue',
        'consumer': 'gray',
        'rare': 'gold',
        'contraband': 'yellow',
        'extraordinary': 'gold',
        'knife': 'gold',
        'gloves': 'gold'
      };
      
      const rarity = item.rarity.toLowerCase().replace(/[-_\s]/g, '');
      return rarityMap[rarity] || 'blue';
    }
    
    // Проверяем, является ли предмет ножом или перчатками
    const itemName = (item.name || item.market_hash_name || '').toLowerCase();
    if (itemName.includes('★') || itemName.includes('knife') || itemName.includes('нож') || 
        itemName.includes('karambit') || itemName.includes('bayonet') || itemName.includes('перчатки') ||
        itemName.includes('gloves') || itemName.includes('butterfly') || itemName.includes('falchion')) {
      return 'gold';
    }
    
    // Определяем по цене, если нет других данных
    const price = item.price_rub ?? item.price ?? 0;
    if (price > 50000) return 'gold';
    if (price > 20000) return 'red';
    if (price > 10000) return 'pink';
    if (price > 5000) return 'purple';
    if (price > 1000) return 'blue';
    if (price > 100) return 'lightblue';
    return 'gray';
  };

  // Расчет шанса выпадения
  const calculateChance = (itemPrice) => {
    const totalValue = items.reduce((sum, item) => sum + (item.price_rub ?? item.price ?? 0), 0);
    const chance = (itemPrice / totalValue) * 100;
    return chance < 0.01 ? '< 0.01%' : `${chance.toFixed(3)}%`;
  };

  if (!caseData) {
    return (
      <div className="case-details-container">
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
          Загрузка...
        </div>
      </div>
    );
  }

  const casePrice = caseData.price_rub ?? caseData.price ?? 0;

  return (
    <div className="case-details-container">
      {/* Шапка */}
      <div className="case-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Назад
        </button>
        <h1 className="case-title">{caseData.name || caseData.title}</h1>
      </div>

      {/* Секция открытия кейса */}
      <div className="case-opening-section">
        <div className={`case-visual-container ${stage}`}>
          {/* Баннер кейса (показывается только в idle) */}
          {stage === 'idle' && (
            <div className="case-banner">
              <img 
                className="case-banner-image" 
                src={caseData.image} 
                alt={caseData.name || caseData.title} 
              />
            </div>
          )}

          {/* Рулетка (показывается при spinning и done) */}
          {(stage === 'spinning' || stage === 'done') && (
            <div className="roulette-container">
              <div className="roulette-window" ref={windowRef}>
                <div className="roulette-mask-left" />
                <div className="roulette-mask-right" />
                <div className="roulette-center-line" />
                
                <div 
                  className="roulette-strip" 
                  ref={stripRef}
                  onTransitionEnd={onTransitionEnd}
                >
                  {reel.map((item, idx) => (
                    <div 
                      key={`${item.id || item.name}-${idx}`}
                      className="roulette-item-card"
                    >
                      <img 
                        className="roulette-item-image" 
                        src={item.image} 
                        alt={item.name || item.market_hash_name} 
                      />
                      <div className="roulette-item-name">
                        {item.name || item.market_hash_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Контролы открытия */}
        {stage === 'idle' && (
          <div className="open-controls">
            <button
              className="open-button"
              onClick={handleSpin}
              disabled={opening}
            >
              {opening ? 'Открываем...' : `Открыть за ${casePrice} ₽`}
            </button>
            
            <button className="quick-open-button" onClick={handleQuickOpen}>
              Быстрое открытие
            </button>
          </div>
        )}

        {/* Результат */}
        {stage === 'done' && result && (
          <div className="result-section">
            <div className={`result-card result-card-${getItemRarity(result)}`}>
              <img 
                className="result-image" 
                src={result.image} 
                alt={result.name || result.market_hash_name} 
              />
              <div className="result-name">
                {result.name || result.market_hash_name}
              </div>
              <div className="result-price">
                <PriceFC value={result.price_rub ?? result.price} />
              </div>
            </div>

            <div className="result-actions">
              <button className="sell-button" onClick={handleSell}>
                Продать
              </button>
              <button className="upgrade-button" onClick={handleUpgrade}>
                Апгрейд
              </button>
              <button className="spin-again-button" onClick={handleSpinAgain}>
                Ещё раз
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Содержимое кейса */}
      <div className="case-contents">
        <h2 className="contents-header">Содержимое кейса</h2>
        
        <div className="items-grid">
          {items.map((item, idx) => {
            const itemId = item.id || idx;
            const itemPrice = item.price_rub ?? item.price ?? 0;
            const rarity = getItemRarity(item);
            const qualities = itemQualities[itemId] || [];
            const loading = loadingQualities[itemId];
            
            return (
              <div 
                key={itemId}
                className="item-card"
                onMouseEnter={() => handleItemMouseEnter(item, itemId)}
                onMouseLeave={handleItemMouseLeave}
              >
                <div className={`item-rarity-indicator item-rarity-${rarity}`} />
                
                <div className="item-content">
                  <div className="item-image-container">
                    <img 
                      className="item-image" 
                      src={item.image} 
                      alt={item.name || item.market_hash_name} 
                    />
                    <div className="item-chance">
                      {calculateChance(itemPrice)}
                    </div>
                  </div>
                  
                  <div className="item-details">
                    <div className="item-name">
                      {item.name || item.market_hash_name}
                    </div>
                    <div className="item-price">
                      <PriceFC value={itemPrice} />
                    </div>
                  </div>
                </div>

                {/* Секция качеств внутри карточки */}
                <div className="item-qualities-section">
                  <div className="qualities-content">
                    <div className="qualities-header">
                      <span>Качества</span>
                    </div>
                    {loading ? (
                      <div className="qualities-loading">
                        Загрузка...
                      </div>
                    ) : qualities.length > 0 ? (
                      <div className="qualities-list">
                        {qualities.map((quality, qIdx) => (
                          <div key={qIdx} className="quality-item">
                            <span className="quality-label">{quality.wear}</span>
                            <div className="quality-value">
                              <span className="quality-value-price">
                                {Math.round(quality.price_rub)} ₽
                              </span>
                              {quality.is_stattrak && (
                                <span className="quality-badge">ST</span>
                              )}
                              {quality.is_souvenir && (
                                <span className="quality-badge">SV</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="qualities-empty">
                        Нет данных
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}