// src/App.jsx
import React, { Fragment } from 'react';
import { Routes, Route } from 'react-router-dom';

import LayoutWithSideMenu  from './layout/LayoutWithSideMenu.jsx';

import NewsSlider          from './components/NewsSlider/NewsSlider.jsx';
import PromoBanner         from './components/PromoBanner/PromoBanner.jsx';
import CaseGrid            from './components/CaseGrid/CaseGrid.jsx';
import CaseDetails         from './components/CaseDetails/CaseDetails.jsx';
import Footer              from './components/Footer/Footer.jsx';

import ContractPage        from './components/Contract/ContractPage.jsx';
import DonatePage          from './components/Donate/DonatePage.jsx';
import UpgradeWheelImage   from './components/Upgrade/UpgradeWheelImage.jsx';

import Coinflip            from './components/Casino/Coinflip/Coinflip.jsx';
import Towers              from './components/Casino/Towers/Towers.jsx';
import Mines               from './components/Casino/Mines/Mines.jsx';
import Dice                from './components/Casino/Dice/Dice.jsx';
import Plinko              from './components/Casino/Plinko/Plinko.jsx';
import Wheel               from './components/Casino/Wheel/Wheel.jsx';

import Profile             from './components/Profile/Profile.jsx';

export default function App() {
  return (
    <Fragment>
      <Routes>
        <Route
          path="/"
          element={
            <LayoutWithSideMenu>
              <NewsSlider />
              <PromoBanner />
              <CaseGrid />
              <Footer />
            </LayoutWithSideMenu>
          }
        />

        <Route
          path="/cases/:slug"
          element={
            <LayoutWithSideMenu>
              <CaseDetails />
            </LayoutWithSideMenu>
          }
        />

        {/* Профиль должен идти через общий лэйаут, чтобы шапка не исчезала */}
        <Route
          path="/profile"
          element={
            <LayoutWithSideMenu>
              <Profile />
            </LayoutWithSideMenu>
          }
        />

        <Route
          path="/contract"
          element={
            <LayoutWithSideMenu>
              <ContractPage />
            </LayoutWithSideMenu>
          }
        />

        <Route
          path="/donate"
          element={
            <LayoutWithSideMenu>
              <DonatePage />
            </LayoutWithSideMenu>
          }
        />

        <Route
          path="/upgrade"
          element={
            <LayoutWithSideMenu>
              <UpgradeWheelImage />
            </LayoutWithSideMenu>
          }
        />

  
        <Route
          path="/casino/wheel"
          element={
            <LayoutWithSideMenu>
              <Wheel />
            </LayoutWithSideMenu>
          }
        />
        <Route
          path="/casino/coinflip"
          element={
            <LayoutWithSideMenu>
              <Coinflip />
            </LayoutWithSideMenu>
          }
        />
        <Route
          path="/casino/towers"
          element={
            <LayoutWithSideMenu>
              <Towers />
            </LayoutWithSideMenu>
          }
        />
        <Route
          path="/casino/mines"
          element={
            <LayoutWithSideMenu>
              <Mines />
            </LayoutWithSideMenu>
          }
        />
        <Route
          path="/casino/dice"
          element={
            <LayoutWithSideMenu>
              <Dice />
            </LayoutWithSideMenu>
          }
        />
        <Route
          path="/casino/plinko"
          element={
            <LayoutWithSideMenu>
              <Plinko />
            </LayoutWithSideMenu>
          }
        />

        <Route
          path="*"
          element={
            <LayoutWithSideMenu>
              <NewsSlider />
              <PromoBanner />
              <CaseGrid />
              <Footer />
            </LayoutWithSideMenu>
          }
        />
      </Routes>
    </Fragment>
  );
}
