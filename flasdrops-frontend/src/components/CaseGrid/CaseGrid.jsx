// flashdrops-frontend/src/components/CaseGrid/CaseGrid.jsx

import React, { useEffect, useState } from 'react';
import './CaseGrid.css';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function CaseGrid() {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    axios
      .get('http://localhost:5000/api/cases', { withCredentials: true })
      .then(res => setCases(res.data))
      .catch(() => setCases([]));
  }, []);

  const resolveImage = (path) => {
    // Если полный URL — возвращаем как есть
    if (/^https?:\/\//.test(path)) {
      return path;
    }
    // Если путь уже начинается с /images/, возвращаем его напрямую
    if (/^\/images\//.test(path)) {
      return path;
    }
    // Иначе убираем все лидирующие слэши и добавляем /images/
    const filename = path.replace(/^\/+/, '');
    return `/images/${filename}`;
  };

  if (cases.length === 0) {
    return (
      <div className="case-grid loading">
        Кейсы не найдены или ошибка загрузки.
      </div>
    );
  }

  return (
    <div className="case-grid">
      {cases.map(c => (
        <Link to={`/cases/${c._id}`} className="case-card" key={c._id}>
          <img
            src={resolveImage(c.image)}
            alt={c.name}
            className="case-img"
          />
          <div className="case-info">
            <div className="case-name">{c.name}</div>
            <div className="case-price">{c.price}₽</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
