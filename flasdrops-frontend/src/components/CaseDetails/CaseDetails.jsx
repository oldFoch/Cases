// flashdrops-frontend/src/components/CaseDetails/CaseDetails.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './CaseDetails.css';

export default function CaseDetails() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);

  useEffect(() => {
    axios
      .get(`http://localhost:5000/api/cases/${id}`, { withCredentials: true })
      .then(res => setCaseData(res.data))
      .catch(err => {
        console.error("Ошибка при загрузке кейса:", err);
        setCaseData({ items: [] }); // чтобы не встал forever loading
      });
  }, [id]);

  if (!caseData || caseData.name === undefined) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="case-details">
      <h2 className="case-title">{caseData.name}</h2>
      <div
        className="case-banner"
        style={{ backgroundImage: `url(${caseData.image})` }}
      />
      <p className="case-price">Цена: {caseData.price}₽</p>

      <div className="roulette-container">
        {caseData.items.map((item, idx) => (
          <div key={idx} className="roulette-item">
            <img src={item.image} alt={item.name} />
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              <span className="item-chance">{item.chance}%</span>
            </div>
          </div>
        ))}
      </div>

      <button className="spin-button">Крутить</button>
    </div>
  );
}
