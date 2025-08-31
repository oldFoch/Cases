// src/components/SideMenu/SideMenu.jsx
import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function SideMenu() {
  const [open, setOpen] = useState(true);
  const location = useLocation();

  const mode = useMemo(
    () => (location.pathname.startsWith('/casino') ? 'casino' : 'cases'),
    [location.pathname]
  );

  const items = mode === 'cases'
    ? [
        { to: '/',          label: 'Кейсы'   },
        { to: '/contract',  label: 'Контракт'},
        { to: '/upgrade',   label: 'Апгрейд' },
      ]
    : [
        { to: '/casino/coinflip', label: 'Coinflip' },
        { to: '/casino/towers', label: 'Towers' },
        { to: '/casino/mines',    label: 'Mines'    },
        { to: '/casino/wheel',    label: 'Wheel'    },
        { to: '/casino/dice',     label: 'Dice'     },
        { to: '/casino/plinko',   label: 'Plinko'   },
      ];

  const WIDTH = 200;   // ширина панели
  const TOGGLE = 42;   // размер кнопки
  const WRAP_W = open ? WIDTH + TOGGLE/2 : TOGGLE; // чтобы кнопка всегда была видна на краю

  return (
    <aside style={{ ...S.shell, width: WRAP_W }}>
      <div
        style={{
          ...S.panel,
          width: open ? WIDTH : 0,
          padding: open ? '10px' : '10px 0',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <nav style={S.nav}>
          {items.map(i => (
            <Link key={i.to} to={i.to} style={S.link}>
              {i.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Кнопка — закреплена справа от контейнера, всегда в зоне клика */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Свернуть' : 'Развернуть'}
        aria-expanded={open}
        style={{
          ...S.toggle,
          width: TOGGLE,
          height: TOGGLE,
          left: open ? WIDTH - TOGGLE/2 : 0, // на правом краю панели, а в свернутом — у самого края экрана
        }}
      >
        <span
          style={{
            ...S.chev,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)', // ‹ / ›
          }}
        />
      </button>
    </aside>
  );
}

const S = {
  shell: {
    position: 'fixed',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 999,
    height: 'auto',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none', // кликаем только по детям
  },
  panel: {
    pointerEvents: 'auto',
    height: 'auto',
    background: 'rgba(20,20,20,.92)',
    border: '1px solid #2b2b2b',
    borderRadius: 12,
    backdropFilter: 'blur(4px)',
    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    transition: 'width .18s ease, opacity .18s ease, padding .18s ease',
    overflow: 'hidden',
  },
  nav: {
    display: 'grid',
    gap: 8,
    minWidth: 160,
  },
  link: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 10,
    background: '#1a1a1a',
    border: '1px solid #2b2b2b',
    color: '#ffd000',
    textDecoration: 'none',
    fontWeight: 700,
    transition: 'transform .08s ease, border-color .12s ease',
  },
  toggle: {
    pointerEvents: 'auto',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    borderRadius: 10,
    border: '1px solid #2b2b2b',
    background: '#141414',
    color: '#ffd000',
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(0,0,0,.35)',
    display: 'grid',
    placeItems: 'center',
    transition: 'left .18s ease, background .12s ease',
  },
  chev: {
    display: 'block',
    width: 0,
    height: 0,
    borderTop: '8px solid transparent',
    borderBottom: '8px solid transparent',
    borderLeft: '10px solid #ffd000', // “›”
  },
};
