import React, { useEffect, useState } from 'react';
import './CaseGrid.css';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PriceFC from '../PriceFC.jsx';

export default function CaseGrid() {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    axios
      .get('/api/cases')
      .then(res => setCases(res.data))
      .catch(() => setCases([]));
  }, []);

  const resolveImage = (path) => {
    if (/^https?:\/\//.test(path)) return path;
    if (path.startsWith('/images/')) return path;
    return `/images/${path.replace(/^\/+/, '')}`;
  };

  const renderCasesBySlugs = (title, slugs) => {
    const filtered = cases.filter(c => slugs.includes(c.slug));
    if (filtered.length === 0) return null;

    return (
      <div className="case-group">
        <h2 className="case-group-title">{title}</h2>
        <div className="case-grid">
          {filtered.map(c => (
            <Link to={`/cases/${c.slug}`} className="case-card" key={c.id}>
              <img src={resolveImage(c.image)} alt={c.title} className="case-img" />
              <div className="case-info">
                <div className="case-name">{c.title}</div>
                <div className="price"><PriceFC value={c.price} /></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  if (cases.length === 0) {
    return <div className="case-grid loading">Кейсы не найдены.</div>;
  }

  return (
    <div className="case-wrapper">

      {renderCasesBySlugs("ЭЛИТНАЯ КОЛЛЕКЦИЯ", [
        'phoenix', 'sindicut', 'echo', 'damusc'
      ])}

      {renderCasesBySlugs("ОРУЖЕЙНЫЙ АРСЕНАЛ", [
        'thanos', 'knife_death', 'men_awp', 'AK_Svarshik',
        'm4_voin', 'deagle_veterana', 'glock_case', 'usp_case'
      ])}

      {renderCasesBySlugs("ПАЛИТРА СМЕРТИ", [
        'alii', 'ametist', 'gold', 'emerald', 'snowblast', 'white', 'depth'
      ])}

      {renderCasesBySlugs("АНИМЕ РЕЛИКВИИ", [
        'son', 'bankai', 'goku', 'baki', 'sharingun', 'ghoul', 'satoru', 'ayanokoji'
      ])}

      {renderCasesBySlugs("ЦИФРОВОЙ ВЗЛОМ", [
        'crypto', 'electrical', 'frac_uzor', 'neon',
        'uzor', 'graffity', 'darklight', 'shadowcollect'
      ])}

      {renderCasesBySlugs("БОЕВОЙ РЕЗЕРВ", [
        'last', 'price', 'kamuf', 'flashboom', 'beast', 'beast'
      ])}
    </div>
  );
}
