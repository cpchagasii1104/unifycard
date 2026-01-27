// frontend/src/components/marketplace/MarketplaceHeader.tsx
// Header do Marketplace no estilo Mercado Livre

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { isAuthenticated } from '../../config/auth';
import CategoryDropdown from './CategoryDropdown';
import { getRootCategories, type MarketplaceCategory, type MarketplaceDomain } from '../../api/marketplace-categories';
import './MarketplaceHeader.css';

interface MarketplaceHeaderProps {
  selectedDomain?: MarketplaceDomain;
}

export default function MarketplaceHeader({ selectedDomain = 'market' }: MarketplaceHeaderProps) {
  const navigate = useNavigate();
  const { activeActor } = useSession();
  const user = isAuthenticated();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    // 🔴 REGRA: Só carregar SEGMENTOS se houver domínio selecionado (não na home)
    // 🔴 REGRA: NUNCA carregar offer_categories no header
    if (selectedDomain) {
      const loadSegments = async () => {
        try {
          // getRootCategories retorna APENAS segments
          const segments = await getRootCategories({ domain: selectedDomain });
          
          // Validação: garantir que são apenas segments
          const validSegments = segments.filter(
            (s) => s.metadata?.category_type === 'segment'
          );
          
          setCategories(validSegments);
        } catch (err) {
          console.error('Erro ao carregar segmentos para dropdown:', err);
          setCategories([]);
        }
      };
      loadSegments();
    } else {
      setCategories([]);
    }
  }, [selectedDomain]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implementar busca funcional
    }
  };

  const toggleCategoryDropdown = () => {
    setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
  };

  return (
    <header className="marketplace-header">
      <div className="marketplace-header-top">
        <div className="marketplace-header-container">
          <div className="marketplace-logo" onClick={() => navigate('/marketplace')}>
            <span className="logo-text">UnifiCard</span>
            <span className="logo-marketplace">Marketplace</span>
          </div>

          <form className="marketplace-search-form" onSubmit={handleSearch}>
            <input
              type="text"
              className="marketplace-search-input"
              placeholder="Buscar produtos, marcas e muito mais..."
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
      </div>

      {selectedDomain && (
        <>
          <nav className="marketplace-nav">
            <div className="marketplace-nav-container">
              <button 
                className={`nav-link categories-link ${isCategoryDropdownOpen ? 'active' : ''}`}
                onClick={toggleCategoryDropdown}
              >
                <span>Categorias</span>
                <span className="nav-arrow">▼</span>
              </button>
              <button className="nav-link">Ofertas</button>
              <button className="nav-link">Cupons</button>
              <button className="nav-link">Supermercado</button>
              <button className="nav-link">Moda</button>
              <button className="nav-link">Vender</button>
              <button className="nav-link">Contato</button>
            </div>
          </nav>

          <CategoryDropdown
            categories={categories}
            isOpen={isCategoryDropdownOpen}
            onClose={() => setIsCategoryDropdownOpen(false)}
            selectedDomain={selectedDomain}
          />
        </>
      )}
    </header>
  );
}

