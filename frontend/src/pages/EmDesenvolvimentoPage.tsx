// src/pages/EmDesenvolvimentoPage.tsx
// Página para aplicativos em desenvolvimento

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import UnifiedAuthLayout from '../components/layout/UnifiedAuthLayout';
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

// Mapeamento de features para rotas reais
const FEATURE_ROUTES: Record<string, string> = {
  card: '/unifycard',
  // Adicionar mais mapeamentos aqui conforme necessário
};

export default function EmDesenvolvimentoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const feature = searchParams.get('feature');
  
  // Redirecionar automaticamente se houver rota mapeada para a feature
  useEffect(() => {
    if (feature && FEATURE_ROUTES[feature]) {
      navigate(FEATURE_ROUTES[feature], { replace: true });
    }
  }, [feature, navigate]);
  
  // Tentar buscar nome do app no registry primeiro
  let featureName: string | null = null;
  if (feature) {
    const app = getAppById(feature);
    featureName = app ? app.name : (FEATURE_NAMES[feature] || feature);
  }

  // Se houver redirecionamento, não renderizar nada (ou mostrar loading)
  if (feature && FEATURE_ROUTES[feature]) {
    return null; // Ou <FullScreenLoading /> se preferir
  }

  return (
    <UnifiedAuthLayout>
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
    </UnifiedAuthLayout>
  );
}

