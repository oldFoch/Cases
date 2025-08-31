import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './app.css';
import axios from 'axios';

// гарантируем куки и заголовки
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Accept'] = 'application/json';

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <App />
  </HashRouter>
);
