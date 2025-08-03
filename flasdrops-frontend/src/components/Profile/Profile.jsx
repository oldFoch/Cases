import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Profile.css";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [tradeLink, setTradeLink] = useState("");

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/auth/user", { withCredentials: true })
      .then((res) => {
        setUser(res.data);
        setTradeLink(res.data.tradeLink || "");
      })
      .catch((err) => console.error("Ошибка при получении профиля:", err));
  }, []);

  const handleTopUp = () => {
    alert("Функция пополнения скоро будет доступна.");
  };

  const handleSaveTradeLink = () => {
    alert("Сохранение ссылки пока не реализовано.");
  };

  if (!user) return <div className="profile">Загрузка...</div>;

  return (
    <div className="profile">
      <div className="profile-header">
        <img src={user.avatar} alt="avatar" className="avatar" />
        <div className="info">
          <h2>{user.username}</h2>
          <p>Баланс: ${user.balance.toFixed(2)}</p>
        </div>
        <button onClick={handleTopUp} className="topup-btn">Пополнить</button>
      </div>

      <div className="section">
        <label>Ссылка на обмен:</label>
        <input
          type="text"
          value={tradeLink}
          onChange={(e) => setTradeLink(e.target.value)}
        />
        <button onClick={handleSaveTradeLink}>Сохранить</button>
      </div>

      <div className="section">
        <h3>🎒 Инвентарь:</h3>
        {user.inventory && user.inventory.length > 0 ? (
          <div className="inventory">
            {user.inventory.map((item, index) => (
              <div key={index} className="item">
                <img src={item.image} alt={item.name} />
                <p>{item.name}</p>
                <p>${item.price}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Пусто</p>
        )}
      </div>

      <div className="section">
        <h3>📤 История выводов</h3>
        <p>Скоро...</p>
      </div>
    </div>
  );
};

export default Profile;
