import React, { useEffect, useState } from 'react';
import './PromoBanner.css';
import bannerImage from '/images/banner.jpg';

export default function PromoBanner() {
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60); // 2 часа в секундах

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (sec) => {
    const hrs = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const secs = String(sec % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div className="promo-banner">
      <img src={bannerImage} alt="Promo" className="banner-image" />
      <div className="banner-content">
        <div className="timer">{formatTime(timeLeft)}</div>
        <a href="/event" className="banner-button">Участвовать</a>
      </div>
    </div>
  );
}
