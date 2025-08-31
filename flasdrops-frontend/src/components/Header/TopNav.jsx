import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './TopNav.css';

axios.defaults.withCredentials = true;

export default function TopNav() {
  const [me, setMe] = useState(null);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;
    axios.get('/api/users/me', { params: { _ts: Date.now() }})
      .then(r => { if (mounted) setMe(r.data || null); })
      .catch(() => { if (mounted) setMe(null); });
    return () => { mounted = false; };
  }, [loc.pathname]);

  return (
    <div className="topnav">
      <div className="tn-left">
        <Link to="/" className="tn-logo">FLASHDROPS</Link>
        <Link to="/cases" className="tn-link">Кейсы</Link>
        <Link to="/casino" className="tn-link">Казино</Link>
        {me?.is_admin ? (
          <Link to="/admin/cases" className="tn-link tn-admin">Админ</Link>
        ) : null}
      </div>
      <div className="tn-right">
        {me?.id ? (
          <Link to="/profile" className="tn-user">
            <img src={me.avatar || '/images/avatar-placeholder.png'} alt="avatar" />
            <span className="name">{me.username || 'Профиль'}</span>
          </Link>
        ) : (
          <a href="/api/auth/steam" className="tn-link">Войти</a>
        )}
      </div>
    </div>
  );
}
