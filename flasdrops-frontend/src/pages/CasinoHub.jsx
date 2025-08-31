// flashdrops-frontend/src/pages/CasinoHub.jsx
// Простой хаб-страница казино: ссылки на Wheel/Plinko/Dice/...
import React from 'react';
import { Link, Routes, Route, Navigate } from 'react-router-dom';
import Wheel from '../components/Casino/Wheel/Wheel';
import Plinko from '../components/Casino/Plinko/Plinko';
import Dice from '../components/Casino/Dice/Dice';
import Towers from '../components/Casino/Towers/Towers';

export default function CasinoHub() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <Link className="nav-btn" to="wheel">Wheel</Link>
        <Link className="nav-btn" to="plinko">Plinko</Link>
        <Link className="nav-btn" to="dice">Dice</Link>
        <Link className="nav-btn" to="towers">Towers</Link>
      </div>
      <Routes>
        <Route path="wheel" element={<Wheel />} />
        <Route path="plinko" element={<Plinko />} />
        <Route path="dice" element={<Dice />} />
        <Route path="towers" element={<Towers />} />
        <Route path="*" element={<Navigate to="wheel" replace />} />
      </Routes>
    </div>
  );
}
