// flashdrops-frontend/src/layout/LayoutWithSideMenu.jsx
import React from "react";
import Header from "../components/Header/Header.jsx";
import CaseTicker from "../components/CaseTicker/CaseTicker.jsx";
import SideMenu from "../components/SideMenu/SideMenu.jsx";

export default function LayoutWithSideMenu({ children }) {
  return (
    <>
      <Header />
      <CaseTicker />
      <div className="app-after-ticker" />
      <SideMenu />
      <div className="app-with-left-menu">{children}</div>
    </>
  );
}
