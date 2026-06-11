// src/pages/MarketplacePage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Listing Page
// Listagem homogênea de entidades do marketplace

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MarketplaceHome from '../components/marketplace/MarketplaceHome';
import MarketplaceCatalog from '../components/marketplace/MarketplaceCatalog';
import MarketplaceProducts from '../components/marketplace/MarketplaceProducts';
import './MarketplacePage.css';

// F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL (DEC-A/D2): a aba pública
// "Estoque" foi REMOVIDA — estoque é ACTOR_PRIVATE (DECISION-0116), não pertence à
// vitrine pública (montava MarketplaceInventory sem actor → leitura tenant-wide). O
// estoque vive no painel da empresa (CompanyInventoryTab, com page-actor) ou por actor.
type TabType = 'home' | 'catalog' | 'products';

export default function MarketplacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Detectar tab a partir da URL query string. Links legados `?tab=inventory` caem na
  // aba pública válida padrão (home) — NÃO montam estoque, NÃO disparam request.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['home', 'catalog', 'products'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [location.search]);

  return (
    <div className="marketplace-page">
      <div className="marketplace-header">
        <h1>Mercado & Shop</h1>
        <div className="marketplace-tabs">
          <button
            className={activeTab === 'home' ? 'active' : ''}
            onClick={() => setActiveTab('home')}
          >
            Vitrine
          </button>
          <button
            className={activeTab === 'catalog' ? 'active' : ''}
            onClick={() => setActiveTab('catalog')}
          >
            Catálogo
          </button>
          <button
            className={activeTab === 'products' ? 'active' : ''}
            onClick={() => setActiveTab('products')}
          >
            Produtos
          </button>
        </div>
        {/* 🔴 ENTITY LISTING PAGE: CTAs explícitos para gestão (navegação apenas) */}
        <div className="marketplace-header-actions">
          <button
            className="marketplace-action-button"
            onClick={() => navigate('/my-orders')}
          >
            Meus Pedidos
          </button>
        </div>
      </div>

      <div className="marketplace-content">
        {activeTab === 'home' && <MarketplaceHome />}
        {activeTab === 'catalog' && <MarketplaceCatalog />}
        {activeTab === 'products' && <MarketplaceProducts />}
      </div>
    </div>
  );
}

