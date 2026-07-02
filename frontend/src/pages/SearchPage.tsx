// src/pages/SearchPage.tsx
// 🔎 F-GLOBAL-SEARCH-DEADEND-REWIRE-SLICE-A: a busca universal ainda NÃO existe. Esta página deixou de
// fingir "busca global em desenvolvimento" (dead-end sem caminho) e passou a ser honesta e útil:
//   • com termo na URL (?q= ou ?term=) → redireciona para a busca REAL de serviços (/discover/services),
//     única busca semanticamente viva (termo→alias→CONCEPT→discovery, resolvido no backend);
//   • sem termo → página honesta com caminho real para a descoberta de serviços.
// Frontend-only, money-free, authority-free. Sem busca federada ainda.

import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import './SearchPage.css';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = (searchParams.get('term') || searchParams.get('q') || '').trim();

  // Com termo: leva direto à busca real de serviços, preservando o termo.
  if (query) {
    return <Navigate to={`/discover/services?term=${encodeURIComponent(query)}`} replace />;
  }

  // Sem termo: página honesta que aponta para o caminho real (não finge busca universal pronta).
  return (
    <div className="search-page">
      <div className="search-page-container">
        <h1 className="search-page-title">Busca</h1>
        <div className="search-empty-state">
          <p>Busca universal em construção; buscando serviços agora.</p>
          <p className="search-hint">
            Você pode descobrir profissionais e serviços disponíveis:
          </p>
          <button
            type="button"
            className="search-go-services"
            onClick={() => navigate('/discover/services')}
          >
            🔧 Buscar serviços
          </button>
        </div>
      </div>
    </div>
  );
}
