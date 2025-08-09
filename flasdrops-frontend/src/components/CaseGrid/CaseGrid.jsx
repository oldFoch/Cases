// flashdrops-frontend/src/components/CaseGrid/CaseGrid.jsx

import React, { useEffect, useState } from 'react';
import './CaseGrid.css';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function CaseGrid() {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    axios
      .get('/api/cases')      // прокси в vite.config.js направляет на localhost:5000
      .then(res => setCases(res.data))
      .catch(() => setCases([]));
  }, []);

  const resolveImage = (path) => {
    if (/^https?:\/\//.test(path)) {
      return path;
    }
    if (path.startsWith('/images/')) {
      return path;
    }
    const filename = path.replace(/^\/+/, '');
    return `/images/${filename}`;
  };

  if (cases.length === 0) {
    return <div className="case-grid loading">Кейсы не найдены.</div>;
  }

  return (
    <div className="case-grid">
      {cases.map(c => (
        <Link to={`/cases/${c.id}`} className="case-card" key={c.id}>
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
