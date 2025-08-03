import React, { useEffect, useState, useRef } from 'react';
import './NewsSlider.css';

import slide1 from '/images/slide1.png';
import slide2 from '/images/slide2.jpg';
import slide3 from '/images/slide3.jpg';

const slides = [
  {
    image: slide1,
    buttonText: 'ПРИНЯТЬ УЧАСТИЕ',
    link: '/cases/1'
  },
  {
    image: slide2,
    buttonText: 'ПОДПИСАТЬСЯ',
    link: '/deposit'
  },
  {
    image: slide3,
    buttonText: 'ПОЛУЧИТЬ НАГРАДУ',
    link: '/giveaway'
  }
];

export default function NewsSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setProgress(0);
    restartProgress();
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
  };

  const prevSlide = () => {
    
    setProgress(0);
    restartProgress();
  };

  const restartProgress = () => {
    clearInterval(intervalRef.current);
    startProgress();
  };

  const startProgress = () => {
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextSlide();
          return 0;
        }
        return prev + 1;
      });
    }, 60);
  };

  useEffect(() => {
    startProgress();
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="slider-container">
      <div className="slider-slide" style={{ backgroundImage: `url(${slides[currentSlide].image})` }}>
        <a href={slides[currentSlide].link} className="slider-button">
          {slides[currentSlide].buttonText}
        </a>

        <div className="slider-pagination">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`pagination-bar ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            >
              {index === currentSlide && (
                <div
                  className="pagination-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
