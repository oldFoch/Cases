// flashdrops-frontend/src/components/Admin/AddCase.jsx
import React, { useState } from 'react';
import axios from 'axios';
import './AddCase.css';

const WEARS = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

export default function AddCase() {
  const [form, setForm] = useState({
    name: '',
    image: '',
    price: '',
    items: [],
  });

  const [newItem, setNewItem] = useState({
    name: '',             // отображаемое (опционально)
    image: '',            // картинка (опционально)
    chance: '',
    english_name: '',     // ОБЯЗАТЕЛЬНО
    wear: '',             // ОБЯЗАТЕЛЬНО
    is_stattrak: false,
    is_souvenir: false,
  });

  const onForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const onItem = (e) => {
    const { name, value, type, checked } = e.target;
    setNewItem(i => ({ ...i, [name]: type === 'checkbox' ? checked : value }));
  };

  const addItem = () => {
    if (!newItem.english_name || !newItem.wear) {
      return alert('Нужны english_name и wear');
    }
    setForm(f => ({ ...f, items: [...f.items, newItem] }));
    setNewItem({
      name: '',
      image: '',
      chance: '',
      english_name: '',
      wear: '',
      is_stattrak: false,
      is_souvenir: false,
    });
  };

  const removeItem = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const submitCase = async (e) => {
    e.preventDefault();
    if (!form.items.length) return alert('Добавьте хотя бы один предмет');

    await axios.post('/api/admin/cases', {
      name: form.name,
      image: form.image || null,
      price: Number(form.price),
      items: form.items.map(it => ({
        name: it.name || undefined,
        image: it.image || undefined,
        chance: Number(it.chance) || 0,
        english_name: it.english_name,
        wear: it.wear,
        is_stattrak: !!it.is_stattrak,
        is_souvenir: !!it.is_souvenir,
      })),
    }, { withCredentials: true });

    alert('✅ Кейс создан. Цены предметов подтянуты со Steam.');
    setForm({ name: '', image: '', price: '', items: [] });
  };

  return (
    <div className="add-case-container">
      <h2>Создать кейс</h2>
      <form onSubmit={submitCase}>
        <input name="name"  placeholder="Название кейса"         value={form.name}  onChange={onForm} required />
        <input name="image" placeholder="URL изображения кейса"  value={form.image} onChange={onForm} />
        <input name="price" type="number" placeholder="Цена открытия кейса" value={form.price} onChange={onForm} required />

        <h3>Предметы</h3>
        <div className="item-form">
          <input name="name"  placeholder="Отображаемое имя (опц.)" value={newItem.name}  onChange={onItem} />
          <input name="image" placeholder="URL картинки (опц.)"     value={newItem.image} onChange={onItem} />

          <input name="english_name" placeholder='English name (например "Desert Eagle | Hypnotic")' value={newItem.english_name} onChange={onItem} required />
          <select name="wear" value={newItem.wear} onChange={onItem} required>
            <option value="">Выберите wear</option>
            {WEARS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>

          <label className="chk"><input type="checkbox" name="is_stattrak" checked={newItem.is_stattrak} onChange={onItem} /> StatTrak™</label>
          <label className="chk"><input type="checkbox" name="is_souvenir" checked={newItem.is_souvenir} onChange={onItem} /> Souvenir</label>

          <input name="chance" type="number" placeholder="Шанс (%)" value={newItem.chance} onChange={onItem} />

          <button type="button" onClick={addItem}>Добавить предмет</button>
        </div>

        <ul className="item-list">
          {form.items.map((it, idx) => (
            <li key={idx}>
              {(it.name || `${it.english_name} (${it.wear})${it.is_stattrak ? ' [ST]' : ''}${it.is_souvenir ? ' [SV]' : ''}`)}
              — {it.chance || 0}% 
              <button type="button" onClick={() => removeItem(idx)}>×</button>
            </li>
          ))}
        </ul>

        <div className="actions">
          <button type="submit">Создать кейс</button>
        </div>
      </form>
    </div>
  );
}
