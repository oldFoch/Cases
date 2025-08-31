import React, { useState, useEffect, useRef } from 'react';
import './Header.css';
import logo from '/images/logo.png';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSignInAlt, FaSignOutAlt } from 'react-icons/fa';
import { MONEY_CFG, formatMoneyFC } from '../../config/money';

const BACKEND_URL = 'http://localhost:5000';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formattedBalance, setFormattedBalance] = useState(`0 ${MONEY_CFG.code}`);
  const dropdownRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const r1 = await axios.get(`${BACKEND_URL}/api/auth/me`, { withCredentials: true });
        if (mounted && r1.data) {
          setUser(r1.data);
          setFormattedBalance(formatMoneyFC(r1.data?.balance || 0));
          return;
        }
      } catch {}
      try {
        const r2 = await axios.get(`${BACKEND_URL}/api/users/me`, { withCredentials: true });
        if (mounted && r2.data) {
          setUser(r2.data);
          setFormattedBalance(formatMoneyFC(r2.data?.balance || 0));
        }
      } catch {
        if (mounted) {
          setUser(null);
          setFormattedBalance(`0 ${MONEY_CFG.code}`);
        }
      }
    };
    loadUser();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const onBalanceRaw = (e) => {
      const b = e?.detail;
      if (typeof b === 'number') {
        setUser(prev => prev ? { ...prev, balance: Number(b) || 0 } : prev);
        setFormattedBalance(formatMoneyFC(b));
      }
    };
    const onBalanceFC = (e) => {
      const d = e?.detail;
      if (d && typeof d.raw === 'number') {
        setUser(prev => prev ? { ...prev, balance: d.raw } : prev);
        setFormattedBalance(d.formatted || formatMoneyFC(d.raw));
      }
    };
    window.addEventListener('balance:update', onBalanceRaw);
    window.addEventListener('balance:update:fc', onBalanceFC);
    return () => {
      window.removeEventListener('balance:update', onBalanceRaw);
      window.removeEventListener('balance:update:fc', onBalanceFC);
    };
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
    axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true })
      .then(() => {
        setUser(null);
        setFormattedBalance(`0 ${MONEY_CFG.code}`);
        navigate('/');
      });
  };

  const mode = location.pathname.startsWith('/casino') ? 'casino' : 'cases';
  const goMode = (m) => {
    navigate(m === 'cases' ? '/' : '/casino/wheel'); // дефолт на wheel
  };

  const isAdmin = !!(user?.is_admin ?? user?.isAdmin);

  return (
    <header className="header">
      <div className={`header-wrap ${isMenuOpen ? 'open' : ''}`}>
        <Link to="/" className="logo">
          <img src={logo} alt="CS2 Case" />
        </Link>

        <div className="mode-switch">
          <button className={`mode-btn ${mode === 'cases' ? 'active' : ''}`} onClick={() => goMode('cases')}>
            Case
          </button>
          <button className={`mode-btn ${mode === 'casino' ? 'active' : ''}`} onClick={() => goMode('casino')}>
            More
          </button>
        </div>

        <nav className="nav"><ul className="nav-list" /></nav>

<div className="auth-section" ref={dropdownRef}>
  {!user ? (
    <a href={`${BACKEND_URL}/api/auth/steam`} className="btn login">
      <FaSignInAlt className="icon" />
      <span className="btn-text">Войти</span>
    </a>
  ) : (
    <div className="user-mini">
      <div className="user-box">
        <Link to="/profile" className="btn avatar-btn" title="Профиль">
          <img src={user.avatar} alt={user.username} className="avatar" />
        </Link>
        <Link to="/donate" className="btn balance-btn" title="Пополнить">
          <span className="user-balance">{formattedBalance}</span>
        </Link>
      </div>
    </div>
  )}
</div>



        <button className="menu-toggle" onClick={() => setIsMenuOpen(o => !o)}>
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  );
}
