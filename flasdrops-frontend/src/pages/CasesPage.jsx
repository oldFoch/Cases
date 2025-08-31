// flashdrops-frontend/src/pages/CasesPage.jsx
import React from 'react';

import NewsSlider  from '../components/NewsSlider/NewsSlider.jsx';
import PromoBanner from '../components/PromoBanner/PromoBanner.jsx';
import CaseGrid    from '../components/CaseGrid/CaseGrid.jsx';
import Footer      from '../components/Footer/Footer.jsx';

export default function CasesPage() {
  return (
    <>
      <NewsSlider />
      <PromoBanner />
      <CaseGrid />
      <Footer />
    </>
  );
}
