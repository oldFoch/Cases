import Header from '../components/Header/Header'
import NewsSlider from '../components/NewsSlider/NewsSlider'
import CaseGrid from '../components/CaseGrid/CaseGrid'
import Footer from '../components/Footer/Footer'

export default function Home() {
  return (
    <div className="app">
      <Header />
      <NewsSlider />
      <CaseGrid />
      <Footer />
    </div>
  )
}