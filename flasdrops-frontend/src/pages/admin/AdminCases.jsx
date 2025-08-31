import React, { useState } from 'react';
import axios from 'axios';

export default function AdminCases() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/cases', {
        name,
        price: Number(price), // число обязательно
      });
      alert('Кейс добавлен!');
      setName('');
      setPrice('');
    } catch (err) {
      console.error(err);
      alert('Ошибка при добавлении кейса');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Добавить кейс</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Название кейса:</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Цена кейса:</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
          />
        </div>
        <button type="submit">Добавить</button>
      </form>
    </div>
  );
}
