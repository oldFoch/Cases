import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Profile.css';

export default function Profile() {
  const [user, setUser] = useState(null);

  const load = async () => {
    const { data } = await axios.get('/api/users/me', { withCredentials: true });
    setUser(data);
  };

  useEffect(() => {
    load().catch(() => setUser(null));
  }, []);

  const sell = async (invId) => {
    try {
      const { data } = await axios.post(`/api/users/inventory/${invId}/sell`, {}, { withCredentials: true });
      // Обновим профиль/инвентарь
      await load();
      alert(`Продано на ${data.amount.toFixed(2)} ₽`);
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка продажи');
    }
  };

  if (!user) return <div className="profile"><p>Пожалуйста, войдите через Steam.</p></div>;

  return (
    <div className="profile">
      <div className="profile-header">
        <img src={user.avatar} alt={user.username} className="profile-avatar"/>
        <h2 className="profile-username">{user.username}</h2>
        <p className="profile-balance">Баланс: {Number(user.balance).toFixed(2)}₽</p>
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
                <div className="inventory-price">{Number(it.price).toFixed(2)}₽</div>
                <div className="inventory-date">{new Date(it.won_at || it.wonAt).toLocaleString()}</div>
              </div>
              {!it.is_sold ? (
                <button className="sell-btn" onClick={() => sell(it.id)}>Продать</button>
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
