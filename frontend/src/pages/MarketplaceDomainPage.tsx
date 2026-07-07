// frontend/src/pages/MarketplaceDomainPage.tsx
// Marketplace Domain Page - Página de domínio específico
// 🔴 REGRA: Carrega APENAS segments (category_type='segment')
// Exibe segmentos como: Supermercados, Farmácias, Moda, etc.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UnifiedAuthLayout from '../components/layout/UnifiedAuthLayout';
import Breadcrumb from '../components/marketplace/Breadcrumb';
import { getRootCategories, type MarketplaceCategory, type MarketplaceDomain } from '../api/marketplace-categories';
import './MarketplaceDomainPage.css';

const DOMAIN_MAP: Record<string, MarketplaceDomain> = {
  'market': 'market',
  'services': 'services',
  'events': 'events',
  'real-estate': 'real_estate',
  'vehicles': 'vehicles',
  'jobs': 'jobs',
};

const DOMAIN_NAMES: Record<MarketplaceDomain, string> = {
  market: 'Mercado & Shop',
  services: 'Serviços',
  events: 'Eventos',
  real_estate: 'Imóveis',
  vehicles: 'Veículos',
  jobs: 'Empregos',
};

export default function MarketplaceDomainPage() {
  const { domain: domainParam } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const [segments, setSegments] = useState<MarketplaceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mapear parâmetro da rota para domínio canônico
  const domain: MarketplaceDomain = domainParam && DOMAIN_MAP[domainParam] 
    ? DOMAIN_MAP[domainParam] 
    : 'market'; // Default: market para compatibilidade
  
  const domainPath = domain === 'real_estate' ? 'real-estate' : domain;

  useEffect(() => {
    const loadSegments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 🔴 REGRA: getRootCategories retorna APENAS segments (category_type='segment')
        // 🔴 VALIDAÇÃO: Garantir que não há offer_categories
        const rootSegments = await getRootCategories({ domain });
        
        // Validação adicional no frontend
        const validSegments = rootSegments.filter(
          (s) => s.metadata?.category_type === 'segment'
        );
        
        if (validSegments.length !== rootSegments.length) {
          console.warn('[MarketplaceDomainPage] ⚠️ AVISO: Algumas categorias não são segments - removendo');
        }
        
        setSegments(validSegments);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar segmentos');
        console.error('Erro ao carregar segmentos:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSegments();
  }, [domain]);

  if (isLoading) {
    return (
      <UnifiedAuthLayout><div className="marketplace-domain-page">
        
        <div className="marketplace-content">
          <div className="page-loading">Carregando segmentos...</div>
        </div>
      </div></UnifiedAuthLayout>
    );
  }

  if (error) {
    return (
      <UnifiedAuthLayout><div className="marketplace-domain-page">
        
        <div className="marketplace-content">
          <div className="page-error">{error}</div>
        </div>
      </div></UnifiedAuthLayout>
    );
  }

  return (
    <UnifiedAuthLayout><div className="marketplace-domain-page">
      
      
      <div className="marketplace-content">
        <Breadcrumb
          items={[
            { label: 'Marketplace', path: '/marketplace' },
            { label: DOMAIN_NAMES[domain], path: `/marketplace/${domainPath}` },
          ]}
        />
        
        <div className="domain-header">
          <h1 className="domain-title">{DOMAIN_NAMES[domain]}</h1>
          <p className="domain-description">
            Escolha um segmento para ver empresas disponíveis
          </p>
        </div>

        {segments.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum segmento cadastrado para este domínio.</p>
            <p className="empty-state-hint">Entre em contato com o suporte para cadastrar segmentos.</p>
          </div>
        ) : (
          <div className="segments-section">
            <h2 className="section-title">Segmentos</h2>
            <div className="segments-grid">
              {segments.map((segment) => (
                <div
                  key={segment.id}
                  className="segment-card"
                  onClick={() => {
                    // Navegar para página do segmento (listará empresas)
                    navigate(`/marketplace/${domainPath}/${segment.slug}`);
                  }}
                >
                  <div className="segment-icon">
                    {segment.icon ? (
                      <span className="icon-emoji">{segment.icon}</span>
                    ) : (
                      <span className="icon-placeholder">🏪</span>
                    )}
                  </div>
                  <div className="segment-content">
                    <h3 className="segment-name">{segment.name}</h3>
                    {segment.description && (
                      <p className="segment-description">{segment.description}</p>
                    )}
                  </div>
                  <div className="segment-action">
                    <span className="explore-link">Explorar →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div></UnifiedAuthLayout>
  );
}

