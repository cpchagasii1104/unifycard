// frontend/src/components/marketplace/MarketplaceSimpleHeader.tsx
// Header simples para Home do Marketplace (sem categorias)

// frontend/src/components/marketplace/MarketplaceSimpleHeader.tsx
// Header simples para Home do Marketplace (sem categorias)
// 🔴 REGRA: Autenticação via Unificard (não Marketplace próprio)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { isAuthenticated } from '../../config/auth';
import './MarketplaceSimpleHeader.css';

export default function MarketplaceSimpleHeader() {
  const navigate = useNavigate();
  const { activeActor } = useSession();
  const user = isAuthenticated();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      // 🔎 F-GLOBAL-SEARCH-DEADEND-REWIRE-SLICE-A: dead-end antigo (console.log) removido. A busca universal
      // ainda não existe; reaponta para a busca real de serviços (termo→concept→discovery no backend).
      navigate(`/discover/services?term=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <header className="marketplace-simple-header">
      <div className="marketplace-simple-header-container">
        <div className="marketplace-logo" onClick={() => navigate('/marketplace')}>
          <span className="logo-text">UnifiCard</span>
          <span className="logo-marketplace">Marketplace</span>
        </div>

        <form className="marketplace-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="marketplace-search-input"
            placeholder="Buscar serviços..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="marketplace-search-button">
            <span className="search-icon">🔍</span>
          </button>
        </form>

        <div className="marketplace-header-actions">
          {user ? (
            <>
              <button className="header-action-link">
                <span className="action-text">Compras</span>
              </button>
              <button className="header-action-link">
                <span className="action-text">Favoritos</span>
              </button>
              <button className="header-action-icon" title="Notificações">
                🔔
              </button>
              <button className="header-action-icon" title="Carrinho">
                🛒
              </button>
            </>
          ) : (
            <button 
              className="header-action-link"
              onClick={() => navigate('/login')}
            >
              <span className="action-text">Entrar no Unificard</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

