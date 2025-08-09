// flashdrops-frontend/src/components/Footer/Footer.jsx

import React, { useEffect, useState } from 'react';
import './Footer.css';
import logo from '/images/logo.png';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function Footer() {
  const [totalOpens, setTotalOpens] = useState(0);

  useEffect(() => {
    axios.get('/api/stats')
      .then(({ data }) => {
        // суммируем все открытия кейсов
        const sum = data.cases.reduce((acc, c) => acc + c.opens, 0);
        setTotalOpens(sum);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="footer">
      <nav className="footer-nav">
        <ul className="footer-nav-list">
          <li><Link to="/cases">Кейсы</Link></li>
          <li><Link to="/top">Топ выигрышей</Link></li>
          <li><Link to="/faq">FAQ</Link></li>
        </ul>
      </nav>
      <div className="footer-content">
        <div className="footer-text">
          Предоставляемая Вами персональная информация (имя, адрес, телефон e-mail, номер кредитной карты) является конфиденциальной и не подлежит разглашению. Данные вашей банковской карты передаются только в зашифрованном виде и не сохраняются на нашем Web-сервере. Все операции с платежными картами происходят в соответствии с требованиями Visa International и MasterCard WorldWide.
        </div>
        <div className="footer-bottom">
          <div className="footer-logo-opens">
            <img src={logo} alt="Logo" className="footer-logo" />
            <span className="opens-text">Всего кейсов открыто: {totalOpens}</span>
          </div>
          <div className="footer-copy">
            &copy; {new Date().getFullYear()} FlashDrops. Все права защищены.
          </div>
        </div>
      </div>
    </footer>
  );
}
