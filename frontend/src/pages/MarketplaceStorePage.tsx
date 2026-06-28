// src/pages/MarketplaceStorePage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Detail Page
// Visualização focada em UMA loja (read-only)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// F-MARKETPLACE-CHECKOUT-STUB-CONTRACT-CONTAINMENT-SLICE-A (2026-06-28)
// DT-MARKETPLACE-CHECKOUT-FRONTEND-WIRED-TO-BACKEND-STUBS: a descoberta (getStores/
// getStoreCatalog/getStoreProducts) é leitura VIVA e fica. Carrinho/checkout (createOrder/
// addOrderItem → /marketplace/order*, hoje STUB VAZIO no backend) foram REMOVIDOS daqui:
// não se monta carrinho que liga em rota inexistente. Compra segue em HOLD.
import { getStores, getStoreCatalog, getStoreProducts, type MarketplaceStore, type StoreCatalog, type StoreProduct } from '../api/marketplace';
import { getOfferCategoriesByStore, type MarketplaceCategory } from '../api/marketplace-categories';
import Breadcrumb from '../components/marketplace/Breadcrumb';
import { checkBackendHealth } from '../api/health';
import './MarketplaceStorePage.css';

export default function MarketplaceStorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<MarketplaceStore | null>(null);
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'branches' | 'catalog'>('branches');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);

  useEffect(() => {
    if (storeId) {
      loadStore();
      // 🔴 ENTITY DETAIL PAGE: Carrinho é apenas visual - não inicializa automaticamente
      // Usuário adiciona produtos e navega para checkout explicitamente
    }
  }, [storeId]);

  useEffect(() => {
    if (activeTab === 'catalog' && storeId && !catalog) {
      loadCatalog();
    }
  }, [activeTab, storeId, catalog]);

  const loadStore = async () => {
    if (!storeId) return;

    try {
      setIsLoading(true);
      setError(null);
      setNotFound(false);
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

      // Backend online e marketplace ok - buscar dados
      // Buscar todas as lojas (sem filtro de escopo para encontrar qualquer loja)
      const storesData = await getStores();
      
      // Encontrar a loja pelo store_id
      const foundStore = storesData.stores.find(s => s.store_id === storeId);
      
      if (foundStore) {
        setStore(foundStore);
        setBackendOffline(false);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      // Diferenciar backend offline de erro real
      if (err.code === 'BACKEND_OFFLINE' || err.isRetryable) {
        setBackendOffline(true);
        setError('Aguardando conexão com o servidor...');
      } else {
        setBackendOffline(false);
        setError(err.message || 'Erro ao carregar loja');
        // Não logar stack trace em loop - apenas uma vez
        if (!error) {
          console.error('[MARKETPLACE][API] Erro ao carregar loja:', err.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadCatalog = async () => {
    if (!storeId) return;

    try {
      setIsLoadingCatalog(true);
      setCatalogError(null);

      const catalogData = await getStoreCatalog(storeId);
      setCatalog(catalogData);
    } catch (err: any) {
      setCatalogError(err.message || 'Erro ao carregar catálogo');
      console.error('Erro ao carregar catálogo:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleCategoryClick = async (categoryId: string) => {
    if (!storeId) return;

    // 🔴 REGRA: categoryId deve ser uma offer_category (não segment)
    setSelectedCategoryId(categoryId);
    
    try {
      setIsLoadingProducts(true);
      setProductsError(null);

      const productsData = await getStoreProducts(storeId, { categoryId });
      setProducts(productsData.products);
    } catch (err: any) {
      setProductsError(err.message || 'Erro ao carregar produtos');
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // F-MARKETPLACE-CHECKOUT-STUB-CONTRACT-CONTAINMENT-SLICE-A: carrinho/checkout removidos.
  // O backend de criação de pedido público (/marketplace/order*) é STUB VAZIO; montar
  // carrinho aqui acenderia botão que não liga no motor. Compra em HOLD (DECISION-0114 +
  // PORTA-1). Esta tela permanece descoberta/visualização read-only.

  if (isLoading) {
    return (
      <div className="marketplace-store-page">
        <div className="marketplace-store-loading">
          <p>Carregando loja...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-store-page">
        <div className="marketplace-store-error">
          <p>Erro ao carregar loja: {error}</p>
          <button onClick={loadStore}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="marketplace-store-page">
        <div className="marketplace-store-not-found">
          <h2>Loja não encontrada</h2>
          <p>A loja solicitada não foi encontrada.</p>
          <button onClick={() => navigate('/marketplace')}>Voltar ao Marketplace</button>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-store-page">
      {store && (
        <Breadcrumb
          items={[
            { label: 'Marketplace', path: '/marketplace' },
            { label: store.name || 'Loja', path: `/store/${storeId}` },
          ]}
        />
      )}
      
      <div className="marketplace-store-header">
        <button 
          className="marketplace-store-back-button"
          onClick={() => navigate('/marketplace')}
          type="button"
        >
          ← Voltar
        </button>
        <div className="marketplace-store-header-content">
          <h1>{store.name}</h1>
          <div className="marketplace-store-header-badges">
            <span className="marketplace-store-template">{store.template_id}</span>
            {store.location?.visible_in_locator && (
              <span className="marketplace-store-badge local">🟢 Empresa local</span>
            )}
            {store.branches.some(b => b.pickup) && (
              <span className="marketplace-store-badge pickup">Compra física disponível</span>
            )}
            <span className="marketplace-store-badge invoice">Aceita faturamento (B2B)</span>
          </div>
        </div>
      </div>

      <div className="marketplace-store-tabs">
        <button
          className={`marketplace-store-tab ${activeTab === 'branches' ? 'active' : ''}`}
          onClick={() => setActiveTab('branches')}
          type="button"
        >
          Filiais
        </button>
        <button
          className={`marketplace-store-tab ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
          type="button"
        >
          Catálogo
        </button>
      </div>

      <div className="marketplace-store-content">
        {activeTab === 'branches' && (
          <div className="marketplace-store-branches-section">
            <h2>Filiais</h2>
            
            {store.branches.length === 0 ? (
              <div className="marketplace-store-empty-branches">
                <p>Esta loja não possui filiais cadastradas.</p>
              </div>
            ) : (
              <div className="marketplace-store-branches-list">
                {store.branches.map((branch) => (
                  <div key={branch.branch_id} className="marketplace-store-branch">
                    <div className="marketplace-store-branch-info">
                      <h3>{branch.name}</h3>
                      <p className="marketplace-store-branch-city">{branch.city}</p>
                    </div>
                    <div className="marketplace-store-branch-indicators">
                      {branch.pickup && (
                        <span className="marketplace-store-indicator pickup">Retirada</span>
                      )}
                      {branch.delivery && (
                        <span className="marketplace-store-indicator delivery">Entrega</span>
                      )}
                      {!branch.pickup && !branch.delivery && (
                        <span className="marketplace-store-indicator none">Apenas visualização</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="marketplace-store-catalog-section">
            <h2>Catálogo</h2>
            
            {isLoadingCatalog ? (
              <div className="marketplace-store-catalog-loading">
                <p>Carregando catálogo...</p>
              </div>
            ) : catalogError ? (
              <div className="marketplace-store-catalog-error">
                <p>Erro ao carregar catálogo: {catalogError}</p>
                <button onClick={loadCatalog}>Tentar novamente</button>
              </div>
            ) : (!catalog || catalog.categories.length === 0) ? (
              <div className="marketplace-store-catalog-empty">
                <p>Esta loja não possui categorias cadastradas.</p>
              </div>
            ) : (
              <div className="marketplace-store-catalog-content">
                <div className="marketplace-store-catalog-list">
                  {catalog.categories.map((category) => (
                    <button
                      key={category.id}
                      className={`marketplace-store-catalog-category ${selectedCategoryId === category.id ? 'active' : ''}`}
                      onClick={() => handleCategoryClick(category.id)}
                      type="button"
                    >
                      <h3>{category.name}</h3>
                    </button>
                  ))}
                </div>

                {selectedCategoryId && (
                  <div className="marketplace-store-products-section">
                    <h3>Produtos</h3>
                    {isLoadingProducts ? (
                      <div className="marketplace-store-products-loading">
                        <p>Carregando produtos...</p>
                      </div>
                    ) : productsError ? (
                      <div className="marketplace-store-products-error">
                        <p>Erro ao carregar produtos: {productsError}</p>
                      </div>
                    ) : products.length === 0 ? (
                      <div className="marketplace-store-products-empty">
                        <p>Nenhum produto encontrado nesta categoria.</p>
                      </div>
                    ) : (
                      <div className="marketplace-store-products-list">
                        {products.map((product) => {
                          const isUnavailable = product.stock?.quantity === 0;
                          const hasPrice = product.price !== null;

                          return (
                            <div key={product.product_id} className="marketplace-store-product">
                              <div className="marketplace-store-product-info">
                                <h4>{product.name}</h4>
                                {product.description && (
                                  <p className="marketplace-store-product-description">{product.description}</p>
                                )}
                                {product.price && (
                                  <p className="marketplace-store-product-price">
                                    {product.price.currency} {product.price.amount.toFixed(2)}
                                  </p>
                                )}
                                {product.stock && (
                                  <p className="marketplace-store-product-stock">
                                    Estoque: {product.stock.quantity} {product.stock.unit}
                                  </p>
                                )}
                              </div>
                              <div className="marketplace-store-product-actions">
                                {isUnavailable ? (
                                  <span className="marketplace-store-product-unavailable">Indisponível</span>
                                ) : !hasPrice ? (
                                  <span className="marketplace-store-product-no-price">Sem preço</span>
                                ) : (
                                  /* F-MARKETPLACE-CHECKOUT-STUB-CONTRACT-CONTAINMENT-SLICE-A:
                                     compra em HOLD (backend de pedido = stub). CTA honesto
                                     desabilitado em vez de botão que liga em rota inexistente. */
                                  <button
                                    className="marketplace-store-product-add-button"
                                    disabled
                                    title="A compra de produtos ainda não está habilitada neste MVP."
                                    type="button"
                                  >
                                    Indisponível no MVP atual
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* F-MARKETPLACE-CHECKOUT-STUB-CONTRACT-CONTAINMENT-SLICE-A: resumo de carrinho/CTA
          "Ir para checkout" REMOVIDOS — ligavam em backend stub. Aviso honesto no lugar. */}
      <div className="marketplace-store-purchase-hold">
        <p>
          A compra de produtos ainda não está habilitada neste MVP. O catálogo, a oferta e o
          estoque estão em preparação; pagamento e checkout seguem em HOLD.
        </p>
      </div>
    </div>
  );
}
