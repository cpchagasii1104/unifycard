// src/pages/HomePage.tsx
// CONTINUOUS PRODUCTION: Home Contextual - SPRINT 1
// Home state-driven com "Situação Atual" e cards dinâmicos

import HomeContextual from '../components/home/HomeContextual';
import HomeHeaderBlock from '../components/home/HomeHeaderBlock';
import SearchBar from '../components/home/SearchBar';
import AppGrid from '../components/home/AppGrid';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      {/* 2026-05-15: Saudação + saldos no topo absoluto (pedido Clayton). */}
      <HomeHeaderBlock />

      {/* Ação Imediata */}
      <SearchBar />
      <AppGrid />

      {/* Identidade e Estado complementares (transparência, pendências, saúde, cards, workflow) */}
      <HomeContextual />
    </div>
  );
}

