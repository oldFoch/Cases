// flashdrops-frontend/src/App.jsx

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import NewsSlider from './components/NewsSlider/NewsSlider';
import CaseGrid from './components/CaseGrid/CaseGrid';
import Footer from './components/Footer/Footer';
import Profile from './components/Profile/Profile';
import PromoBanner from './components/PromoBanner/PromoBanner';
import AddCase from './components/Admin/AddCase';  // ← импорт了 ваш AddCase
import CaseDetails from './components/CaseDetails/CaseDetails';

export default function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <NewsSlider />
              <PromoBanner />
              <CaseGrid />
              <Footer />
            </>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AddCase />} />        {/* ← добавлен маршрут админки */}
        <Route path="/admin/add-case" element={<AddCase />} />{/* или так, если нужен более детальный путь */}
        <Route path="/cases/:id" element={<CaseDetails />} />
      </Routes>
    </Router>
  );
}
