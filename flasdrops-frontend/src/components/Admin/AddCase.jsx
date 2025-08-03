import React, { useState } from 'react';
import axios from 'axios';
import './AddCase.css';

export default function AddCase() {
  const [form, setForm] = useState({
    name: '',
    image: '',
    price: '',
    items: []
  });

  const [newItem, setNewItem] = useState({
    name: '',
    image: '',
    price: '',
    chance: ''
  });

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleItemChange = (e) => {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, newItem] });
    setNewItem({ name: '', image: '', price: '', chance: '' });
  };

  const submitCase = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/admin/cases', form, { withCredentials: true });
      alert('✅ Кейс добавлен');
      setForm({ name: '', image: '', price: '', items: [] });
    } catch (err) {
      alert('Ошибка при добавлении кейса');
    }
  };

  return (
    <div className="add-case-container">
      <h2>Добавить кейс</h2>
      <form onSubmit={submitCase}>
        <input name="name" placeholder="Название кейса" value={form.name} onChange={handleFormChange} required />
        <input name="image" placeholder="Ссылка на картинку кейса" value={form.image} onChange={handleFormChange} required />
        <input name="price" type="number" placeholder="Цена кейса" value={form.price} onChange={handleFormChange} required />
        
        <h3>Предметы</h3>
        <div className="item-form">
          <input name="name" placeholder="Название предмета" value={newItem.name} onChange={handleItemChange} />
          <input name="image" placeholder="Картинка" value={newItem.image} onChange={handleItemChange} />
          <input name="price" type="number" placeholder="Цена" value={newItem.price} onChange={handleItemChange} />
          <input name="chance" type="number" placeholder="Шанс (%)" value={newItem.chance} onChange={handleItemChange} />
          <button type="button" onClick={addItem}>Добавить предмет</button>
        </div>

        <ul className="item-list">
          {form.items.map((item, index) => (
            <li key={index}>{item.name} - {item.price}$ ({item.chance}%)</li>
          ))}
        </ul>

        <button type="submit">Создать кейс</button>
      </form>
    </div>
  );
}
