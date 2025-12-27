// src/pages/EmDesenvolvimentoPage.tsx
// Página para aplicativos em desenvolvimento

import { useSearchParams } from 'react-router-dom';
import './EmDesenvolvimentoPage.css';

// Importar nomes de apps do registry
import { getAppById } from '../config/appsRegistry';

const FEATURE_NAMES: Record<string, string> = {
  // Fallback para features não encontradas no registry
  events: 'Eventos',
  services: 'Serviços',
  groups: 'Comunidades',
  votes: 'Votações',
  projects: 'Projetos',
  transparency: 'Transparência',
  'regional-fund': 'Fundo Regional',
  crm: 'CRM',
  erp: 'ERP',
  analytics: 'Analytics',
  accountability: 'Prestação de Contas',
  config: 'Configurações',
  card: 'UnifyCard',
  marketplace: 'Mercado & Shop',
  food: 'Pedir Comida',
  mobility: 'Mobilidade',
  hosting: 'Hospedagem',
  tickets: 'Passagens',
  communities: 'Comunidades',
  orders: 'Pedidos',
};

export default function EmDesenvolvimentoPage() {
  const [searchParams] = useSearchParams();
  const feature = searchParams.get('feature');
  
  // Tentar buscar nome do app no registry primeiro
  let featureName: string | null = null;
  if (feature) {
    const app = getAppById(feature);
    featureName = app ? app.name : (FEATURE_NAMES[feature] || feature);
  }

  return (
    <div className="em-desenvolvimento-page">
      <div className="em-desenvolvimento-content">
        <div className="em-desenvolvimento-icon">🚧</div>
        <h1 className="em-desenvolvimento-title">
          {featureName ? `${featureName} está em desenvolvimento.` : 'Este aplicativo está em desenvolvimento.'}
        </h1>
        <p className="em-desenvolvimento-message">
          Em breve você poderá acessar esta funcionalidade.
        </p>
        {feature && (
          <p className="em-desenvolvimento-feature">
            <small>Feature: {feature}</small>
          </p>
        )}
      </div>
    </div>
  );
}

