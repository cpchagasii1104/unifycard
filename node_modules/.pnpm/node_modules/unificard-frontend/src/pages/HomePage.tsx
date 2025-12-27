// src/pages/HomePage.tsx
// Página Home - Launcher de aplicativos estilo smartphone com busca
// Usa APPS_REGISTRY como fonte única de verdade

import GlobalContextBar from '../components/home/GlobalContextBar';
import SearchBar from '../components/home/SearchBar';
import AppGrid from '../components/home/AppGrid';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <GlobalContextBar />
      <SearchBar />
      <AppGrid />
    </div>
  );
}

