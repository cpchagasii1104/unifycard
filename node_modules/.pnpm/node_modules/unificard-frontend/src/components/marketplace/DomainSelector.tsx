// frontend/src/components/marketplace/DomainSelector.tsx
// Seletor de domínio do Marketplace

import { type MarketplaceDomain } from '../../api/marketplace-categories';
import './DomainSelector.css';

interface DomainSelectorProps {
  selectedDomain?: MarketplaceDomain; // Opcional na home (não há seleção inicial)
  onDomainChange: (domain: MarketplaceDomain) => void;
}

const DOMAINS: Array<{ id: MarketplaceDomain; name: string; icon: string; description: string }> = [
  { id: 'market', name: 'Mercado & Shop', icon: '🛒', description: 'Produtos físicos' },
  { id: 'services', name: 'Serviços', icon: '🔧', description: 'Prestação de serviços' },
  { id: 'events', name: 'Eventos', icon: '🎪', description: 'Shows, ingressos, vida noturna' },
  { id: 'real_estate', name: 'Imóveis', icon: '🏠', description: 'Aluguel e venda' },
  { id: 'vehicles', name: 'Veículos', icon: '🚗', description: 'Venda, aluguel, assinatura' },
  { id: 'jobs', name: 'Empregos', icon: '💼', description: 'Oportunidades de trabalho' },
];

export default function DomainSelector({ selectedDomain, onDomainChange }: DomainSelectorProps) {
  return (
    <div className="domain-selector">
      <div className="domain-grid">
        {DOMAINS.map((domain) => (
          <button
            key={domain.id}
            className={`domain-tile ${selectedDomain === domain.id ? 'active' : ''}`}
            onClick={() => onDomainChange(domain.id)}
          >
            <span className="domain-icon">{domain.icon}</span>
            <div className="domain-content">
              <h3 className="domain-name">{domain.name}</h3>
              <p className="domain-description">{domain.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

