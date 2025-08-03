import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // Убедитесь, что путь правильный
import './styles/global.css' // Если используете глобальные стили

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)