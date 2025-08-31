import { useEffect, useRef, useState } from 'react';
import './Roulette.css';

/**
 * Чистая интеграция твоего примера:
 * - 37 сегментов
 * - запрос к /api/upgrade/spin
 * - без внешних зависимостей
 *
 * Картинка не требуется — можно оставить Imgur по умолчанию
 * или поменять на любую другую. Вёрстка и логика — как в твоём коде.
 */

const WHEEL_IMG = 'https://i.imgur.com/N01W3Ks.png'; // можно заменить, но не обязательно
const SEGMENTS = 37;
const SEGMENT_ANGLE = 360 / SEGMENTS;
const OFFSET = SEGMENT_ANGLE / 2;

export default function Roulette() {
  const imgRef = useRef(null);
  const [currentRotation, setCurrentRotation] = useState(OFFSET);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    // автозапуск по твоему примеру
    handleSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);

    if (imgRef.current) imgRef.current.style.filter = 'blur(8px)';

    let targetIndex = 0;
    let extraTurns = 3;
    try {
      const res = await fetch('/api/upgrade/spin', { credentials: 'include' });
      const data = await res.json();
      targetIndex = data?.targetIndex ?? 0;
      extraTurns = data?.extraTurns ?? 3;
    } catch {
      targetIndex = Math.floor(Math.random() * SEGMENTS);
      extraTurns = Math.floor(Math.random() * 2) + 3;
    }

    const currentMod = ((currentRotation % 360) + 360) % 360;
    const desiredAngle = targetIndex * SEGMENT_ANGLE + OFFSET;
    const baseDelta = (desiredAngle - currentMod + 360) % 360;
    const totalDelta = baseDelta + extraTurns * 360;
    const next = currentRotation + totalDelta;

    setCurrentRotation(next);

    const node = imgRef.current;
    if (!node) return;
    const onEnd = () => {
      node.style.filter = 'blur(0px)';
      setSpinning(false);
      node.removeEventListener('transitionend', onEnd);
    };
    node.addEventListener('transitionend', onEnd);
  };

  return (
    <div className="roulette">
      <div className="wheel" onClick={handleSpin} role="button" aria-label="Крутить">
        <div className="arrow" />
        <img
          ref={imgRef}
          src={WHEEL_IMG}
          alt="roulette wheel"
          style={{ transform: `rotate(${currentRotation}deg)` }}
          draggable={false}
        />
      </div>

      <button className="spin-cta" onClick={handleSpin} disabled={spinning}>
        {spinning ? 'Крутим…' : 'Крутить'}
      </button>
    </div>
  );
}
