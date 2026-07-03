// frontend/src/components/company/DomainSelector.tsx
// Seletor de domínios para onboarding de empresa

import { type MarketplaceDomain } from '../../api/companies';
import './DomainSelector.css';

interface DomainSelectorProps {
  selectedDomains: MarketplaceDomain[];
  onDomainsChange: (domains: MarketplaceDomain[]) => void;
  required?: boolean;
}

const DOMAINS: Array<{ id: MarketplaceDomain; name: string; icon: string; description: string }> = [
  // NÃO é taxonomia criada no frontend: metadata de APRESENTAÇÃO do enum FIXO MarketplaceDomain
  // (6 domínios raiz = constantes arquiteturais, DECISION-0106). Frontend projeta, não inventa.
  { id: 'market', name: 'Mercado & Shop', icon: '🛒', description: 'Venda de produtos físicos' },
  { id: 'services', name: 'Serviços', icon: '🔧', description: 'Prestação de serviços com agenda' },
  { id: 'events', name: 'Eventos', icon: '🎪', description: 'Shows, ingressos, vida noturna' },
  { id: 'real_estate', name: 'Imóveis', icon: '🏠', description: 'Aluguel e venda de imóveis' },
  { id: 'vehicles', name: 'Veículos', icon: '🚗', description: 'Venda, aluguel e assinatura' },
  { id: 'jobs', name: 'Empregos', icon: '💼', description: 'Oportunidades de trabalho' },
];

export default function DomainSelector({ selectedDomains, onDomainsChange, required = true }: DomainSelectorProps) {
  const toggleDomain = (domain: MarketplaceDomain) => {
    if (selectedDomains.includes(domain)) {
      // Não permitir remover se for o último e for obrigatório
      if (required && selectedDomains.length === 1) {
        return;
      }
      onDomainsChange(selectedDomains.filter((d) => d !== domain));
    } else {
      onDomainsChange([...selectedDomains, domain]);
    }
  };

  return (
    <div className="domain-selector-company">
      <h3 className="domain-selector-title">
        Em quais áreas sua empresa atua?
        {required && <span className="required-asterisk"> *</span>}
      </h3>
      <p className="domain-selector-description">
        Selecione pelo menos um domínio de atuação. Você poderá adicionar mais depois.
      </p>
      <div className="domain-grid-company">
        {DOMAINS.map((domain) => {
          const isSelected = selectedDomains.includes(domain.id);
          return (
            <button
              key={domain.id}
              type="button"
              className={`domain-tile-company ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleDomain(domain.id)}
            >
              <div className="domain-checkbox">
                {isSelected && <span className="checkmark">✓</span>}
              </div>
              <span className="domain-icon-company">{domain.icon}</span>
              <div className="domain-content-company">
                <h4 className="domain-name-company">{domain.name}</h4>
                <p className="domain-description-company">{domain.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      {required && selectedDomains.length === 0 && (
        <p className="domain-error">Selecione pelo menos um domínio</p>
      )}
    </div>
  );
}



