// src/components/Profile/Profile.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Profile.css';

function FC({ value }) {
  const val = Number(value || 0).toFixed(2);
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

export default function Profile() {
  const [user, setUser] = useState(null);
  const [tradeUrl, setTradeUrl] = useState('');
  const [savingTU, setSavingTU] = useState(false);

  const emitBalance = (b) => {
    if (typeof b === 'number') {
      window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(b) || 0 }));
    }
  };

  const load = async () => {
    const { data } = await axios.get('/api/users/me', {
      withCredentials: true,
      params: { _ts: Date.now() }
    });
    setUser(data);
    setTradeUrl(data.trade_url || '');
    if (typeof data.balance === 'number') emitBalance(data.balance);
  };

  useEffect(() => {
    load().catch(() => setUser(null));
  }, []);

  const sell = async (invId) => {
    try {
      const { data } = await axios.post(
        `/api/users/inventory/${invId}/sell`,
        {},
        { withCredentials: true }
      );

      // локально обновим профиль
      await load();

      // пушнём новый баланс в шапку
      if (typeof data.balance === 'number') {
        emitBalance(Number(data.balance) || 0);
      } else {
        try {
          const r = await axios.get('/api/users/balance', { withCredentials: true, params: { _ts: Date.now() } });
          if (typeof r.data?.balance === 'number') emitBalance(Number(r.data.balance) || 0);
        } catch {}
      }

      const added = Number(data.balance_added ?? data.amount ?? 0) || 0;
      alert(`Продано на ${added.toFixed(2)} FC`);
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка продажи');
    }
  };

  const withdraw = async (invId) => {
    try {
      if (!tradeUrl) {
        alert('Сначала укажите Steam trade URL (вверху профиля).');
        return;
      }
      await axios.post(`/api/withdraw/${invId}/reserve`, {}, { withCredentials: true });
      alert('Предмет зарезервирован у бота. Ожидайте отправку.');
      await load();
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка вывода');
    }
  };

  const saveTradeUrl = async () => {
    if (!tradeUrl || !/^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=/.test(tradeUrl)) {
      alert('Введите корректную Steam trade URL');
      return;
    }
    try {
      setSavingTU(true);
      const { data } = await axios.patch(
        '/api/users/tradeurl',
        { trade_url: tradeUrl },
        { withCredentials: true }
      );
      setTradeUrl(data.trade_url || tradeUrl);
      alert('Трейд-ссылка сохранена');
    } catch (e) {
      alert(e.response?.data?.error || 'Не удалось сохранить трейд-ссылку');
    } finally {
      setSavingTU(false);
    }
  };

  if (!user) {
    return (
      <div className="profile">
        <p>Пожалуйста, войдите через Steam.</p>
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile-header">
        <img src={user.avatar} alt={user.username} className="profile-avatar"/>
        <h2 className="profile-username">{user.username}</h2>
        <p className="profile-balance">Баланс: <FC value={user.balance} /></p>
      </div>

      {/* Steam trade URL — компактный блок */}
      <div className="tradeurl-card" style={{margin:'16px 0', padding:'12px', border:'1px solid #333', borderRadius:8}}>
        <div style={{marginBottom:8, fontWeight:600}}>Steam trade URL</div>
        <div style={{display:'flex', gap:8}}>
          <input
            type="url"
            className="input"
            placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
            value={tradeUrl}
            onChange={e => setTradeUrl(e.target.value)}
            style={{flex:1}}
            disabled={savingTU}
          />
          <button className="sell-btn" onClick={saveTradeUrl} disabled={savingTU}>
            {savingTU ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
        <div style={{marginTop:8, opacity:.8, fontSize:14}}>
          Где взять? Инвентарь → Предложения обмена → «Кто может посылать мне предложения обмена?» → «Создать ссылку».
        </div>
      </div>

      <h3 className="inventory-title">Ваши выигрыши</h3>
      {!user.inventory?.length ? (
        <p className="empty-inv">Инвентарь пуст.</p>
      ) : (
        <div className="inventory-grid">
          {user.inventory.map((it) => (
            <div key={it.id} className={`inventory-card ${it.is_sold ? 'sold' : ''}`}>
              <img src={it.image} alt={it.name} className="inventory-img"/>
              <div className="inventory-info">
                <div className="inventory-name">{it.name}</div>
                <div className="inventory-price"><FC value={it.price} /></div>
                <div className="inventory-date">{new Date(it.won_at || it.wonAt).toLocaleString()}</div>
                {it.withdraw_state && it.withdraw_state !== 'none' && (
                  <div className="inventory-state">Вывод: {it.withdraw_state}</div>
                )}
              </div>
              {!it.is_sold ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="sell-btn" onClick={() => sell(it.id)}>Продать</button>
                  {it.withdraw_state !== 'sent' && (
                    <button className="sell-btn" onClick={() => withdraw(it.id)}>Вывести</button>
                  )}
                </div>
              ) : (
                <div className="sold-badge">Продано</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
