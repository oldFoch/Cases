import React, { useEffect, useState } from 'react';
import './CaseGrid.css';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function CaseGrid() {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/cases')
      .then(res => setCases(res.data))
      .catch(() => setCases([]));
  }, []);

  return (
    <div className="case-grid">
      {cases.map((c) => (
        <Link to={`/cases/${c._id}`} className="case-card" key={c._id}>
          <img src={c.image} alt={c.name} className="case-img" />
          <div className="case-name">{c.name}</div>
          <div className="case-price">{c.price}₽</div>
        </Link>
      ))}
    </div>
  );
}
