// flashdrops-frontend/src/components/Header/Header.jsx

import React, { useState, useEffect } from 'react';
import './Header.css';
import logo from './logo.png';
import axios from 'axios';
import {
  FaBoxOpen,
  FaTrophy,
  FaQuestionCircle,
  FaSignInAlt,
  FaSignOutAlt
} from 'react-icons/fa';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Попробуем получить данные текущего пользователя
    axios
      .get('https://your-test-domain.com/api/auth/me', { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  return (
    <header className="header">
      <div className={`header-wrap ${isMenuOpen ? 'open' : ''}`}>
        <a href="/" className="logo">
          <img src={logo} alt="CS2 Case" />
        </a>

        <nav className="nav">
          <ul className="nav-list">
            <li>
              <a href="/cases">
                <FaBoxOpen className="icon" />
                Кейсы
              </a>
            </li>
            <li>
              <a href="/top">
                <FaTrophy className="icon" />
                Топ выигрышей
              </a>
            </li>
            <li>
              <a href="/faq">
                <FaQuestionCircle className="icon" />
                FAQ
              </a>
            </li>
          </ul>
        </nav>

        <div className="auth-section">
          {!user && (
            <a
              href="https://your-test-domain.com/api/auth/steam"
              className="btn login"
            >
              <FaSignInAlt className="icon" />
              <span className="btn-text">Войти</span>
            </a>
          )}
          {user && (
            <a
              href="https://your-test-domain.com/api/auth/logout"
              className="btn logout"
              title="Выйти"
            >
              <FaSignOutAlt className="icon" />
            </a>
          )}
        </div>

        <button
          className="menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  );
}
