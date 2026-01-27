// frontend/src/pages/MarketplaceSegmentPage.tsx
// Marketplace Segment Page - Lista empresas de um segmento
// Rota: /marketplace/:domain/:segment

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MarketplaceHeader from '../components/marketplace/MarketplaceHeader';
import Breadcrumb from '../components/marketplace/Breadcrumb';
import { getRootCategories, type MarketplaceDomain, type MarketplaceCategory } from '../api/marketplace-categories';
import './MarketplaceSegmentPage.css';

const DOMAIN_NAMES: Record<MarketplaceDomain, string> = {
  market: 'Mercado & Shop',
  services: 'Serviços',
  events: 'Eventos',
  real_estate: 'Imóveis',
  vehicles: 'Veículos',
  jobs: 'Empregos',
};

const DOMAIN_MAP: Record<string, MarketplaceDomain> = {
  'market': 'market',
  'services': 'services',
  'events': 'events',
  'real-estate': 'real_estate',
  'vehicles': 'vehicles',
  'jobs': 'jobs',
};

interface Store {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  rating?: number;
  segmentId: string;
}

export default function MarketplaceSegmentPage() {
  const { domain: domainParam, segment: segmentSlug } = useParams<{ domain: string; segment: string }>();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<MarketplaceCategory | null>(null);

  const domain: MarketplaceDomain = domainParam && DOMAIN_MAP[domainParam] 
    ? DOMAIN_MAP[domainParam] 
    : 'market';

  useEffect(() => {
    const loadSegmentAndStores = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Carregar segments para encontrar o segment atual
        const segments = await getRootCategories({ domain });
        const foundSegment = segments.find(s => s.slug === segmentSlug);
        
        if (foundSegment) {
          setSegment(foundSegment);
        } else {
          setError('Segmento não encontrado');
        }

        // TODO: Implementar API para buscar empresas por segmento
        // Por enquanto, mock data
        await new Promise(resolve => setTimeout(resolve, 500));
        setStores([]);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados');
        console.error('Erro ao carregar dados:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (segmentSlug && domain) {
      loadSegmentAndStores();
    }
  }, [segmentSlug, domain]);

  if (isLoading) {
    return (
      <div className="marketplace-segment-page">
        <MarketplaceHeader selectedDomain={domain} />
        <div className="marketplace-content">
          <div className="page-loading">Carregando empresas...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-segment-page">
        <MarketplaceHeader selectedDomain={domain} />
        <div className="marketplace-content">
          <div className="page-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-segment-page">
      <MarketplaceHeader selectedDomain={domain} />
      
      <div className="marketplace-content">
        <Breadcrumb
          items={[
            { label: 'Marketplace', path: '/marketplace' },
            { label: DOMAIN_NAMES[domain], path: `/marketplace/${domainParam}` },
            { label: segment?.name || segmentSlug || 'Segmento', path: `/marketplace/${domainParam}/${segmentSlug}` },
          ]}
        />
        
        <div className="segment-header">
          <h1 className="segment-title">{segment?.name || segmentSlug || 'Segmento'}</h1>
          <p className="segment-description">
            {segment?.description || 'Escolha uma empresa para ver produtos e serviços disponíveis'}
          </p>
        </div>

        {stores.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma empresa encontrada neste segmento.</p>
          </div>
        ) : (
          <div className="stores-grid">
            {stores.map((store) => (
              <div
                key={store.id}
                className="store-card"
                onClick={() => navigate(`/store/${store.id}`)}
              >
                {store.logo && (
                  <div className="store-logo">
                    <img src={store.logo} alt={store.name} />
                  </div>
                )}
                <div className="store-content">
                  <h3 className="store-name">{store.name}</h3>
                  {store.description && (
                    <p className="store-description">{store.description}</p>
                  )}
                  {store.rating && (
                    <div className="store-rating">
                      ⭐ {store.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

