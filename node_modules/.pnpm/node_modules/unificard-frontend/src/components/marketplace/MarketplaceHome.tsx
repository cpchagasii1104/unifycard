// src/components/marketplace/MarketplaceHome.tsx
// Vitrine/Home do Marketplace - Exibição das seções estáticas

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getHome, getStores, getStoresNear, getEconomicFeed, getLatestRegionalImpact, getRegionalActivationHistory, getAvailableIncentives, type MarketplaceHome, type MarketplaceStore, type NearStore, type EconomicEvent, type RegionalImpactMetrics, type ActivationEvent, type AvailableIncentive } from '../../api/marketplace';
import { getRootCategories, type MarketplaceCategory } from '../../api/marketplace-categories';
import { checkBackendHealth } from '../../api/health';
import { useRetryWithBackoff } from '../../hooks/useRetryWithBackoff';
import { useSession } from '../../contexts/SessionProvider';
import './MarketplaceHome.css';

export default function MarketplaceHome() {
  const navigate = useNavigate();
  const { activeActor } = useSession();
  const [home, setHome] = useState<MarketplaceHome | null>(null);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | null>(null);
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [nearStores, setNearStores] = useState<NearStore[]>([]);
  const [showNearStores, setShowNearStores] = useState(false);
  const [userCity, setUserCity] = useState<string>('Curitiba'); // TODO: Obter do contexto do usuário
  const [selectedCategoryForNear, setSelectedCategoryForNear] = useState<string | null>(null);
  const [selectedTemplateForNear, setSelectedTemplateForNear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [isLoadingNearStores, setIsLoadingNearStores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [nearStoresError, setNearStoresError] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [impactMetrics, setImpactMetrics] = useState<RegionalImpactMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [activationHistory, setActivationHistory] = useState<ActivationEvent[]>([]);
  const [isLoadingActivations, setIsLoadingActivations] = useState(false);
  const [availableIncentives, setAvailableIncentives] = useState<AvailableIncentive[]>([]);
  const [isLoadingIncentives, setIsLoadingIncentives] = useState(false);

  useEffect(() => {
    loadData();

    if (activeActor) {
      loadEconomicFeed();
      loadImpactMetrics();
      loadActivationHistory();
      loadAvailableIncentives();
    }
  }, [activeActor]);

  const loadAvailableIncentives = async () => {
    try {
      setIsLoadingIncentives(true);
      // TODO: Obter actor_id do contexto do usuário
      const incentives = await getAvailableIncentives('user-001', {
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
      });
      setAvailableIncentives(incentives.incentives);
    } catch (err: any) {
      // Não mostrar erro - incentivos são opcionais
      if (err.status !== 404) {
        console.error('Erro ao carregar incentivos disponíveis:', err);
      }
    } finally {
      setIsLoadingIncentives(false);
    }
  };

  const loadActivationHistory = async () => {
    try {
      setIsLoadingActivations(true);
      const history = await getRegionalActivationHistory({
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
      });
      setActivationHistory(history.activations);
    } catch (err: any) {
      // Não mostrar erro - ativações são opcionais
      if (err.status !== 404) {
        console.error('Erro ao carregar histórico de ativações:', err);
      }
    } finally {
      setIsLoadingActivations(false);
    }
  };

  const loadImpactMetrics = async () => {
    try {
      setIsLoadingMetrics(true);
      // Usar região padrão (Curitiba, PR) - pode ser melhorado com geolocalização
      const metrics = await getLatestRegionalImpact({
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
      });
      setImpactMetrics(metrics);
    } catch (err: any) {
      // Não mostrar erro - métricas são opcionais
      if (err.status !== 404) {
        console.error('Erro ao carregar métricas de impacto:', err);
      }
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const loadEconomicFeed = async () => {
    try {
      setIsLoadingEvents(true);
      // Usar região padrão (Curitiba, PR) - pode ser melhorado com geolocalização
      const feed = await getEconomicFeed({
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
        visibility: 'public',
        limit: 20,
      });
      setEconomicEvents(feed.events);
    } catch (err: any) {
      console.error('Erro ao carregar feed econômico:', err);
      // Não mostrar erro - feed é opcional
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setBackendOffline(false);
      
      // Verificar se backend está online primeiro (usar /health de verdade)
      const health = await checkBackendHealth();
      if (!health) {
        setBackendOffline(true);
        setError('Aguardando conexão com o servidor...');
        setIsLoading(false);
        return;
      }
      
      // Verificar se módulo marketplace está ok
      if (health.modules?.marketplace !== 'ok') {
        setBackendOffline(false);
        setError('Módulo Marketplace temporariamente indisponível. Tente novamente em alguns instantes.');
        setIsLoading(false);
        return;
      }
      
      // Backend online e marketplace ok - carregar dados
      // Carregar home e categorias em paralelo
      const [homeData, categoriesData] = await Promise.all([
        getHome(),
        getRootCategories(),
      ]);
      
      setHome(homeData);
      // getRootCategories() já retorna um array diretamente
      setCategories(categoriesData);
      setBackendOffline(false);
    } catch (err: any) {
      // Diferenciar backend offline de erro real
      if (err.code === 'BACKEND_OFFLINE' || err.isRetryable) {
        setBackendOffline(true);
        setError('Aguardando conexão com o servidor...');
      } else {
        setBackendOffline(false);
        setError(err.message || 'Erro ao carregar vitrine');
        // Não logar stack trace em loop - apenas uma vez
        if (!error) {
          console.error('[MARKETPLACE][API] Erro ao carregar home:', err.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="marketplace-home">
        <div className="marketplace-home-loading">
          <p>Carregando vitrine...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-home">
        <div className="marketplace-home-error">
          <p>{error}</p>
          {backendOffline ? (
            <p className="marketplace-home-offline-hint">
              O servidor está temporariamente indisponível. Tentando reconectar automaticamente...
            </p>
          ) : (
            <button onClick={loadData}>Tentar novamente</button>
          )}
        </div>
      </div>
    );
  }

  if (!home) {
    return null;
  }

  const handleCategoryClick = async (category: MarketplaceCategory) => {
    // 🔴 MARKETPLACE PÚBLICO: Navegação de categorias é pública
    // Apenas ações transacionais (carregar lojas) exigem activeActor
    setSelectedCategory(category);
    
    // Carregar lojas quando categoria for selecionada (requer activeActor)
    if (!activeActor) {
      setStoresError('Selecione um perfil ou empresa para visualizar lojas');
      setStores([]);
      return;
    }
    
    try {
      setIsLoadingStores(true);
      setStoresError(null);
      
      // Escopo padrão: city = Curitiba (hardcoded, explícito)
      const storesData = await getStores({
        scope: 'city',
        value: 'Curitiba',
      });
      
      setStores(storesData.stores);
    } catch (err: any) {
      setStoresError(err.message || 'Erro ao carregar lojas');
      console.error('Erro ao carregar lojas:', err);
      setStores([]);
    } finally {
      setIsLoadingStores(false);
    }
  };

  const handleNearMeClick = async () => {
    setShowNearStores(true);
    setIsLoadingNearStores(true);
    setNearStoresError(null);
    
    try {
      const nearStoresData = await getStoresNear({
        city: userCity,
        category_id: selectedCategoryForNear || undefined,
        template_id: selectedTemplateForNear || undefined,
      });
      
      setNearStores(nearStoresData.stores);
    } catch (err: any) {
      setNearStoresError(err.message || 'Erro ao carregar lojas próximas');
      console.error('Erro ao carregar lojas próximas:', err);
    } finally {
      setIsLoadingNearStores(false);
    }
  };

  return (
    <div className="marketplace-home">
      <div className="provider-link-section" style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <Link to="/provider" style={{ color: '#007bff', textDecoration: 'none', fontWeight: 'bold' }}>
          👤 Sou Prestador
        </Link>
      </div>
      <div className="marketplace-home-header">
        <h1>Mercado & Shop</h1>
        <p className="marketplace-home-subtitle">Explore nossas categorias</p>
        <button
          className="marketplace-home-near-me-button"
          onClick={handleNearMeClick}
          type="button"
        >
          🟢 Empresas perto de mim
        </button>
        {selectedCategory && (
          <p className="marketplace-home-active-category">
            Categoria: {selectedCategory.name}
          </p>
        )}
      </div>

      {/* Lista de Categorias */}
      <div className="marketplace-home-categories">
        <h2>Categorias</h2>
        {categories.length > 0 ? (
          <div className="marketplace-home-categories-grid">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`marketplace-home-category-item ${
                  selectedCategory?.id === category.id ? 'active' : ''
                }`}
                onClick={() => handleCategoryClick(category)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="marketplace-home-categories-empty">
            <p>Nenhuma categoria disponível no momento.</p>
          </div>
        )}
      </div>

      {/* Lista de Lojas */}
      {selectedCategory && (
        <div className="marketplace-home-stores">
          <h2>Lojas</h2>
          
          {isLoadingStores && (
            <div className="marketplace-home-stores-loading">
              <p>Carregando lojas...</p>
            </div>
          )}
          
          {storesError && (
            <div className="marketplace-home-stores-error">
              <p>Erro ao carregar lojas: {storesError}</p>
            </div>
          )}
          
          {!isLoadingStores && !storesError && stores.length === 0 && (
            <div className="marketplace-home-stores-empty">
              <p>Nenhuma loja encontrada.</p>
            </div>
          )}
          
          {!isLoadingStores && !storesError && stores.length > 0 && (
            <div className="marketplace-home-stores-list">
              {stores.map((store) => (
                <div 
                  key={store.store_id} 
                  className="marketplace-home-store"
                  onClick={() => navigate(`/marketplace/store/${store.store_id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="marketplace-home-store-header">
                    <h3>{store.name}</h3>
                    <span className="marketplace-home-store-template">{store.template_id}</span>
                  </div>
                  
                  {store.branches.length > 0 && (
                    <div className="marketplace-home-store-branches">
                    {store.branches.map((branch) => (
                      <div key={branch.branch_id} className="marketplace-home-branch">
                        <div className="marketplace-home-branch-info">
                          <p className="marketplace-home-branch-name">{branch.name}</p>
                          <p className="marketplace-home-branch-city">{branch.city}</p>
                          {branch.neighborhood && (
                            <p className="marketplace-home-branch-neighborhood">{branch.neighborhood}</p>
                          )}
                        </div>
                        <div className="marketplace-home-branch-indicators">
                          {branch.pickup && (
                            <span className="marketplace-home-indicator pickup">Retirada</span>
                          )}
                          {branch.delivery && (
                            <span className="marketplace-home-indicator delivery">Entrega</span>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seções da Vitrine */}
      <div className="marketplace-home-sections">
        {home.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <div key={section.id} className="marketplace-home-section">
              <div className="marketplace-home-section-header">
                <h2>{section.title}</h2>
                <span className="marketplace-home-section-type">{section.type}</span>
              </div>
              <div className="marketplace-home-section-content">
                <p>Em breve você poderá explorar produtos desta categoria.</p>
              </div>
            </div>
          ))}
      </div>

      {/* Feed Econômico */}
      <div className="marketplace-home-economic-feed">
        <h2>O que está acontecendo na sua região</h2>
        
        {isLoadingEvents ? (
          <div className="marketplace-home-feed-loading">
            <p>Carregando eventos...</p>
          </div>
        ) : economicEvents.length === 0 ? (
          <div className="marketplace-home-feed-empty">
            <p>Nenhum evento econômico recente na região.</p>
          </div>
        ) : (
          <div className="marketplace-home-feed-list">
            {economicEvents.map((event) => (
              <div key={event.event_id} className="marketplace-home-feed-item">
                <div className="marketplace-home-feed-icon">
                  {event.type === 'order_completed' && '💰'}
                  {event.type === 'service_booked' && '📅'}
                  {event.type === 'subscription_started' && '🔄'}
                  {event.type === 'regional_fund_credit' && '🏦'}
                  {event.type === 'regional_fund_allocation' && '🤝'}
                  {event.type === 'new_store_opened' && '🏪'}
                  {event.type === 'industry_product_activated' && '🏭'}
                  {!['order_completed', 'service_booked', 'subscription_started', 'regional_fund_credit', 'regional_fund_allocation', 'new_store_opened', 'industry_product_activated'].includes(event.type) && '📊'}
                </div>
                <div className="marketplace-home-feed-content">
                  <p className="marketplace-home-feed-text">{event.display_text}</p>
                  {event.amount && (
                    <span className="marketplace-home-feed-amount">
                      {event.currency} {event.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benefícios Disponíveis */}
      {availableIncentives.length > 0 && (
        <div className="marketplace-home-incentives">
          <h2>Benefícios disponíveis na sua região</h2>
          
          {isLoadingIncentives ? (
            <div className="marketplace-home-incentives-loading">
              <p>Carregando benefícios...</p>
            </div>
          ) : (
            <div className="marketplace-home-incentives-list">
              {availableIncentives.map((incentive) => {
                let incentiveLabel = '';
                switch (incentive.incentive_type) {
                  case 'delivery':
                    incentiveLabel = 'Subsídio de Frete';
                    break;
                  case 'onboarding':
                    incentiveLabel = 'Auxílio de Onboarding';
                    break;
                  case 'service':
                    incentiveLabel = 'Incentivo de Serviço';
                    break;
                  case 'logistics':
                    incentiveLabel = 'Apoio Logístico';
                    break;
                }

                return (
                  <div key={incentive.rule_id} className="marketplace-home-incentive-item">
                    <div className="marketplace-home-incentive-header">
                      <h3>{incentiveLabel}</h3>
                      <span className="marketplace-home-incentive-trust">
                        Trust {incentive.requires_trust_level}+
                      </span>
                    </div>
                    <div className="marketplace-home-incentive-details">
                      <p>
                        <strong>Valor disponível:</strong> BRL {incentive.available_amount.toFixed(2)}
                      </p>
                      <p>
                        <strong>Limite por ator:</strong> BRL {incentive.max_per_actor.toFixed(2)}
                      </p>
                      <p>
                        <strong>Valor máximo:</strong> BRL {incentive.max_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

