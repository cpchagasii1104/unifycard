// frontend/src/pages/MarketplaceHomePage.tsx
// Marketplace Home - Página inicial do Marketplace
// 🔴 REGRA: NÃO carrega categorias, NÃO renderiza MarketplaceHeader
// Apenas: Header simples, busca global, DomainSelector

import { useNavigate } from 'react-router-dom';
import MarketplaceSimpleHeader from '../components/marketplace/MarketplaceSimpleHeader';
import DomainSelector from '../components/marketplace/DomainSelector';
import { type MarketplaceDomain } from '../api/marketplace-categories';
import './MarketplaceHomePage.css';

export default function MarketplaceHomePage() {
  const navigate = useNavigate();

  const handleDomainChange = (domain: MarketplaceDomain) => {
    // Navegar para página do domínio
    const domainPath = domain === 'real_estate' ? 'real-estate' : domain;
    navigate(`/marketplace/${domainPath}`);
  };

  return (
    <div className="marketplace-home-page">
      <MarketplaceSimpleHeader />
      
      <div className="marketplace-content">
        <div className="marketplace-home-header">
          <h1>Bem-vindo ao Marketplace</h1>
          <p>Escolha o que você procura</p>
        </div>
        
        <DomainSelector 
          onDomainChange={handleDomainChange} 
        />
      </div>
    </div>
  );
}

