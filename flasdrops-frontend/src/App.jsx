// flashdrops-frontend/src/App.jsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Header       from './components/Header/Header.jsx';
import CaseTicker   from './components/CaseTicker/CaseTicker.jsx';
import CaseGrid     from './components/CaseGrid/CaseGrid.jsx';
import CaseDetails  from './components/CaseDetails/CaseDetails.jsx';
import Profile      from './components/Profile/Profile.jsx';
import Footer       from './components/Footer/Footer.jsx';
import NewsSlider   from './components/NewsSlider/NewsSlider.jsx';
import PromoBanner  from './components/PromoBanner/PromoBanner.jsx';

export default function App() {
  return (
    <>
      <Header />
      <CaseTicker />
      <Routes>
        <Route path="/" element={
          <>
            <NewsSlider />
            <PromoBanner />
            <CaseGrid />
            <Footer />
          </>
        }/>
        <Route path="/cases/:id" element={<CaseDetails />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </>
  );
}
