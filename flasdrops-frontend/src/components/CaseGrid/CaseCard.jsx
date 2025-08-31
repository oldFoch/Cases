import React, { useState } from 'react';
import './CaseItemCard.css';

const CaseItemCard = ({ item }) => {
  const [showQualities, setShowQualities] = useState(false);
  const [qualities, setQualities] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchItemQualities = async (itemName) => {
    if (!itemName) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(itemName)}/qualities`);
      const data = await response.json();
      setQualities(data);
    } catch (error) {
      console.error('Error fetching qualities:', error);
      setQualities([]);
    }
    setLoading(false);
  };

  const handleMouseEnter = () => {
    const itemName = item.name || item.market_hash_name;
    if (itemName) {
      fetchItemQualities(itemName);
      setShowQualities(true);
    }
  };

  const handleMouseLeave = () => {
    setShowQualities(false);
  };

  return (
    <div 
      className="case-item-card-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="case-item-card">
        <img 
          src={item.image} 
          alt={item.name || item.market_hash_name} 
          className="case-item-card-img" 
        />
        <div className="case-item-card-name">
          {item.name || item.market_hash_name}
        </div>
      </div>

      {/* Карточка с ценами по качествам */}
      {showQualities && (
        <div className="item-qualities-card">
          <h4>{item.name || item.market_hash_name}</h4>
          {loading ? (
            <div className="loading-text">Загрузка цен...</div>
          ) : qualities.length > 0 ? (
            <table className="qualities-table">
              <thead>
                <tr>
                  <th>Качество</th>
                  <th>Цена</th>
                  <th>Тип</th>
                </tr>
              </thead>
              <tbody>
                {qualities.map((quality, index) => (
                  <tr key={index}>
                    <td>{quality.wear}</td>
                    <td>{Math.round(quality.price_rub)} ₽</td>
                    <td>
                      {quality.is_stattrak && 'StatTrak™'}
                      {quality.is_souvenir && 'Souvenir'}
                      {!quality.is_stattrak && !quality.is_souvenir && 'Обычный'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-data">Нет данных о ценах</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseItemCard;