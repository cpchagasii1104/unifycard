// frontend/src/pages/MarketplaceHomePage.tsx
// Hub do Marketplace DENTRO do shell padrão (pedido Clayton 2026-07-07: "a estrutura
// tem que seguir o padrão que já estabelecemos" — nada de casca paralela/header próprio).
// Cards = PROJEÇÃO: domínios governados (MarketplaceDomain) + verticais do registry
// (Locações/Oportunidades LIVE · comida/carro STUB honesto — mesmo status do menu).

import { useNavigate } from 'react-router-dom';
import UnifiedAuthLayout from '../components/layout/UnifiedAuthLayout';
import DomainSelector from '../components/marketplace/DomainSelector';
import { type MarketplaceDomain } from '../api/marketplace-categories';
import './MarketplaceHomePage.css';

export default function MarketplaceHomePage() {
  const navigate = useNavigate();

  const handleDomainChange = (domain: MarketplaceDomain) => {
    const domainPath = domain === 'real_estate' ? 'real-estate' : domain;
    navigate(`/marketplace/${domainPath}`);
  };

  return (
    <UnifiedAuthLayout>
      <div className="marketplace-hub">
        <h1>🛒 Fazer compras</h1>
        <p className="marketplace-hub-sub">Escolha o que você procura — tudo dentro do UnifiCard.</p>

        <DomainSelector onDomainChange={handleDomainChange} />

        <h2 className="marketplace-hub-more">Também no UnifiCard</h2>
        <div className="marketplace-hub-grid">
          <button type="button" className="marketplace-hub-card" onClick={() => navigate('/locacoes')}>
            <span className="marketplace-hub-icon">🔑</span>
            <strong>Locações</strong>
            <span>Equipamentos, recursos e espaços</span>
          </button>
          <button type="button" className="marketplace-hub-card" onClick={() => navigate('/oportunidades')}>
            <span className="marketplace-hub-icon">🎯</span>
            <strong>Oportunidades</strong>
            <span>Contrate ou trabalhe — o motor de demanda</span>
          </button>
          <button type="button" className="marketplace-hub-card marketplace-hub-card--stub" onClick={() => navigate('/em-desenvolvimento?feature=food')}>
            <span className="marketplace-hub-icon">🍕</span>
            <strong>Pedir comida</strong>
            <span>Em breve</span>
          </button>
          <button type="button" className="marketplace-hub-card marketplace-hub-card--stub" onClick={() => navigate('/em-desenvolvimento?feature=mobility')}>
            <span className="marketplace-hub-icon">🚗</span>
            <strong>Pedir um carro</strong>
            <span>Em breve</span>
          </button>
        </div>
      </div>
    </UnifiedAuthLayout>
  );
}
