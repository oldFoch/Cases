// flashdrops-frontend/src/components/Header/Header.jsx

import React, { useState, useEffect, useRef } from 'react';
import './Header.css';
import logo from '/images/logo.png';
import axios from 'axios';
import {
  FaBoxOpen,
  FaTrophy,
  FaQuestionCircle,
  FaSignInAlt,
  FaSignOutAlt
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen]     = useState(false);
  const [user, setUser]                 = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                     = useRef();
  const navigate                        = useNavigate();

  useEffect(() => {
    axios.get('/api/auth/me', { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() =>
        axios.get('/api/users/me', { withCredentials: true })
          .then(res => setUser(res.data))
          .catch(() => setUser(null))
      );
  }, []);

  useEffect(() => {
    const onClickOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = () => {
    axios.get('/api/auth/logout', { withCredentials: true })
      .then(() => {
        setUser(null);
        navigate('/');
      });
  };

  return (
    <header className="header">
      <div className={`header-wrap ${isMenuOpen ? 'open' : ''}`}>
        <Link to="/" className="logo">
          <img src={logo} alt="CS2 Case" />
        </Link>

        <nav className="nav">
          <ul className="nav-list">
            <li><Link to="/cases"><FaBoxOpen className="icon" />Кейсы</Link></li>
            <li><Link to="/top"><FaTrophy className="icon" />Топ выигрышей</Link></li>
            <li><Link to="/faq"><FaQuestionCircle className="icon" />FAQ</Link></li>
          </ul>
        </nav>

        <div className="auth-section" ref={dropdownRef}>
          {!user ? (
            <a href="/api/auth/steam" className="btn login">
              <FaSignInAlt className="icon" />
              <span className="btn-text">Войти</span>
            </a>
          ) : (
            <div className="user-mini">
              <button
                className="user-toggle"
                onClick={() => setDropdownOpen(o => !o)}
              >
                 <Link to="/profile" className="btn avatar-btn" title="Профиль">
                <img src={user.avatar} alt={user.username} className="avatar" />
              </Link>
                <span className="user-balance">{user.balance}₽</span>
              </button>
          
            </div>
            
          )}
        </div>

        <button
          className="menu-toggle"
          onClick={() => setIsMenuOpen(o => !o)}
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  );
}
