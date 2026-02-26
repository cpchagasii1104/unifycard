// backend/src/modules/marketplace/marketplace.service.ts
// Módulo Marketplace - Service Canônico
// Esqueleto mínimo sem lógica de negócio

import { marketplaceLogger } from './marketplace.logger';
import { economicIdentityService } from './economic-identity.service';
import { regionalFundService } from './regional-fund.service';
import { regionalActivationService } from './regional-activation.service';
import { productCatalogService } from './product-catalog.service';
import { storeProductService } from './store-product.service';
import type {
  Order,
  CheckoutIntent,
  PaymentPlan,
  DeliveryOrder,
  ServiceOrder,
  Subscription,
  SubscriptionCycle,
  IndustryAccount,
  DistributionHub,
  SLAContract,
  ReputationSnapshot,
  DisputeCase,
  EconomicIdentity,
  TrustEvent,
  RegionalFund,
  RegionalFundAllocation,
  EconomicEvent,
  RegionalImpactMetrics,
  RegionalActivationRule,
  ActivationEvent,
  IncentiveRule,
  IncentiveGrant,
  B2BCommercialContract,
  B2BContractExecution,
  EconomicSustainabilitySnapshot,
  ProductionBatch,
  BatchCommitment,
  CompanyOnboarding,
  PaymentTerminal,
  CompanyPlan,
  PaymentInfrastructureConfig,
  RevenueSnapshot,
  RevenueSource,
  RegionalFinancialFlow,
  ServiceRequest,
  ServiceDispatch,
  ProviderPresence,
  ServicePreReservation,
  ServicePaymentHold,
  ServiceCompletionSignal,
  ServiceVisit,
  ServiceQuote,
  ServiceGovernanceMetrics,
  BusinessTemplate,
  ActorRole,
  CompanyCollaborator,
  PluginDefinition,
  PluginExecution,
  PluginCategory,
  PluginHook,
  ServiceEvaluation,
  EvaluationAggregate,
  ProductTemplate,
  ProductTemplateType,
  ServiceTemplateCanonical,
  ServiceResource,
  ServiceResourceType,
  ServiceResourceStatus,
  ServiceResourceDependency,
  CompanyCapacityMetrics,
  ResourceCapacityMetrics,
  CapacityEvent,
  CapacitySnapshot,
  CompensationModel,
  ResourceCompensationConfig,
  ResourceCompensation,
  ResourceCompensationHistory,
  CompanyCompensationReport,
  VoucherOffer,
  VoucherType,
  VoucherVisibilityScope,
  VoucherOfferStatus,
  VoucherClaim,
  VoucherClaimStatus,
  VoucherRedemptionEvent,
  VoucherEventType,
  RegionalCapacitySnapshot,
  RegionalCapacityMetric,
  RegionalCapacityStatus,
  BottleneckCause,
  SLARiskLevel,
  RegionalExpansionSignal,
  ExpansionSignalType,
  ExpansionUnlockFeature,
  ExpansionUnlock,
  PricingAssistanceReport,
  BreakEvenAnalysis,
  ServiceMarginAnalysis,
  OperationalCostProfile,
  RealOperationMetrics,
  OperationalRiskLevel,
} from '@contracts/marketplace';
import type { IDispatchStateReader, IProviderOnlineWriter } from './sub-services/dispatch/dispatch.types';
import { MarketplaceDispatchService } from './sub-services/dispatch/dispatch.service';
import { MarketplaceB2BService } from "./sub-services/b2b/marketplace-b2b.service";
import { MarketplaceSubscriptionsService } from "./sub-services/subscriptions/subscriptions.service";

/**
 * Perfil de custo operacional legado (actor + period).
 * Não confundir com OperationalCostProfile do contrato (store-based).
 */
interface LegacyOperationalCostProfile {
  profile_id: string;
  actorId: string;
  actorType: 'store' | 'service_provider';
  period: { year: number; month: number };
  fixed_costs: {
    rent?: number;
    utilities?: number;
    internet?: number;
    salaries?: number;
    taxes?: number;
    other?: number;
  };
  variable_costs: Array<{
    product_id?: string;
    service_id?: string;
    cost_per_unit: number;
    currency: string;
  }>;
  declared_volume_expectation?: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export class MarketplaceService {
  /**
   * Health check do módulo Marketplace
   * Retorna status básico do domínio
   */
  getHealth(): { domain: string; status: string; version: string } {
    return {
      domain: 'marketplace',
      status: 'active',
      version: 'v0',
    };
  }

  /**
   * Vitrine/Home do Marketplace
   * Retorna estrutura estática e cacheável da página inicial
   * Sem lógica de negócio, apenas configuração in-memory
   */
  getHome(): {
    domain: string;
    version: string;
    sections: Array<{
      id: string;
      title: string;
      type: string;
      order: number;
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      sections: [
        {
          id: 'featured',
          title: 'Destaques',
          type: 'featured',
          order: 1,
        },
        {
          id: 'supermarket',
          title: 'Supermercado',
          type: 'supermarket',
          order: 2,
        },
        {
          id: 'pharmacy',
          title: 'Farmácia',
          type: 'pharmacy',
          order: 3,
        },
        {
          id: 'construction',
          title: 'Construção',
          type: 'construction',
          order: 4,
        },
      ],
    };
  }

  /**
   * Templates de Loja do Marketplace
   * Retorna contratos canônicos de templates reutilizáveis
   * Totalmente estático e declarativo, sem lógica de negócio
   */
  getTemplates(): {
    domain: string;
    version: string;
    templates: Array<{
      id: string;
      name: string;
      description: string;
      supports: Array<'unit' | 'weight' | 'fraction' | 'listing'>;
      features: string[];
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      templates: [
        {
          id: 'supermarket',
          name: 'Supermercado',
          description: 'Template para lojas de supermercado com produtos por unidade, peso e fração',
          supports: ['unit', 'weight', 'fraction'],
          features: [
            'inventory_tracking',
            'price_per_unit',
            'price_per_weight',
            'barcode_scanning',
            'expiry_date_tracking',
            'promotions',
          ],
        },
        {
          id: 'pharmacy',
          name: 'Farmácia',
          description: 'Template para farmácias com controle de medicamentos e produtos por unidade',
          supports: ['unit', 'fraction'],
          features: [
            'inventory_tracking',
            'prescription_required',
            'batch_tracking',
            'expiry_date_tracking',
            'regulatory_compliance',
          ],
        },
        {
          id: 'construction',
          name: 'Construção',
          description: 'Template para lojas de materiais de construção com produtos por unidade e peso',
          supports: ['unit', 'weight', 'fraction'],
          features: [
            'inventory_tracking',
            'bulk_pricing',
            'delivery_scheduling',
            'project_management',
          ],
        },
        {
          id: 'general_store',
          name: 'Loja Geral',
          description: 'Template genérico para lojas com produtos diversos por unidade',
          supports: ['unit'],
          features: [
            'inventory_tracking',
            'price_per_unit',
            'promotions',
          ],
        },
        {
          id: 'marketplace_listing',
          name: 'Marketplace Listing',
          description: 'Template para anúncios e listagens sem controle de estoque',
          supports: ['listing'],
          features: [
            'product_listing',
            'image_gallery',
            'contact_information',
          ],
        },
      ],
    };
  }

  /**
   * Categorias de Produto do Marketplace
   * Retorna estrutura hierárquica de categorias para navegação e descoberta
   * Totalmente estático e declarativo, sem lógica de negócio
   * Categorias NÃO decidem comportamento, apenas organização visual
   */
  getCategories(): {
    domain: string;
    version: string;
    categories: Array<{
      id: string;
      name: string;
      templates: string[];
      children?: Array<{
        id: string;
        name: string;
        templates: string[];
      }>;
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      categories: [
        {
          id: 'food-beverages',
          name: 'Alimentos e Bebidas',
          templates: ['supermarket', 'general_store'],
          children: [
            {
              id: 'food-beverages-fresh',
              name: 'Produtos Frescos',
              templates: ['supermarket'],
            },
            {
              id: 'food-beverages-packaged',
              name: 'Produtos Embalados',
              templates: ['supermarket', 'general_store'],
            },
            {
              id: 'food-beverages-beverages',
              name: 'Bebidas',
              templates: ['supermarket', 'general_store'],
            },
            {
              id: 'food-beverages-frozen',
              name: 'Congelados',
              templates: ['supermarket'],
            },
          ],
        },
        {
          id: 'health-beauty',
          name: 'Saúde e Beleza',
          templates: ['pharmacy', 'general_store'],
          children: [
            {
              id: 'health-beauty-medicines',
              name: 'Medicamentos',
              templates: ['pharmacy'],
            },
            {
              id: 'health-beauty-personal-care',
              name: 'Cuidados Pessoais',
              templates: ['pharmacy', 'general_store'],
            },
            {
              id: 'health-beauty-cosmetics',
              name: 'Cosméticos',
              templates: ['pharmacy', 'general_store'],
            },
            {
              id: 'health-beauty-vitamins',
              name: 'Vitaminas e Suplementos',
              templates: ['pharmacy'],
            },
          ],
        },
        {
          id: 'home-construction',
          name: 'Casa e Construção',
          templates: ['construction', 'general_store'],
          children: [
            {
              id: 'home-construction-materials',
              name: 'Materiais de Construção',
              templates: ['construction'],
            },
            {
              id: 'home-construction-tools',
              name: 'Ferramentas',
              templates: ['construction', 'general_store'],
            },
            {
              id: 'home-construction-home-decor',
              name: 'Decoração',
              templates: ['general_store'],
            },
            {
              id: 'home-construction-plumbing',
              name: 'Encanamento',
              templates: ['construction'],
            },
            {
              id: 'home-construction-electrical',
              name: 'Elétrica',
              templates: ['construction'],
            },
          ],
        },
        {
          id: 'electronics',
          name: 'Eletrônicos',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            {
              id: 'electronics-mobile',
              name: 'Celulares e Acessórios',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'electronics-computers',
              name: 'Computadores',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'electronics-audio',
              name: 'Áudio',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'electronics-home-appliances',
              name: 'Eletrodomésticos',
              templates: ['general_store', 'marketplace_listing'],
            },
          ],
        },
        {
          id: 'clothing-accessories',
          name: 'Roupas e Acessórios',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            {
              id: 'clothing-accessories-men',
              name: 'Masculino',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'clothing-accessories-women',
              name: 'Feminino',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'clothing-accessories-kids',
              name: 'Infantil',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'clothing-accessories-shoes',
              name: 'Calçados',
              templates: ['general_store', 'marketplace_listing'],
            },
          ],
        },
        {
          id: 'sports-leisure',
          name: 'Esportes e Lazer',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            {
              id: 'sports-leisure-fitness',
              name: 'Fitness',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'sports-leisure-outdoor',
              name: 'Ar Livre',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'sports-leisure-sports-equipment',
              name: 'Equipamentos Esportivos',
              templates: ['general_store', 'marketplace_listing'],
            },
          ],
        },
        {
          id: 'books-media',
          name: 'Livros e Mídia',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            {
              id: 'books-media-books',
              name: 'Livros',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'books-media-music',
              name: 'Música',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'books-media-movies',
              name: 'Filmes e Séries',
              templates: ['general_store', 'marketplace_listing'],
            },
          ],
        },
        {
          id: 'automotive',
          name: 'Automotivo',
          templates: ['general_store', 'marketplace_listing'],
          children: [
            {
              id: 'automotive-parts',
              name: 'Peças',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'automotive-accessories',
              name: 'Acessórios',
              templates: ['general_store', 'marketplace_listing'],
            },
            {
              id: 'automotive-maintenance',
              name: 'Manutenção',
              templates: ['general_store', 'marketplace_listing'],
            },
          ],
        },
      ],
    };
  }

  /**
   * Lojas e Filiais do Marketplace
   * Retorna estrutura READ-ONLY de lojas e filiais para renderização e navegação
   * Totalmente estático e declarativo, sem lógica de negócio
   * Apenas para visualização, não cria ou modifica dados
   * 
   * @param scope - Escopo regional opcional (ex: 'city', 'state')
   * @param value - Valor do filtro opcional (ex: 'São Paulo')
   */
  getStores(scope?: string, valueCents?: string): {
    domain: string;
    version: string;
    scope_applied?: {
      scope: string;
      valueCents: string;
      filter_field: string;
    };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      location?: {
        country: string;
        state: string;
        city: string;
        neighborhood?: string;
        latitude?: number;
        longitude?: number;
        visible_in_locator: boolean;
      };
      branches: Array<{
        branch_id: string;
        name: string;
        city: string;
        location?: {
          country: string;
          state: string;
          city: string;
          neighborhood?: string;
          latitude?: number;
          longitude?: number;
          visible_in_locator: boolean;
        };
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    // Dados base de lojas e filiais
    const allStores = [
        {
          storeId: 'store-001',
          name: 'Supermercado Central',
          templateId: 'supermarket',
          location: {
            country: 'Brasil',
            state: 'SP',
            city: 'São Paulo',
            visible_in_locator: true,
          },
          branches: [
            {
              branch_id: 'branch-001',
              name: 'Matriz - Centro',
              city: 'São Paulo',
              location: {
                country: 'Brasil',
                state: 'SP',
                city: 'São Paulo',
                neighborhood: 'Centro',
                visible_in_locator: true,
              },
              pickup: true,
              delivery: true,
            },
            {
              branch_id: 'branch-002',
              name: 'Filial - Zona Norte',
              city: 'São Paulo',
              location: {
                country: 'Brasil',
                state: 'SP',
                city: 'São Paulo',
                neighborhood: 'Zona Norte',
                visible_in_locator: true,
              },
              pickup: true,
              delivery: true,
            },
          ],
        },
        {
          storeId: 'store-002',
          name: 'Farmácia Saúde',
          templateId: 'pharmacy',
          location: {
            country: 'Brasil',
            state: 'RJ',
            city: 'Rio de Janeiro',
            visible_in_locator: true,
          },
          branches: [
            {
              branch_id: 'branch-003',
              name: 'Loja Principal',
              city: 'Rio de Janeiro',
              location: {
                country: 'Brasil',
                state: 'RJ',
                city: 'Rio de Janeiro',
                neighborhood: 'Copacabana',
                visible_in_locator: true,
              },
              pickup: true,
              delivery: false,
            },
          ],
        },
        {
          storeId: 'store-003',
          name: 'Materiais Construção Ltda',
          templateId: 'construction',
          location: {
            country: 'Brasil',
            state: 'MG',
            city: 'Belo Horizonte',
            visible_in_locator: true,
          },
          branches: [
            {
              branch_id: 'branch-004',
              name: 'Depósito Central',
              city: 'Belo Horizonte',
              location: {
                country: 'Brasil',
                state: 'MG',
                city: 'Belo Horizonte',
                neighborhood: 'Centro',
                visible_in_locator: true,
              },
              pickup: true,
              delivery: true,
            },
            {
              branch_id: 'branch-005',
              name: 'Filial - Zona Sul',
              city: 'Belo Horizonte',
              location: {
                country: 'Brasil',
                state: 'MG',
                city: 'Belo Horizonte',
                neighborhood: 'Zona Sul',
                visible_in_locator: true,
              },
              pickup: true,
              delivery: false,
            },
          ],
        },
        {
          storeId: 'store-004',
          name: 'Loja Variedades',
          templateId: 'general_store',
          location: {
            country: 'Brasil',
            state: 'PR',
            city: 'Curitiba',
            visible_in_locator: true,
          },
          branches: [
            {
              branch_id: 'branch-006',
              name: 'Loja Única',
              city: 'Curitiba',
              location: {
                country: 'Brasil',
                state: 'PR',
                city: 'Curitiba',
                neighborhood: 'Centro',
                visible_in_locator: true,
              },
              pickup: true,
              delivery: true,
            },
          ],
        },
        {
          storeId: 'store-005',
          name: 'Anúncios Classificados',
          templateId: 'marketplace_listing',
          location: {
            country: 'Brasil',
            state: 'BR',
            city: 'Brasil',
            visible_in_locator: false, // Online, não aparece no locator
          },
          branches: [
            {
              branch_id: 'branch-007',
              name: 'Online',
              city: 'Brasil',
              location: {
                country: 'Brasil',
                state: 'BR',
                city: 'Brasil',
                visible_in_locator: false,
              },
              pickup: false,
              delivery: false,
            },
          ],
        },
      ];

    // Se scope e valueCents foram fornecidos, aplicar filtro declarativo
    if (scope && valueCents) {
      // Buscar definição do scope no contrato de regions
      const regions = this.getRegions();
      const scopeDefinition = regions.region_scopes.find(s => s.id === scope);
      
      if (scopeDefinition) {
        // Determinar campo de filtro baseado nos filters do scope
        // Como os dados atuais só têm 'city', filtramos apenas se 'city' estiver nos filters
        const filterField = scopeDefinition.filters.includes('city') ? 'city' : null;
        
        if (filterField) {
          // Filtrar branches que correspondem ao valor
          const filteredStores = allStores.map(store => ({
            ...store,
            branches: store.branches.filter(branch => {
              // Comparação case-insensitive para city
              if (filterField === 'city') {
                return branch.city.toLowerCase() === valueCents.toLowerCase();
              }
              return false;
            }),
          })).filter(store => store.branches.length > 0); // Remover lojas sem branches após filtro
          
          return {
            domain: 'marketplace',
            version: 'v0',
            scope_applied: {
              scope,
              valueCents,
              filter_field: filterField,
            },
            stores: filteredStores,
          };
        }
      }
    }
    
    // Sem filtro ou filtro não aplicável - retornar todos os dados
    return {
      domain: 'marketplace',
      version: 'v0',
      stores: allStores,
    };
  }

  /**
   * Stub: guards de trust para ações sensíveis (ex.: invoice).
   * TODO: integrar com módulo de trust quando disponível.
   */
  private applyTrustGuards(_input: { actorId: string; action: string; amountCents: number }): void {
    // No-op até integração com trust module
  }

  /**
   * Regiões de Descoberta do Marketplace
   * Retorna contrato declarativo de escopos geográficos para filtragem
   * Totalmente estático e declarativo, sem lógica de negócio
   * NÃO calcula distância, NÃO filtra automaticamente, apenas fornece metadados
   */
  getRegions(): {
    domain: string;
    version: string;
    region_scopes: Array<{
      id: string;
      label: string;
      filters: string[];
    }>;
    default_scope: string;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      default_scope: 'city',
      region_scopes: [
        {
          id: 'city',
          label: 'Cidade',
          filters: ['city'],
        },
        {
          id: 'metro',
          label: 'Região Metropolitana',
          filters: ['city', 'metro_area'],
        },
        {
          id: 'state',
          label: 'Estado',
          filters: ['state', 'city'],
        },
        {
          id: 'country',
          label: 'País',
          filters: ['country', 'state', 'city'],
        },
        {
          id: 'neighborhood',
          label: 'Bairro',
          filters: ['neighborhood', 'city'],
        },
      ],
    };
  }

  /**
   * Catálogo da Loja
   * Retorna categorias compatíveis com o template da loja
   * READ-ONLY, in-memory, sem produtos
   */
  getStoreCatalog(storeId: string): {
    storeId: string;
    name: string;
    templateId: string;
    categories: Array<{
      id: string;
      name: string;
    }>;
  } | null {
    // Buscar a loja
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.storeId === storeId);
    
    if (!store) {
      return null;
    }

    // Buscar todas as categorias
    const categoriesData = this.getCategories();
    
    // Filtrar categorias compatíveis com o template da loja
    const compatibleCategories: Array<{ id: string; name: string }> = [];
    
    const collectCategories = (cats: typeof categoriesData.categories) => {
      for (const cat of cats) {
        // Verificar se a categoria é compatível com o template da loja
        if (cat.templates.includes(store.templateId)) {
          compatibleCategories.push({
            id: cat.id,
            name: cat.name,
          });
        }
        
        // Processar children recursivamente
        if (cat.children) {
          collectCategories(cat.children);
        }
      }
    };
    
    collectCategories(categoriesData.categories);
    
    return {
      storeId: store.storeId,
      name: store.name,
      templateId: store.templateId,
      categories: compatibleCategories,
    };
  }

  /**
   * Catálogo Canônico de Produtos
   * Retorna produtos base reutilizáveis entre lojas, categorias e templates
   * READ-ONLY, in-memory, sem preço, estoque ou vendedor
   * Produto ≠ Oferta (produto é base, oferta é instância com preço/estoque)
   */
  getCanonicalProducts(): {
    domain: string;
    version: string;
    products: Array<{
      id: string;
      name: string;
      description: string;
      categoryId: string;
      attributes: Record<string, any>;
      images: string[];
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      products: [
        // Alimentos e Bebidas
        {
          id: 'product-001',
          name: 'Arroz Branco Tipo 1',
          description: 'Arroz branco de grão longo, pacote de 5kg',
          categoryId: 'food-beverages-packaged',
          attributes: {
            brand: 'Marca Genérica',
            weight: '5kg',
            unit: 'pacote',
          },
          images: [],
        },
        {
          id: 'product-002',
          name: 'Feijão Preto',
          description: 'Feijão preto tipo 1, pacote de 1kg',
          categoryId: 'food-beverages-packaged',
          attributes: {
            brand: 'Marca Genérica',
            weight: '1kg',
            unit: 'pacote',
          },
          images: [],
        },
        {
          id: 'product-003',
          name: 'Água Mineral',
          description: 'Água mineral natural, garrafa de 500ml',
          categoryId: 'food-beverages-beverages',
          attributes: {
            brand: 'Marca Genérica',
            volume: '500ml',
            unit: 'garrafa',
          },
          images: [],
        },
        {
          id: 'product-004',
          name: 'Leite Integral',
          description: 'Leite integral pasteurizado, caixa de 1L',
          categoryId: 'food-beverages-fresh',
          attributes: {
            brand: 'Marca Genérica',
            volume: '1L',
            unit: 'caixa',
            type: 'integral',
          },
          images: [],
        },
        // Saúde e Beleza
        {
          id: 'product-005',
          name: 'Paracetamol 500mg',
          description: 'Paracetamol 500mg, caixa com 20 comprimidos',
          categoryId: 'health-beauty-medicines',
          attributes: {
            brand: 'Marca Genérica',
            dosage: '500mg',
            quantity: '20 comprimidos',
            unit: 'caixa',
            requiresPrescription: false,
          },
          images: [],
        },
        {
          id: 'product-006',
          name: 'Shampoo Anticaspa',
          description: 'Shampoo anticaspa, frasco de 400ml',
          categoryId: 'health-beauty-personal-care',
          attributes: {
            brand: 'Marca Genérica',
            volume: '400ml',
            unit: 'frasco',
            type: 'anticaspa',
          },
          images: [],
        },
        {
          id: 'product-007',
          name: 'Vitamina C 1000mg',
          description: 'Vitamina C 1000mg, frasco com 30 comprimidos',
          categoryId: 'health-beauty-vitamins',
          attributes: {
            brand: 'Marca Genérica',
            dosage: '1000mg',
            quantity: '30 comprimidos',
            unit: 'frasco',
          },
          images: [],
        },
        // Casa e Construção
        {
          id: 'product-008',
          name: 'Cimento Portland',
          description: 'Cimento Portland comum, saco de 50kg',
          categoryId: 'home-construction-materials',
          attributes: {
            brand: 'Marca Genérica',
            weight: '50kg',
            unit: 'saco',
            type: 'portland',
          },
          images: [],
        },
        {
          id: 'product-009',
          name: 'Martelo de Carpinteiro',
          description: 'Martelo de carpinteiro com cabo de madeira',
          categoryId: 'home-construction-tools',
          attributes: {
            brand: 'Marca Genérica',
            weight: '500g',
            unit: 'unidade',
            type: 'carpinteiro',
          },
          images: [],
        },
        {
          id: 'product-010',
          name: 'Tinta Acrílica Branca',
          description: 'Tinta acrílica branca, balde de 18L',
          categoryId: 'home-construction-home-decor',
          attributes: {
            brand: 'Marca Genérica',
            volume: '18L',
            unit: 'balde',
            color: 'branco',
            type: 'acrílica',
          },
          images: [],
        },
        // Eletrônicos
        {
          id: 'product-011',
          name: 'Smartphone Básico',
          description: 'Smartphone básico com tela de 6 polegadas',
          categoryId: 'electronics-mobile',
          attributes: {
            brand: 'Marca Genérica',
            screenSize: '6 polegadas',
            storage: '64GB',
            ram: '4GB',
            unit: 'unidade',
          },
          images: [],
        },
        {
          id: 'product-012',
          name: 'Notebook Básico',
          description: 'Notebook básico com processador Intel Core i3',
          categoryId: 'electronics-computers',
          attributes: {
            brand: 'Marca Genérica',
            screenSize: '15.6 polegadas',
            storage: '256GB SSD',
            ram: '8GB',
            processor: 'Intel Core i3',
            unit: 'unidade',
          },
          images: [],
        },
        // Roupas e Acessórios
        {
          id: 'product-013',
          name: 'Camiseta Básica Masculina',
          description: 'Camiseta básica masculina, algodão 100%',
          categoryId: 'clothing-accessories-men',
          attributes: {
            brand: 'Marca Genérica',
            material: 'algodão 100%',
            sizes: ['P', 'M', 'G', 'GG'],
            unit: 'peça',
          },
          images: [],
        },
        {
          id: 'product-014',
          name: 'Vestido Casual Feminino',
          description: 'Vestido casual feminino, algodão',
          categoryId: 'clothing-accessories-women',
          attributes: {
            brand: 'Marca Genérica',
            material: 'algodão',
            sizes: ['P', 'M', 'G'],
            unit: 'peça',
          },
          images: [],
        },
        // Esportes e Lazer
        {
          id: 'product-015',
          name: 'Bola de Futebol',
          description: 'Bola de futebol oficial, tamanho 5',
          categoryId: 'sports-leisure-soccer',
          attributes: {
            brand: 'Marca Genérica',
            size: '5',
            material: 'couro sintético',
            unit: 'unidade',
          },
          images: [],
        },
        {
          id: 'product-016',
          name: 'Tênis Esportivo',
          description: 'Tênis esportivo unissex, diversos tamanhos',
          categoryId: 'sports-leisure-footwear',
          attributes: {
            brand: 'Marca Genérica',
            sizes: ['36', '37', '38', '39', '40', '41', '42', '43'],
            unit: 'par',
          },
          images: [],
        },
        // Livros e Mídia
        {
          id: 'product-017',
          name: 'Livro de Ficção',
          description: 'Livro de ficção científica, capa dura',
          categoryId: 'books-media-books',
          attributes: {
            brand: 'Editora Genérica',
            pages: '300',
            format: 'capa dura',
            language: 'português',
            unit: 'unidade',
          },
          images: [],
        },
        // Automotivo
        {
          id: 'product-018',
          name: 'Óleo de Motor 15W40',
          description: 'Óleo de motor 15W40, galão de 4L',
          categoryId: 'automotive-parts',
          attributes: {
            brand: 'Marca Genérica',
            viscosity: '15W40',
            volume: '4L',
            unit: 'galão',
          },
          images: [],
        },
      ],
    };
  }

  /**
   * Produtos Ativados por Loja (Store Product Activation)
   * Delega a storeProductService (persistido).
   */
  async getStoreProducts(
    tenantId: string,
    storeId: string,
    categoryId?: string
  ): Promise<{
    domain: string;
    version: string;
    storeId: string;
    products: Array<{
      productId: string;
      name: string;
      description: string | null;
      categoryId: string | null;
      attributes?: Record<string, any>;
      images?: string[];
      isEnabled: boolean;
      price: { amountCents: number; currency: string } | null;
      stock: { quantity: number; unit: string } | null;
      industryId?: string;
      hubId?: string;
      isIndustrial?: boolean;
    }>;
  } | null> {
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.storeId === storeId);
    if (!store) return null;
    const result = await storeProductService.getStoreProducts(tenantId, storeId, categoryId ?? undefined);
    return {
      domain: result.domain,
      version: result.version,
      storeId: result.storeId,
      products: result.products.map(p => ({
        productId: p.productId,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        attributes: p.attributes,
        images: p.images ?? [],
        isEnabled: p.isEnabled,
        price: p.price,
        stock: p.stock,
        industryId: p.industryId,
        hubId: p.hubId,
        isIndustrial: p.is_industrial,
      })),
    };
  }

  /**
   * Pedidos do Marketplace (in-memory, temporários)
   * Armazena pedidos em memória sem persistência. Formato conforme Order.contract (camelCase).
   */
  private orders: Map<string, Order> = new Map();

  /**
   * Clientes da Loja (in-memory)
   */
  private storeCustomers: Map<string, {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  }> = new Map();

  /**
   * Criar novo pedido vazio (online). Retorna Order conforme contrato (camelCase).
   */
  createOrder(storeId: string): Order {
    // Verificar se a loja existe
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.storeId === storeId);
    
    if (!store) {
      throw new Error('Loja não encontrada');
    }

    // Gerar ID único para o pedido
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const order: Order = {
      orderId,
      storeId,
      channel: 'online',
      origin: 'marketplace',
      items: [],
      totalCents: 0,
    };
    
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * Criar pedido físico (PDV). Retorna Order conforme contrato (camelCase).
   * Não exige checkout público, não exige attribution
   */
  async createPhysicalOrder(tenantId: string, input: {
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    customer_id?: string;
  }): Promise<Order> {
    // Verificar se a loja existe
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.storeId === input.storeId);
    
    if (!store) {
      throw new Error('Loja não encontrada');
    }

    // Gerar ID único para o pedido
    const orderId = `pdv-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Buscar produtos da loja
    const storeProducts = await this.getStoreProducts(tenantId, input.storeId);
    
    if (!storeProducts) {
      throw new Error('Loja não encontrada');
    }

    // Validar e processar itens (formato Order: camelCase, amountCents)
    const items: Order['items'] = [];

    for (const inputItem of input.items) {
      const product = storeProducts.products.find(p => p.productId === inputItem.productId);
      
      if (!product) {
        throw new Error(`Produto ${inputItem.productId} não encontrado nesta loja`);
      }

      if (!product.isEnabled) {
        throw new Error(`Produto ${product.name} não está ativado`);
      }

      if (!product.price) {
        throw new Error(`Produto ${product.name} não possui preço definido`);
      }

      if (inputItem.quantity < 1) {
        throw new Error('Quantidade deve ser maior que zero');
      }

      // Produtos industriais (dropship) não têm estoque local
      const isIndustrial = product.isIndustrial || product.industryId;
      
      if (!isIndustrial) {
        // Produtos retail: validar estoque e debitar
        if (!product.stock || product.stock.quantity < inputItem.quantity) {
          throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock?.quantity || 0}, solicitado: ${inputItem.quantity}`);
        }

        // Debitar estoque (unificado - mesmo estoque para online e físico)
        if (product.stock) {
          product.stock.quantity -= inputItem.quantity;
        }
      }
      // Produtos industriais: não debitar estoque (dropship)

      const amountCents = 'amountCents' in product.price ? product.price.amountCents : Math.round((product.price as { amount: number; currency: string }).amount * 100);
      const subtotal = amountCents * inputItem.quantity;
      
      items.push({
        productId: product.productId,
        name: product.name,
        price: { amountCents, currency: product.price.currency },
        quantity: inputItem.quantity,
        subtotal,
      });
    }

    const totalCents = items.reduce((sum, item) => sum + item.subtotal, 0);

    const order: Order = {
      orderId,
      storeId: input.storeId,
      channel: 'physical',
      origin: 'store_pdv',
      customerId: input.customer_id,
      items,
      totalCents,
    };
    (order as any).tenantId = tenantId;
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * Criar ou buscar cliente da loja
   */
  createStoreCustomer(input: {
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
  }): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } {
    // Verificar se já existe cliente com mesmo phone ou linked_user_id
    let existingCustomer = Array.from(this.storeCustomers.values()).find(
      c => c.storeId === input.storeId && (
        (input.phone && c.phone === input.phone) ||
        (input.linked_user_id && c.linked_user_id === input.linked_user_id)
      )
    );

    if (existingCustomer) {
      // Atualizar dados se necessário
      if (input.name) existingCustomer.name = input.name;
      if (input.phone) existingCustomer.phone = input.phone;
      if (input.linked_user_id) existingCustomer.linked_user_id = input.linked_user_id;
      this.storeCustomers.set(existingCustomer.customer_id, existingCustomer);
      return existingCustomer;
    }

    const customerId = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const customer = {
      customer_id: customerId,
      storeId: input.storeId,
      name: input.name,
      phone: input.phone,
      linked_user_id: input.linked_user_id,
      createdAt: new Date().toISOString(),
    };

    this.storeCustomers.set(customerId, customer);
    return customer;
  }

  /**
   * Buscar cliente da loja
   */
  getStoreCustomer(customerId: string): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } | null {
    return this.storeCustomers.get(customerId) || null;
  }

  /**
   * Adicionar item ao pedido
   */
  async addOrderItem(orderId: string, productId: string, quantity: number): Promise<Order> {
    const order = this.orders.get(orderId);
    
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const tenantId = (order as any).tenantId as string | undefined;
    if (!tenantId) {
      throw new Error('Pedido sem tenantId; use createPhysicalOrder(tenantId, input) para criar pedidos');
    }

    // Validações
    if (quantity < 1) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    // Buscar produto da loja
    const storeProducts = await this.getStoreProducts(tenantId, order.storeId);
    
    if (!storeProducts) {
      throw new Error('Loja não encontrada');
    }

    const product = storeProducts.products.find(p => p.productId === productId);
    
    if (!product) {
      throw new Error('Produto não encontrado nesta loja');
    }

    if (!product.isEnabled) {
      throw new Error('Produto não está ativado');
    }

    if (!product.price) {
      throw new Error('Produto não possui preço definido');
    }

    // Produtos industriais (dropship) não têm estoque local
    const isIndustrial = product.isIndustrial || product.industryId;
    
    if (!isIndustrial) {
      // Produtos retail: validar estoque local
      if (!product.stock || product.stock.quantity === 0) {
        throw new Error('Produto indisponível (estoque zero)');
      }

      if (product.stock.quantity < quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock.quantity}`);
      }
    }
    // Produtos industriais: não validar estoque (dropship)

    const amountCents = 'amountCents' in product.price ? product.price.amountCents : Math.round((product.price as { amount: number; currency: string }).amount * 100);

    // Verificar se produto já está no pedido
    const existingItemIndex = order.items.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {
      // Atualizar quantidade do item existente
      const existingItem = order.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      // Validar estoque apenas para produtos retail
      if (!isIndustrial && product.stock && product.stock.quantity < newQuantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock.quantity}, solicitado: ${newQuantity}`);
      }
      
      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.price.amountCents * existingItem.quantity;
    } else {
      // Adicionar novo item (formato Order: productId, amountCents)
      const subtotal = amountCents * quantity;
      
      order.items.push({
        productId,
        name: product.name,
        price: { amountCents, currency: product.price.currency },
        quantity,
        subtotal,
      });
    }

    // Recalcular total
    order.totalCents = order.items.reduce((sum, item) => sum + item.subtotal, 0);

    return order;
  }

  /**
   * Buscar pedido por ID
   */
  getOrder(orderId: string): Order | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * CheckoutIntent do Marketplace (formato contrato: camelCase).
   * DECLARATIVO - NÃO executa pagamento, NÃO move dinheiro
   */
  private checkouts: Map<string, CheckoutIntent> = new Map();
  /** Mapa checkoutId → orderId (checkout criado a partir de um Order; contrato não expõe orderId em orders[]) */
  private checkoutOrderIds: Map<string, string> = new Map();

  /**
   * Criar CheckoutIntent a partir de um Order
   * @param orderId - ID do pedido
   * @param attributionId - ID de attribution (opcional, se vier de share)
   */
  createCheckoutFromOrder(orderId: string, attributionId?: string): CheckoutIntent {
    const order = this.getOrder(orderId);
    
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.items.length === 0) {
      throw new Error('Pedido vazio não pode ser convertido em checkout');
    }

    // Gerar ID único para o checkout
    const checkoutId = `checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Agrupar itens por storeId (formato CheckoutIntent: camelCase)
    const storeGroups = new Map<string, Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>>();

    order.items.forEach(item => {
      const storeId = order.storeId;
      if (!storeGroups.has(storeId)) {
        storeGroups.set(storeId, []);
      }
      storeGroups.get(storeId)!.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price.amountCents,
        subtotal: item.subtotal,
      });
    });

    const orders: CheckoutIntent['orders'] = Array.from(storeGroups.entries()).map(([storeId, items]) => {
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      return { storeId, items, subtotal };
    });

    const totalCents = orders.reduce((sum, o) => sum + o.subtotal, 0);

    const checkout: CheckoutIntent = {
      checkoutId,
      orders,
      totalCents,
      paymentOptions: {
        allowBalance: true,
        allowCard: true,
        allowInvoice: true,
      },
      status: 'open',
      ...(attributionId !== undefined && { attributionId }),
    };

    this.checkouts.set(checkoutId, checkout);
    this.checkoutOrderIds.set(checkoutId, orderId);

    return checkout;
  }

  /**
   * Buscar CheckoutIntent por ID
   */
  getCheckout(checkoutId: string): CheckoutIntent | null {
    return this.checkouts.get(checkoutId) || null;
  }

  /**
   * Confirmar CheckoutIntent
   * Apenas muda status para 'confirmed'
   * NÃO executa pagamento, NÃO move dinheiro
   */
  confirmCheckout(checkoutId: string): CheckoutIntent {
    const checkout = this.checkouts.get(checkoutId);
    
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    if (checkout.status === 'confirmed') {
      throw new Error('Checkout já foi confirmado');
    }

    checkout.status = 'confirmed';
    
    return checkout;
  }

  /**
   * Payment Orchestrator - PaymentPlan (formato contrato: camelCase).
   * DECLARATIVO - NÃO executa pagamento, NÃO move dinheiro
   */
  private paymentPlans: Map<string, PaymentPlan> = new Map();
  /** Mapa paymentPlanId → attributionId (contrato PaymentPlan não expõe attribution) */
  private paymentPlanAttributionIds: Map<string, string> = new Map();

  /**
   * Criar PaymentPlan a partir de CheckoutIntent
   */
  createPaymentPlan(checkoutId: string, method: 'balance' | 'card' | 'invoice'): PaymentPlan {
    const checkout = this.getCheckout(checkoutId);
    
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    if (checkout.status !== 'confirmed') {
      throw new Error('Checkout precisa estar confirmado para criar payment plan');
    }

    // Aplicar guards de trust para invoice
    if (method === 'invoice') {
      for (const order of checkout.orders) {
        this.applyTrustGuards({
          actorId: order.storeId,
          action: 'invoice',
          amountCents: order.subtotal,
        });
      }
    }

    // Validar método de pagamento permitido
    if (method === 'balance' && !checkout.paymentOptions.allowBalance) {
      throw new Error('Método de pagamento "balance" não permitido');
    }
    if (method === 'card' && !checkout.paymentOptions.allowCard) {
      throw new Error('Método de pagamento "card" não permitido');
    }
    if (method === 'invoice' && !checkout.paymentOptions.allowInvoice) {
      throw new Error('Método de pagamento "invoice" não permitido');
    }

    // Gerar ID único para o payment plan
    const paymentPlanId = `payment-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 🔴 CORREÇÃO INSTITUCIONAL: Removido cálculo inline de splits
    // Splits são calculados EXCLUSIVAMENTE via bank-split-engine.service.ts
    // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seções 12.1 e 12.3)
    // e FEATURE_MARKETPLACE_MULTI_VENDOR.md (invariantes institucionais)
    
    // Verificar se checkout tem attributionId (vem de share)
    const attributionId = checkout.attributionId;
    let attribution = null;
    if (attributionId) {
      attribution = this.getAttribution(attributionId);
    }

    // PaymentPlan conforme contrato (camelCase); splits calculados via engine canônico depois
    const paymentPlan: PaymentPlan = {
      paymentPlanId,
      checkoutId,
      method,
      totalCents: checkout.totalCents,
      splits: [],
      status: 'calculated',
    };

    this.paymentPlans.set(paymentPlanId, paymentPlan);
    if (attributionId) {
      this.paymentPlanAttributionIds.set(paymentPlanId, attributionId);
    }

    // Se for serviço, criar payment hold
    // Verificar se checkout contém serviços (ServiceOrder)
    let isServiceCheckout = false;
    let serviceRequestId: string | null = null;
    
    const orderIdForCheckout = this.checkoutOrderIds.get(checkoutId);
    for (const checkoutOrder of checkout.orders) {
      const order = orderIdForCheckout ? this.orders.get(orderIdForCheckout) : null;
      if (order) {
        const serviceOrder = Array.from(this.serviceOrders.values())
          .find(so => so.orderId === order.orderId);
        
        if (serviceOrder) {
          isServiceCheckout = true;
          // Buscar request relacionado (via booking)
          const booking = this.serviceBookings.get(serviceOrder.bookingId);
          if (booking) {
            // Buscar request via dispatch ou pre-reservation
            const dispatch = Array.from(this.serviceDispatches.values())
              .find(d => {
                const preReservations = this.getPreReservationsByDispatch(d.dispatchId);
                return preReservations.some(pr => 
                  pr.offeringId === serviceOrder.offeringId &&
                  pr.date === booking.date &&
                  pr.time === booking.time
                );
              });
            if (dispatch) {
              serviceRequestId = dispatch.requestId;
            }
          }
          break; // Encontrou um serviço, não precisa continuar
        }
      }
    }

    if (isServiceCheckout && serviceRequestId) {
      // Verificar se service template/offering exige hold
      // Por enquanto, criar hold para todos os serviços (padrão)
      const hold = this.createServicePaymentHold(
        serviceRequestId,
        paymentPlanId,
        checkout.totalCents,
        'BRL',
        'client_confirm', // Política padrão
        24 // 24 horas para auto-release
      );

      marketplaceLogger.init('Payment hold criado para serviço', {
        hold_id: hold.holdId,
        requestId: serviceRequestId,
        paymentPlanId: paymentPlanId,
      });
    }
    
    return paymentPlan;
  }

  /**
   * Buscar PaymentPlan por ID
   */
  getPaymentPlan(paymentPlanId: string): PaymentPlan | null {
    return this.paymentPlans.get(paymentPlanId) || null;
  }

  /**
   * Executar PaymentPlan
   * Move dinheiro APENAS para métodos internos (balance, invoice)
   * NÃO executa se method = 'card'
   */
  async executePaymentPlan(
    tenantId: string,
    userId: string,
    paymentPlanId: string
  ): Promise<never> {
    throw new Error(
      'LEGACY_FINANCIAL_PATH_DISABLED: MarketplaceService.executePaymentPlan() - Financial decision outside Bank is forbidden'
    );
  }


  /**
   * Sistema de Logística - DeliveryOrder
   * Permite entrega própria ou por terceiros
   * DECLARATIVO - NÃO calcula rota, NÃO otimiza, NÃO integra mapas
   */
  private deliveries: Map<string, DeliveryOrder> = new Map();

  /**
   * Criar DeliveryOrder a partir de Checkout
   */
  createDeliveryFromCheckout(checkoutId: string): DeliveryOrder[] {
    const checkout = this.checkouts.get(checkoutId);
    
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    // Validar que checkout está pago
    if (!(checkout as any).paid && !(checkout as any).invoiced) {
      throw new Error('Checkout precisa estar pago para criar entrega');
    }

    // Preferências de entrega por loja (declarativas, in-memory)
    const storeDeliveryPreferences: Record<string, {
      type: 'own' | 'third_party';
      vehicles: Array<'bike' | 'moto' | 'car' | 'van'>;
      defaultVehicle: 'bike' | 'moto' | 'car' | 'van';
      costPayer: 'seller' | 'buyer' | 'platform';
      baseCost: number;
      etaMinutes: number;
    }> = {
      'store-001': {
        type: 'own',
        vehicles: ['bike', 'moto'],
        defaultVehicle: 'bike',
        costPayer: 'buyer',
        baseCost: 5.00,
        etaMinutes: 30,
      },
      'store-002': {
        type: 'third_party',
        vehicles: ['car', 'van'],
        defaultVehicle: 'car',
        costPayer: 'seller',
        baseCost: 8.50,
        etaMinutes: 45,
      },
      'store-003': {
        type: 'own',
        vehicles: ['moto', 'car'],
        defaultVehicle: 'moto',
        costPayer: 'platform',
        baseCost: 0.00, // Frete grátis
        etaMinutes: 25,
      },
    };

    const deliveries: DeliveryOrder[] = [];

    // Criar um delivery por store_id (shape DeliveryOrder.contract.ts)
    for (const order of checkout.orders) {
      const storeId = order.storeId;
      const preferences = storeDeliveryPreferences[storeId] || {
        type: 'third_party' as const,
        vehicles: ['car'] as const,
        defaultVehicle: 'car' as const,
        costPayer: 'buyer' as const,
        baseCost: 10.00,
        etaMinutes: 60,
      };

      const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${storeId}`;

      const delivery: DeliveryOrder = {
        deliveryId,
        checkoutId,
        storeId,
        type: preferences.type,
        vehicle: preferences.defaultVehicle,
        etaMinutes: preferences.etaMinutes,
        cost: {
          amountCents: Math.round(preferences.baseCost * 100),
          currency: 'BRL',
          payer: preferences.costPayer,
        },
        status: 'created',
      };

      this.deliveries.set(deliveryId, delivery);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  /**
   * Buscar DeliveryOrder por ID
   */
  getDelivery(deliveryId: string): DeliveryOrder | null {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Buscar lojas próximas (descoberta local)
   * NÃO calcula distância, NÃO ordena automaticamente
   * Apenas filtra por localização e critérios
   */
  getStoresNear(params: {
    city: string;
    neighborhood?: string;
    category_id?: string;
    template_id?: string;
  }): {
    city: string;
    filters_applied: {
      city: string;
      neighborhood?: string;
      category_id?: string;
      template_id?: string;
    };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      branches: Array<{
        branch_id: string;
        name: string;
        neighborhood?: string;
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    const { city, neighborhood, category_id, template_id } = params;
    
    const allStoresData = this.getStores();
    let filteredStores = allStoresData.stores;

    // Filtrar por visibilidade no locator
    filteredStores = filteredStores.filter(store => {
      // Loja deve ter visible_in_locator = true
      if (store.location && !store.location.visible_in_locator) {
        return false;
      }
      
      // Pelo menos uma branch deve ter visible_in_locator = true e estar na cidade
      const hasVisibleBranch = store.branches.some(branch => {
        const branchInCity = branch.city === city || (branch.location && branch.location.city === city);
        const branchVisible = !branch.location || branch.location.visible_in_locator;
        return branchInCity && branchVisible;
      });
      
      return hasVisibleBranch;
    });

    // Filtrar por template_id (se fornecido)
    if (template_id) {
      filteredStores = filteredStores.filter(store => store.templateId === template_id);
    }

    // Filtrar por category_id (se fornecido)
    // Verificar se o template da loja aceita a categoria
    if (category_id) {
      const categoriesData = this.getCategories();
      
      const isCategoryCompatible = (catId: string, storeTemplateId: string): boolean => {
        const findCategory = (cats: typeof categoriesData.categories): typeof categoriesData.categories[0] | null => {
          for (const cat of cats) {
            if (cat.id === catId) {
              return cat;
            }
            if (cat.children) {
              const found = findCategory(cat.children);
              if (found) return found;
            }
          }
          return null;
        };
        
        const category = findCategory(categoriesData.categories);
        if (!category) return false;
        
        return category.templates.includes(storeTemplateId);
      };
      
      filteredStores = filteredStores.filter(store => 
        isCategoryCompatible(category_id, store.templateId)
      );
    }

    // Filtrar branches por cidade e neighborhood
    const resultStores = filteredStores.map(store => {
      const filteredBranches = store.branches
        .filter(branch => {
          // Filtrar por cidade
          const branchInCity = branch.city === city || (branch.location && branch.location.city === city);
          if (!branchInCity) return false;
          
          // Filtrar por neighborhood (se fornecido)
          if (neighborhood) {
            const branchNeighborhood = branch.location?.neighborhood;
            if (branchNeighborhood !== neighborhood) return false;
          }
          
          // Filtrar por visibilidade
          const branchVisible = !branch.location || branch.location.visible_in_locator;
          return branchVisible;
        })
        .map(branch => ({
          branch_id: branch.branch_id,
          name: branch.name,
          neighborhood: branch.location?.neighborhood,
          pickup: branch.pickup,
          delivery: branch.delivery,
        }));
      
      // Retornar loja apenas se tiver branches visíveis
      if (filteredBranches.length === 0) {
        return null;
      }
      
      return {
        storeId: store.storeId,
        name: store.name,
        templateId: store.templateId,
        branches: filteredBranches,
      };
    }).filter((store): store is NonNullable<typeof store> => store !== null);

    return {
      city,
      filters_applied: {
        city,
        neighborhood,
        category_id,
        template_id,
      },
      stores: resultStores,
    };
  }

  /**
   * Buscar deliveries por checkoutId
   */
  getDeliveriesByCheckout(checkoutId: string): DeliveryOrder[] {
    return Array.from(this.deliveries.values()).filter(d => d.checkoutId === checkoutId);
  }

  /**
   * Sistema de Attribution & Sharing
   * Permite compartilhamento intencional com comissão
   * Attribution é METADADO - Zero impacto em compras normais
   */
  private attributions: Map<string, {
    attribution_id: string;
    source: {
      type: 'user' | 'group' | 'page' | 'store';
      id: string;
    };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: {
      type: 'percentage' | 'fixed';
      valueCents: number;
    };
    createdAt: string;
  }> = new Map();

  private shares: Map<string, {
    share_id: string;
    attribution_id: string;
    share_url: string;
    content_type: 'product' | 'service' | 'store';
    content_id: string;
    createdAt: string;
  }> = new Map();

  /**
   * Criar AttributionContext
   */
  createAttributionContext(input: {
    source: {
      type: 'user' | 'group' | 'page' | 'store';
      id: string;
    };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: {
      type: 'percentage' | 'fixed';
      valueCents: number;
    };
  }): {
    attribution_id: string;
    source: {
      type: 'user' | 'group' | 'page' | 'store';
      id: string;
    };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: {
      type: 'percentage' | 'fixed';
      valueCents: number;
    };
    createdAt: string;
  } {
    const attributionId = `attribution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const attribution = {
      attribution_id: attributionId,
      source: input.source,
      intent: input.intent,
      visibility: input.visibility,
      commission: input.commission,
      createdAt: new Date().toISOString(),
    };

    this.attributions.set(attributionId, attribution);
    
    return attribution;
  }

  /**
   * Criar Share
   */
  createShare(input: {
    content_type: 'product' | 'service' | 'store';
    content_id: string;
    attribution_context: {
      source: {
        type: 'user' | 'group' | 'page' | 'store';
        id: string;
      };
      intent: 'business' | 'recommendation' | 'entertainment';
      visibility: {
        scope: 'public' | 'group' | 'direct' | 'relationship_category';
        group_id?: string;
        target_ids?: string[];
        relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
      };
      commission?: {
        type: 'percentage' | 'fixed';
        valueCents: number;
      };
    };
  }): {
    share_id: string;
    attribution_id: string;
    share_url: string;
  } {
    // Criar attribution context
    const attribution = this.createAttributionContext(input.attribution_context);

    // Criar share
    const shareId = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shareUrl = `/marketplace/${input.content_type}/${input.content_id}?attribution=${attribution.attribution_id}`;

    const share = {
      share_id: shareId,
      attribution_id: attribution.attribution_id,
      share_url: shareUrl,
      content_type: input.content_type,
      content_id: input.content_id,
      createdAt: new Date().toISOString(),
    };

    this.shares.set(shareId, share);

    return {
      share_id: shareId,
      attribution_id: attribution.attribution_id,
      share_url: shareUrl,
    };
  }

  /**
   * Buscar AttributionContext por ID
   */
  getAttribution(attributionId: string): {
    attribution_id: string;
    source: {
      type: 'user' | 'group' | 'page' | 'store';
      id: string;
    };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: {
      type: 'percentage' | 'fixed';
      valueCents: number;
    };
    createdAt: string;
  } | null {
    return this.attributions.get(attributionId) || null;
  }

  /**
   * Associar attribution_id ao checkout (se vier de share)
   */
  associateAttributionToCheckout(checkoutId: string, attributionId: string): void {
    const checkout = this.checkouts.get(checkoutId);
    if (checkout) {
      (checkout as any).attribution_id = attributionId;
      this.checkouts.set(checkoutId, checkout);
    }
  }

  /**
   * Sistema de Serviços, Agenda e Recorrência
   * Para academia, imobiliária, salão, serviços em geral
   */

  /**
   * ServiceTemplate (canônico, read-only)
   * Templates reutilizáveis de serviços
   */
  getServiceTemplates(): {
    domain: string;
    version: string;
    templates: Array<{
      templateId: string;
      name: string;
      description: string;
      categoryId: string;
      type: 'session' | 'recurring' | 'rental';
      default_duration_minutes?: number;
      pricing_model: 'per_session' | 'per_period';
    }>;
  } {
    return {
      domain: 'marketplace',
      version: 'v0',
      templates: [
        {
          templateId: 'gym-session',
          name: 'Aula de Academia',
          description: 'Aula individual ou em grupo na academia',
          categoryId: 'fitness',
          type: 'session',
          default_duration_minutes: 60,
          pricing_model: 'per_session',
        },
        {
          templateId: 'consultation',
          name: 'Consulta',
          description: 'Consulta profissional (médica, jurídica, etc.)',
          categoryId: 'professional',
          type: 'session',
          default_duration_minutes: 30,
          pricing_model: 'per_session',
        },
        {
          templateId: 'property-rental',
          name: 'Aluguel de Imóvel',
          description: 'Aluguel de imóvel residencial ou comercial',
          categoryId: 'real-estate',
          type: 'rental',
          pricing_model: 'per_period',
        },
        {
          templateId: 'maintenance',
          name: 'Manutenção',
          description: 'Serviço de manutenção técnica',
          categoryId: 'technical',
          type: 'session',
          default_duration_minutes: 120,
          pricing_model: 'per_session',
        },
        {
          templateId: 'haircut',
          name: 'Corte de Cabelo',
          description: 'Corte de cabelo no salão',
          categoryId: 'beauty',
          type: 'session',
          default_duration_minutes: 45,
          pricing_model: 'per_session',
        },
        {
          templateId: 'cleaning',
          name: 'Limpeza',
          description: 'Serviço de limpeza residencial ou comercial',
          categoryId: 'home-services',
          type: 'session',
          default_duration_minutes: 180,
          pricing_model: 'per_session',
        },
      ],
    };
  }

  /**
   * ServiceOffering (por loja)
   * Loja ativa serviços a partir do template
   */
  private serviceOfferings: Map<string, {
    offering_id: string;
    storeId: string;
    templateId: string;
    price: {
      amountCents: number;
      currency: string;
    };
    duration_minutes?: number;
    recurrence?: 'weekly' | 'monthly';
    isActive: boolean;
  }> = new Map();

  /**
   * ServiceAvailability (agenda)
   * Slots declarativos de disponibilidade
   */
  private serviceAvailabilities: Map<string, Array<{
    offering_id: string;
    weekday: number; // 0 = domingo, 1 = segunda, ..., 6 = sábado
    starts_at: string; // HH:mm
    ends_at: string; // HH:mm
    capacity: number; // Quantos clientes podem agendar neste slot
  }>> = new Map();

  /**
   * ServiceBooking (reservas)
   * Reserva NÃO executa pagamento
   */
  private serviceBookings: Map<string, {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled';
    createdAt: string;
  }> = new Map();

  /**
   * ServiceOrder (integração com checkout)
   * ServiceOrder entra no Checkout normal
   */
  private serviceOrders: Map<string, ServiceOrder> = new Map();

  /**
   * Buscar ofertas de serviços de uma loja
   */
  getStoreServiceOfferings(storeId: string): {
    storeId: string;
    offerings: Array<{
      offering_id: string;
      templateId: string;
      name: string;
      description: string;
      price: {
        amountCents: number;
        currency: string;
      };
      duration_minutes?: number;
      recurrence?: 'weekly' | 'monthly';
      isActive: boolean;
    }>;
  } {
    const offerings = Array.from(this.serviceOfferings.values())
      .filter(o => o.storeId === storeId && o.isActive)
      .map(o => {
        const template = this.getServiceTemplates().templates.find(t => t.templateId === o.templateId);
        return {
          offering_id: o.offering_id,
          templateId: o.templateId,
          name: template?.name || 'Serviço',
          description: template?.description || '',
          price: o.price,
          duration_minutes: o.duration_minutes || template?.default_duration_minutes,
          recurrence: o.recurrence,
          isActive: o.isActive,
        };
      });

    return {
      storeId: storeId,
      offerings,
    };
  }

  /**
   * Buscar disponibilidade de um serviço
   */
  getServiceAvailability(offeringId: string): Array<{
    weekday: number;
    starts_at: string;
    ends_at: string;
    capacity: number;
  }> {
    return this.serviceAvailabilities.get(offeringId) || [];
  }

  /**
   * Criar reserva de serviço
   */
  createServiceBooking(input: {
    offeringId: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    quantity: number;
  }): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled';
    createdAt: string;
  } {
    // Validar que o serviço existe e está ativo
    const offering = this.serviceOfferings.get(input.offeringId);
    if (!offering || !offering.isActive) {
      throw new Error('Serviço não encontrado ou inativo');
    }

    // Validar disponibilidade
    const availability = this.getServiceAvailability(input.offeringId);
    const dateObj = new Date(input.date);
    const weekday = dateObj.getDay();
    
    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) {
      throw new Error('Horário não disponível para este dia');
    }

    // Validar horário dentro do slot
    const requestedTime = input.time;
    if (requestedTime < slot.starts_at || requestedTime >= slot.ends_at) {
      throw new Error('Horário fora do período disponível');
    }

    // Validar capacidade
    const existingBookings = Array.from(this.serviceBookings.values())
      .filter(b =>
        b.offeringId === input.offeringId &&
        b.date === input.date &&
        b.time === input.time &&
        b.status !== 'cancelled'
      );
    
    const totalBooked = existingBookings.reduce((sum, b) => sum + b.quantity, 0);
    if (totalBooked + input.quantity > slot.capacity) {
      throw new Error(`Capacidade insuficiente. Disponível: ${slot.capacity - totalBooked}, solicitado: ${input.quantity}`);
    }

    const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const booking = {
      booking_id: bookingId,
      offeringId: input.offeringId,
      user_id: input.user_id,
      date: input.date,
      time: input.time,
      quantity: input.quantity,
      status: 'reserved' as const,
      createdAt: new Date().toISOString(),
    };

    this.serviceBookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Confirmar reserva e criar ServiceOrder
   */
  confirmServiceBooking(bookingId: string): {
    bookingId: string;
    orderId: string;
    offeringId: string;
    price: {
      amountCents: number;
      currency: string;
    };
  } {
    const booking = this.serviceBookings.get(bookingId);
    if (!booking) {
      throw new Error('Reserva não encontrada');
    }

    if (booking.status !== 'reserved') {
      throw new Error('Reserva já foi confirmada ou cancelada');
    }

    // Buscar oferta
    const offering = this.serviceOfferings.get(booking.offeringId);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    // Calcular preço total em centavos (contrato: price.amountCents)
    const unitCents = 'amountCents' in offering.price ? offering.price.amountCents : Math.round((offering.price as { amount: number }).amount * 100);
    const totalPriceCents = unitCents * booking.quantity;

    // Criar ServiceOrder (shape do ServiceOrder.contract.ts)
    const orderId = `service-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const serviceOrder: ServiceOrder = {
      orderId,
      bookingId,
      offeringId: booking.offeringId,
      price: {
        amountCents: totalPriceCents,
        currency: offering.price.currency,
      },
      channel: 'online',
      createdAt: new Date().toISOString(),
    };

    this.serviceOrders.set(orderId, serviceOrder);

    // Confirmar reserva
    booking.status = 'confirmed';
    this.serviceBookings.set(bookingId, booking);

    return {
      bookingId,
      orderId,
      offeringId: booking.offeringId,
      price: serviceOrder.price,
    };
  }

  /**
   * Buscar reserva por ID
   */
  getServiceBooking(bookingId: string): {
    booking_id: string;
    offeringId: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled';
    createdAt: string;
  } | null {
    return this.serviceBookings.get(bookingId) || null;
  }

  /**
   * Buscar ServiceOrder por booking_id
   */
  getServiceOrderByBooking(bookingId: string): ServiceOrder | null {
    return Array.from(this.serviceOrders.values()).find(o => o.bookingId === bookingId) || null;
  }

  /**
   * Buscar ServiceOrder por order_id
   */
  getServiceOrder(orderId: string): ServiceOrder | null {
    return this.serviceOrders.get(orderId) || null;
  }

  /**
   * Adicionar ServiceOrder a um Order existente
   * Converte ServiceOrder em item de Order para integração com checkout
   */
  addServiceOrderToOrder(orderId: string, serviceOrderId: string): {
    orderId: string;
    storeId: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    items: Array<{
      productId: string;
      name: string;
      price: {
        amountCents: number;
        currency: string;
      };
      quantity: number;
      subtotal: number;
    }>;
    totalCents: number;
  } {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const serviceOrder = this.serviceOrders.get(serviceOrderId);
    if (!serviceOrder) {
      throw new Error('ServiceOrder não encontrado');
    }

    // Buscar oferta para obter nome do serviço
    const offering = this.serviceOfferings.get(serviceOrder.offeringId);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    const template = this.getServiceTemplates().templates.find(t => t.templateId === offering.templateId);
    const serviceName = template?.name || 'Serviço';

    // Buscar booking para obter quantidade
    const booking = this.serviceBookings.get(serviceOrder.bookingId);
    const quantity = booking?.quantity || 1;

    // Adicionar serviço como item ao pedido
    const subtotal = serviceOrder.price.amountCents * quantity;
    
    order.items.push({
      productId: `service-${serviceOrder.offeringId}`, // ID especial para serviços
      name: serviceName,
      price: serviceOrder.price,
      quantity,
      subtotal,
    });

    // Recalcular total
    order.totalCents = order.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    this.orders.set(orderId, order);
    
    return {
      orderId: order.orderId,
      storeId: order.storeId,
      channel: order.channel,
      origin: order.origin,
      items: order.items,
      totalCents: order.totalCents,
    };
  }

  /**
   * Inicializar dados de exemplo (para desenvolvimento)
   */
  initializeServiceData(): void {
    // Criar ofertas de exemplo para store-001
    const offering1Id = 'offering-001';
    this.serviceOfferings.set(offering1Id, {
      offering_id: offering1Id,
      storeId: 'store-001',
      templateId: 'gym-session',
      price: { amountCents: 50.00, currency: 'BRL' },
      duration_minutes: 60,
      isActive: true,
    });

    const offering2Id = 'offering-002';
    this.serviceOfferings.set(offering2Id, {
      offering_id: offering2Id,
      storeId: 'store-001',
      templateId: 'consultation',
      price: { amountCents: 150.00, currency: 'BRL' },
      duration_minutes: 30,
      isActive: true,
    });

    // Criar disponibilidade para offering-001 (segunda a sexta, 8h-18h)
    this.serviceAvailabilities.set(offering1Id, [
      { offering_id: offering1Id, weekday: 1, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 2, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 3, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 4, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
      { offering_id: offering1Id, weekday: 5, starts_at: '08:00', ends_at: '18:00', capacity: 5 },
    ]);

    // Criar disponibilidade para offering-002 (segunda a sexta, 9h-17h)
    this.serviceAvailabilities.set(offering2Id, [
      { offering_id: offering2Id, weekday: 1, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 2, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 3, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 4, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
      { offering_id: offering2Id, weekday: 5, starts_at: '09:00', ends_at: '17:00', capacity: 3 },
    ]);

    // ============================================================
    // EXEMPLOS SEEDED PARA ORQUESTRADOR DE SERVIÇOS
    // ============================================================

    // 1. "Manicure agora" com 2 providers elegíveis na mesma cidade
    const manicureOffering1Id = 'offering-manicure-001';
    const manicureOffering2Id = 'offering-manicure-002';

    this.serviceOfferings.set(manicureOffering1Id, {
      offering_id: manicureOffering1Id,
      storeId: 'store-001',
      templateId: 'beauty-service',
      price: { amountCents: 30.00, currency: 'BRL' },
      duration_minutes: 60,
      isActive: true,
    });

    this.serviceOfferings.set(manicureOffering2Id, {
      offering_id: manicureOffering2Id,
      storeId: 'store-002',
      templateId: 'beauty-service',
      price: { amountCents: 35.00, currency: 'BRL' },
      duration_minutes: 60,
      isActive: true,
    });

    // Disponibilidade para manicure (todos os dias, 8h-20h)
    const allWeekdays = [0, 1, 2, 3, 4, 5, 6];
    this.serviceAvailabilities.set(manicureOffering1Id, allWeekdays.map(w => ({
      offering_id: manicureOffering1Id,
      weekday: w,
      starts_at: '08:00',
      ends_at: '20:00',
      capacity: 5,
    })));

    this.serviceAvailabilities.set(manicureOffering2Id, allWeekdays.map(w => ({
      offering_id: manicureOffering2Id,
      weekday: w,
      starts_at: '08:00',
      ends_at: '20:00',
      capacity: 5,
    })));

    // Marcar providers como online
    this.providerOnlineStatus.set('store-001', true);
    this.providerOnlineStatus.set('store-002', true);

    // 2. "Combo limpeza + caixa d'água" com allow_multiple_providers=true
    const limpezaOfferingId = 'offering-limpeza-001';
    const caixaAguaOfferingId = 'offering-caixa-agua-001';

    this.serviceOfferings.set(limpezaOfferingId, {
      offering_id: limpezaOfferingId,
      storeId: 'store-001',
      templateId: 'cleaning-service',
      price: { amountCents: 150.00, currency: 'BRL' },
      duration_minutes: 120,
      isActive: true,
    });

    this.serviceOfferings.set(caixaAguaOfferingId, {
      offering_id: caixaAguaOfferingId,
      storeId: 'store-002',
      templateId: 'maintenance-service',
      price: { amountCents: 200.00, currency: 'BRL' },
      duration_minutes: 90,
      isActive: true,
    });

    // Disponibilidade para limpeza e caixa d'água (segunda a sexta, 8h-18h)
    const weekdays = [1, 2, 3, 4, 5];
    this.serviceAvailabilities.set(limpezaOfferingId, weekdays.map(w => ({
      offering_id: limpezaOfferingId,
      weekday: w,
      starts_at: '08:00',
      ends_at: '18:00',
      capacity: 3,
    })));

    this.serviceAvailabilities.set(caixaAguaOfferingId, weekdays.map(w => ({
      offering_id: caixaAguaOfferingId,
      weekday: w,
      starts_at: '08:00',
      ends_at: '18:00',
      capacity: 2,
    })));

    marketplaceLogger.init('Exemplos de serviços seeded para orquestrador', {
      manicure_offerings: 2,
      combo_offerings: 2,
    });
  }

  // ============================================================
  // SUBSCRIPTIONS (ASSINATURAS E RECORRÊNCIA) — estado no sub-service
  // ============================================================

  /**
   * Criar nova assinatura
   */
  async createSubscription(tenantId: string, input: {
    type: 'product' | 'service' | 'mixed';
    billingCycle: 'weekly' | 'monthly' | 'yearly';
    starts_at: string;
    linked_entities: {
      products?: Array<{ productId: string; storeId: string; quantity: number }>;
      service_offerings?: Array<{ offering_id: string; storeId: string; quantity: number }>;
    };
    customer_id: string;
    storeId: string;
    payment_method: 'balance' | 'card' | 'invoice';
    attribution_id?: string;
  }): Promise<Subscription> {
    return this.subscriptionsService.createSubscription(tenantId, input);
  }

  /**
   * Buscar assinatura por ID
   */
  getSubscription(subscriptionId: string): Subscription | null {
    return this.subscriptionsService.getSubscription(subscriptionId);
  }

  /**
   * Listar assinaturas de um cliente
   */
  getCustomerSubscriptions(customerId: string): Subscription[] {
    return this.subscriptionsService.getCustomerSubscriptions(customerId);
  }

  /**
   * Listar assinaturas de uma loja
   */
  getStoreSubscriptions(storeId: string): Subscription[] {
    return this.subscriptionsService.getStoreSubscriptions(storeId);
  }

  /**
   * Pausar assinatura (não retroativo)
   */
  pauseSubscription(subscriptionId: string): Subscription {
    return this.subscriptionsService.pauseSubscription(subscriptionId);
  }

  /**
   * Retomar assinatura pausada
   */
  resumeSubscription(subscriptionId: string): Subscription {
    return this.subscriptionsService.resumeSubscription(subscriptionId);
  }

  /**
   * Cancelar assinatura (não retroativo, apenas ciclos futuros)
   */
  cancelSubscription(subscriptionId: string): Subscription {
    return this.subscriptionsService.cancelSubscription(subscriptionId);
  }

  /**
   * Gerar ciclo de cobrança para uma assinatura
   * Cria Order → Checkout → PaymentPlan (reutiliza lógica existente)
   */
  async generateSubscriptionCycle(
    tenantId: string,
    userId: string,
    subscriptionId: string
  ): Promise<{
    cycle: SubscriptionCycle;
    order: Order;
    checkout: CheckoutIntent;
    paymentPlan: PaymentPlan;
  }> {
    return this.subscriptionsService.generateSubscriptionCycle(tenantId, userId, subscriptionId);
  }

  /**
   * Buscar ciclos de uma assinatura
   */
  getSubscriptionCycles(subscriptionId: string): SubscriptionCycle[] {
    return this.subscriptionsService.getSubscriptionCycles(subscriptionId);
  }

  /**
   * Buscar ciclo por ID
   */
  getSubscriptionCycle(cycleId: string): SubscriptionCycle | null {
    return this.subscriptionsService.getSubscriptionCycle(cycleId);
  }

  // ============================================================
  // INDÚSTRIA, DISTRIBUIÇÃO REGIONAL E DROPSHIP
  // ============================================================

  /**
   * Industry Accounts (in-memory)
   * Armazena contas de indústrias
   */
  private industryAccounts: Map<string, IndustryAccount> = new Map();

  /**
   * Distribution Hubs (in-memory)
   * Armazena hubs de distribuição regional
   */
  private distributionHubs: Map<string, DistributionHub> = new Map();

  /**
   * Criar conta de indústria
   */
  createIndustryAccount(input: {
    name: string;
    cnpj: string;
    categoriesSupported: string[];
    defaultMarginRules: {
      hubMarginPercentage: number;
      storeMarginPercentage: number;
      minimumPrice?: number;
    };
    authorizedHubs?: string[];
  }): IndustryAccount {
    const industryId = `industry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const industry: IndustryAccount = {
      industryId: industryId,
      name: input.name,
      cnpj: input.cnpj,
      categoriesSupported: input.categoriesSupported,
      defaultMarginRules: {
        hubMarginPercentage: input.defaultMarginRules.hubMarginPercentage,
        storeMarginPercentage: input.defaultMarginRules.storeMarginPercentage,
        minimumPrice: input.defaultMarginRules.minimumPrice,
      },
      authorizedHubs: input.authorizedHubs || [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.industryAccounts.set(industryId, industry);

    marketplaceLogger.init('Industry account criada', { industryId: industryId });

    return industry;
  }

  /**
   * Buscar indústria por ID
   */
  getIndustryAccount(industryId: string): IndustryAccount | null {
    return this.industryAccounts.get(industryId) || null;
  }

  /**
   * Listar todas as indústrias ativas
   */
  getIndustryAccounts(): IndustryAccount[] {
    return Array.from(this.industryAccounts.values())
      .filter(i => i.isActive);
  }

  /**
   * Criar hub de distribuição
   */
  createDistributionHub(input: {
    industryId: string;
    name: string;
    location: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    };
    supportedProducts: string[];
    fulfillmentType: 'pickup' | 'delivery' | 'mixed';
    margin_override?: {
      percentage?: number;
      fixed_amount?: number;
    };
    logisticsProfile: {
      defaultEtaMinutes: number;
      supportedVehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
      costPerKm?: number;
      baseCost?: number;
    };
  }): DistributionHub {
    // Validar que a indústria existe
    const industry = this.industryAccounts.get(input.industryId);
    if (!industry) {
      throw new Error('Indústria não encontrada');
    }

    const hubId = `hub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const hub: DistributionHub = {
      hubId: hubId,
      industryId: input.industryId,
      name: input.name,
      location: input.location,
      supportedProducts: input.supportedProducts,
      fulfillmentType: input.fulfillmentType,
      marginOverride: input.margin_override,
      logisticsProfile: {
        defaultEtaMinutes: input.logisticsProfile.defaultEtaMinutes,
        supportedVehicles: input.logisticsProfile.supportedVehicles,
        costPerKm: input.logisticsProfile.costPerKm,
        baseCost: input.logisticsProfile.baseCost,
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.distributionHubs.set(hubId, hub);

    // Adicionar hub à lista de hubs autorizados da indústria
    if (!industry.authorizedHubs.includes(hubId)) {
      industry.authorizedHubs.push(hubId);
      industry.updatedAt = new Date().toISOString();
    }

    marketplaceLogger.init('Distribution hub criado', { hubId: hubId, industryId: input.industryId });

    return hub;
  }

  /**
   * Buscar hub por ID
   */
  getDistributionHub(hubId: string): DistributionHub | null {
    return this.distributionHubs.get(hubId) || null;
  }

  /**
   * Buscar hubs de uma indústria
   */
  getIndustryHubs(industryId: string): DistributionHub[] {
    return Array.from(this.distributionHubs.values())
      .filter(h => h.industryId === industryId && h.isActive);
  }

  /**
   * Buscar hub mais próximo para um produto industrial em uma região
   * (simplificado: retorna primeiro hub ativo que suporta o produto)
   */
  findHubForProduct(productId: string, city: string, state: string): DistributionHub | null {
    const hubs = Array.from(this.distributionHubs.values())
      .filter(h => 
        h.isActive &&
        h.supportedProducts.includes(productId) &&
        h.location.city === city &&
        h.location.state === state
      );

    // Retornar primeiro hub encontrado (sem cálculo de distância)
    return hubs[0] || null;
  }

  /**
   * Criar PaymentPlan com splits de indústria e hub (dropship)
   * Reutiliza lógica existente, apenas adiciona novos tipos de split
   */
  createPaymentPlanWithDropship(
    checkoutId: string,
    method: 'balance' | 'card' | 'invoice',
    dropshipItems: Array<{
      productId: string;
      industryId: string;
      hubId: string;
      storeId: string;
      quantity: number;
      unitPrice: number;
    }>
  ): PaymentPlan {
    const checkout = this.getCheckout(checkoutId);
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    if (checkout.status !== 'confirmed') {
      throw new Error('Checkout precisa estar confirmado para criar payment plan');
    }

    // 🔴 CORREÇÃO INSTITUCIONAL: Removido cálculo inline de splits
    // Splits são calculados EXCLUSIVAMENTE via bank-split-engine.service.ts
    // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seções 12.1 e 12.3)
    // e FEATURE_MARKETPLACE_MULTI_VENDOR.md (invariantes institucionais)
    
    // Criar PaymentPlan base (reutiliza lógica existente)
    const paymentPlanId = `payment-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // PaymentPlan agora é apenas declarativo (sem splits calculados)
    // Splits serão calculados em executePaymentPlan via Core canônico
    // NOTA: Dropship (industry/hub) requer lógica específica que deve existir no engine/core
    // Se não existir, deve ser representada como metadata/context para o engine,
    // NUNCA como cálculo local no marketplace
    const paymentPlan: PaymentPlan = {
      paymentPlanId: paymentPlanId,
      checkoutId: checkoutId,
      method,
      totalCents: checkout.totalCents,
      splits: [], // Splits serão calculados via engine canônico em executePaymentPlan
      status: 'calculated',
    };

    this.paymentPlans.set(paymentPlanId, paymentPlan);

    marketplaceLogger.init('PaymentPlan criado com dropship', {
      paymentPlanId: paymentPlanId,
      dropship_items: dropshipItems.length,
    });

    return paymentPlan;
  }

  /**
   * Criar DeliveryOrder a partir de um hub (dropship)
   */
  createDeliveryFromHub(
    checkoutId: string,
    hubId: string,
    storeId: string
  ): DeliveryOrder {
    const hub = this.distributionHubs.get(hubId);
    if (!hub) {
      throw new Error('Hub não encontrado');
    }

    if (!hub.isActive) {
      throw new Error('Hub não está ativo');
    }

    const checkout = this.getCheckout(checkoutId);
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    // Validar que checkout está pago
    if ((checkout as any).status !== 'paid' && (checkout as any).status !== 'invoiced') {
      throw new Error('Checkout precisa estar pago para criar entrega via hub');
    }

    const deliveryId = `delivery-hub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Usar perfil de logística do hub
    const rawVehicle = hub.logisticsProfile.supportedVehicles[0] || 'car';
    const defaultVehicle: 'bike' | 'moto' | 'car' | 'van' = rawVehicle === 'truck' ? 'van' : (rawVehicle === 'bike' || rawVehicle === 'moto' || rawVehicle === 'car' || rawVehicle === 'van' ? rawVehicle : 'car');
    const baseCost = hub.logisticsProfile.baseCost || 10.00;

    const delivery: DeliveryOrder = {
      deliveryId,
      checkoutId,
      storeId,
      type: hub.fulfillmentType === 'pickup' ? 'own' : 'third_party',
      vehicle: defaultVehicle,
      etaMinutes: hub.logisticsProfile.defaultEtaMinutes,
      cost: {
        amountCents: Math.round(baseCost * 100),
        currency: 'BRL',
        payer: 'buyer',
      },
      status: 'created',
    };

    // Adicionar metadados de hub (não quebra contrato)
    (delivery as any).hub_id = hubId;
    (delivery as any).fulfillment_by = 'hub';

    this.deliveries.set(deliveryId, delivery);

    marketplaceLogger.init('Delivery criado via hub', {
      delivery_id: deliveryId,
      hubId: hubId,
      storeId: storeId,
    });

    return delivery;
  }

  // ============================================================
  // GOVERNANÇA, SLA, REPUTAÇÃO E RISCO
  // ============================================================

  /**
   * SLA Contracts (in-memory)
   * Armazena contratos de SLA por ator
   */
  private slaContracts: Map<string, SLAContract> = new Map();

  /**
   * Reputation Snapshots (in-memory, imutáveis)
   * Armazena snapshots mensais de reputação
   */
  private reputationSnapshots: Map<string, ReputationSnapshot[]> = new Map(); // actor_id -> snapshots[]

  /**
   * Dispute Cases (in-memory)
   * Armazena casos de disputa
   */
  private disputeCases: Map<string, DisputeCase> = new Map();

  /**
   * Order Events (para tracking de SLA)
   * Armazena eventos de pedidos para cálculo de métricas
   */
  private orderEvents: Map<string, Array<{
    orderId: string;
    actorId: string;
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    eventType: 'created' | 'fulfilled' | 'cancelled' | 'disputed' | 'delivered';
    timestamp: string;
    fulfillmentTimeHours?: number;
  }>> = new Map(); // actor_id -> events[]

  /**
   * Criar contrato de SLA
   */
  createSLAContract(input: {
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    actorId: string;
    metrics: {
      fulfillmentTime: { targetHours: number; maxHours: number };
      cancellationRate: { targetPercentage: number; maxPercentage: number };
      disputeRate: { targetPercentage: number; maxPercentage: number };
    };
    thresholds: {
      warning: {
        fulfillmentTimeHours: number;
        cancellationRatePercentage: number;
        disputeRatePercentage: number;
      };
      violation: {
        fulfillmentTimeHours: number;
        cancellationRatePercentage: number;
        disputeRatePercentage: number;
      };
    };
    penalties: {
      fulfillmentTimeViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
      cancellationRateViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
      disputeRateViolation: { type: 'percentage' | 'fixed'; valueCents: number; redirectTo: 'regional_fund' | 'customer' | 'platform' };
    };
  }): SLAContract {
    const slaId = `sla-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sla: SLAContract = {
      slaId: slaId,
      actorType: input.actorType,
      actorId: input.actorId,
      metrics: {
        fulfillmentTime: { ...input.metrics.fulfillmentTime, unit: 'hours' },
        cancellationRate: { ...input.metrics.cancellationRate, unit: 'percentage' },
        disputeRate: { ...input.metrics.disputeRate, unit: 'percentage' },
      },
      thresholds: input.thresholds,
      penalties: input.penalties,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.slaContracts.set(slaId, sla);

    marketplaceLogger.init('SLA contract criado', { slaId: slaId, actorId: input.actorId });

    return sla;
  }

  /**
   * Buscar SLA por ID
   */
  getSLAContract(slaId: string): SLAContract | null {
    return this.slaContracts.get(slaId) || null;
  }

  /**
   * Buscar SLA por ator
   */
  getSLAContractByActor(actorId: string, actorType: 'store' | 'hub' | 'industry' | 'service_provider'): SLAContract | null {
    for (const sla of this.slaContracts.values()) {
      if (sla.actorId === actorId && sla.actorType === actorType && sla.isActive) {
        return sla;
      }
    }
    return null;
  }

  /**
   * Registrar evento de pedido (para tracking de SLA)
   */
  recordOrderEvent(input: {
    orderId: string;
    actorId: string;
    actorType: 'store' | 'hub' | 'industry' | 'service_provider';
    eventType: 'created' | 'fulfilled' | 'cancelled' | 'disputed' | 'delivered';
    fulfillmentTimeHours?: number;
  }): void {
    const events = this.orderEvents.get(input.actorId) || [];
    
    events.push({
      ...input,
      timestamp: new Date().toISOString(),
    });

    this.orderEvents.set(input.actorId, events);

    marketplaceLogger.init('Order event registrado', {
      actorId: input.actorId,
      eventType: input.eventType,
    });
  }

  /**
   * Gerar Reputation Snapshot mensal (imutável)
   * Cálculo determinístico e auditável
   */
  generateReputationSnapshot(
    actorId: string,
    actorType: 'store' | 'hub' | 'industry' | 'service_provider',
    year: number,
    month: number
  ): ReputationSnapshot {
    // Verificar se snapshot já existe (imutável)
    const existingSnapshots = this.reputationSnapshots.get(actorId) || [];
    const existing = existingSnapshots.find(
      s => s.period.year === year && s.period.month === month
    );

    if (existing) {
      throw new Error(`Snapshot já existe para ${year}-${month}. Snapshots são imutáveis.`);
    }

    // Buscar eventos do período
    const events = this.orderEvents.get(actorId) || [];
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    const periodEvents = events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= periodStart && eventDate <= periodEnd;
    });

    // Calcular métricas (determinísticas)
    const totalOrders = periodEvents.filter(e => e.eventType === 'created').length;
    const fulfilledOrders = periodEvents.filter(e => e.eventType === 'fulfilled' || e.eventType === 'delivered').length;
    const cancelledOrders = periodEvents.filter(e => e.eventType === 'cancelled').length;
    const disputedOrders = periodEvents.filter(e => e.eventType === 'disputed').length;

    const fulfillmentTimes = periodEvents
      .filter(e => e.fulfillmentTimeHours !== undefined)
      .map(e => e.fulfillmentTimeHours!);

    const averageFulfillmentTime = fulfillmentTimes.length > 0
      ? fulfillmentTimes.reduce((sum, t) => sum + t, 0) / fulfillmentTimes.length
      : 0;

    const cancellationRate = totalOrders > 0
      ? (cancelledOrders / totalOrders) * 100
      : 0;

    const disputeRate = totalOrders > 0
      ? (disputedOrders / totalOrders) * 100
      : 0;

    const onTimeDeliveries = periodEvents.filter(e => {
      if (e.eventType !== 'delivered' || !e.fulfillmentTimeHours) return false;
      const sla = this.getSLAContractByActor(actorId, actorType);
      if (!sla) return false;
      return e.fulfillmentTimeHours <= sla.metrics.fulfillmentTime.targetHours;
    }).length;

    const onTimeDeliveryPercentage = fulfilledOrders > 0
      ? (onTimeDeliveries / fulfilledOrders) * 100
      : 0;

    // Buscar SLA do ator
    const sla = this.getSLAContractByActor(actorId, actorType);

    // Calcular score (determinístico)
    const baseScore = 100;
    let fulfillmentPenalty = 0;
    let cancellationPenalty = 0;
    let disputePenalty = 0;

    if (sla) {
      // Penalidade por atraso
      if (averageFulfillmentTime > sla.metrics.fulfillmentTime.targetHours) {
        const excessHours = averageFulfillmentTime - sla.metrics.fulfillmentTime.targetHours;
        fulfillmentPenalty = Math.min(excessHours * 2, 30); // Máximo 30 pontos
      }

      // Penalidade por cancelamento
      if (cancellationRate > sla.metrics.cancellationRate.targetPercentage) {
        const excessRate = cancellationRate - sla.metrics.cancellationRate.targetPercentage;
        cancellationPenalty = Math.min(excessRate * 5, 30); // Máximo 30 pontos
      }

      // Penalidade por disputa
      if (disputeRate > sla.metrics.disputeRate.targetPercentage) {
        const excessRate = disputeRate - sla.metrics.disputeRate.targetPercentage;
        disputePenalty = Math.min(excessRate * 10, 40); // Máximo 40 pontos
      }
    }

    const finalScore = Math.max(0, baseScore - fulfillmentPenalty - cancellationPenalty - disputePenalty);

    // Determinar status de SLA
    const getSLAStatus = (valueCents: number, warning: number, violation: number): 'compliant' | 'warning' | 'violation' => {
      if (valueCents <= warning) return 'compliant';
      if (valueCents <= violation) return 'warning';
      return 'violation';
    };

    const fulfillmentTimeStatus = sla
      ? getSLAStatus(
          averageFulfillmentTime,
          sla.thresholds.warning.fulfillmentTimeHours,
          sla.thresholds.violation.fulfillmentTimeHours
        )
      : 'compliant';

    const cancellationRateStatus = sla
      ? getSLAStatus(
          cancellationRate,
          sla.thresholds.warning.cancellationRatePercentage,
          sla.thresholds.violation.cancellationRatePercentage
        )
      : 'compliant';

    const disputeRateStatus = sla
      ? getSLAStatus(
          disputeRate,
          sla.thresholds.warning.disputeRatePercentage,
          sla.thresholds.violation.disputeRatePercentage
        )
      : 'compliant';

    const overallStatus: 'compliant' | 'warning' | 'violation' =
      fulfillmentTimeStatus === 'violation' || cancellationRateStatus === 'violation' || disputeRateStatus === 'violation'
        ? 'violation'
        : fulfillmentTimeStatus === 'warning' || cancellationRateStatus === 'warning' || disputeRateStatus === 'warning'
        ? 'warning'
        : 'compliant';

    const snapshot: ReputationSnapshot = {
      snapshotId: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actorId: actorId,
      actorType: actorType,
      period: { year, month },
      metrics: {
        totalOrders,
        fulfilledOrders,
        cancelledOrders,
        disputedOrders,
        averageFulfillmentTimeHours: averageFulfillmentTime,
        cancellationRatePercentage: cancellationRate,
        disputeRatePercentage: disputeRate,
        onTimeDeliveryPercentage: onTimeDeliveryPercentage,
      },
      score: {
        baseScore: baseScore,
        fulfillmentPenalty,
        cancellationPenalty,
        disputePenalty,
        finalScore: finalScore,
      },
      slaStatus: {
        fulfillmentTime: fulfillmentTimeStatus,
        cancellationRate: cancellationRateStatus,
        disputeRate: disputeRateStatus,
        overall: overallStatus,
      },
      createdAt: new Date().toISOString(),
    };

    existingSnapshots.push(snapshot);
    this.reputationSnapshots.set(actorId, existingSnapshots);

    marketplaceLogger.init('Reputation snapshot gerado', {
      snapshotId: snapshot.snapshotId,
      actorId: actorId,
      period: `${year}-${month}`,
    });

    return snapshot;
  }

  /**
   * Buscar snapshots de reputação de um ator
   */
  getReputationSnapshots(actorId: string): ReputationSnapshot[] {
    return this.reputationSnapshots.get(actorId) || [];
  }

  /**
   * Buscar snapshot específico
   */
  getReputationSnapshot(snapshotId: string): ReputationSnapshot | null {
    for (const snapshots of this.reputationSnapshots.values()) {
      const snapshot = snapshots.find(s => s.snapshotId === snapshotId);
      if (snapshot) return snapshot;
    }
    return null;
  }

  /**
   * Aplicar penalidades de SLA ao PaymentPlan
   * Retorna PaymentPlan atualizado com penalidades aplicadas
   */
  applySLAPenaltiesToPaymentPlan(paymentPlanId: string): PaymentPlan {
    const paymentPlan = this.paymentPlans.get(paymentPlanId);
    if (!paymentPlan) {
      throw new Error('Payment plan não encontrado');
    }

    const checkout = this.getCheckout(paymentPlan.checkoutId);
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    // Buscar SLAs dos atores envolvidos
    const actorSlas = new Map<string, SLAContract>();

    for (const order of checkout.orders) {
      // Buscar SLA da loja
      const storeSLA = this.getSLAContractByActor(order.storeId, 'store');
      if (storeSLA) {
        actorSlas.set(`store-${order.storeId}`, storeSLA);
      }

      // Buscar snapshots recentes para verificar violações
      const storeSnapshots = this.getReputationSnapshots(order.storeId);
      const latestSnapshot = storeSnapshots[storeSnapshots.length - 1];

      if (latestSnapshot && latestSnapshot.slaStatus.overall === 'violation') {
        const sla = actorSlas.get(`store-${order.storeId}`);
        if (sla) {
          // Aplicar penalidades
          const penaltySplits: Array<{
            type: 'seller' | 'platform' | 'affiliate' | 'regional_fund' | 'industry' | 'hub';
            targetId: string;
            amountCents: number;
            currency: string;
          }> = [];

          // 🔴 CORREÇÃO INSTITUCIONAL: Penalidades via NOVA transação (append-only)
          // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seção 12.1: splits são imutáveis)
          // PROIBIDO: modificar splits existentes (sellerSplit.amount -= penaltyAmount)
          // OBRIGATÓRIO: criar NOVA transação de penalidade via Core canônico
          
          // Buscar split do seller para calcular penalidade base
          // NOTA: Este split é apenas para cálculo, não será modificado
          const sellerSplit = paymentPlan.splits.find(s => s.type === 'seller' && s.targetId === order.storeId);
          if (sellerSplit && sellerSplit.amountCents > 0) {
            let penaltyAmount = 0;

            // Calcular penalidade total (baseado no split original, não modificado)
            if (latestSnapshot.slaStatus.fulfillmentTime === 'violation') {
              if (sla.penalties.fulfillmentTimeViolation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.fulfillmentTimeViolation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.fulfillmentTimeViolation.valueCents;
              }
            }

            if (latestSnapshot.slaStatus.cancellationRate === 'violation') {
              if (sla.penalties.cancellationRateViolation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.cancellationRateViolation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.cancellationRateViolation.valueCents;
              }
            }

            if (latestSnapshot.slaStatus.disputeRate === 'violation') {
              if (sla.penalties.disputeRateViolation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.disputeRateViolation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.disputeRateViolation.valueCents;
              }
            }

            // Limitar penalidade ao valor do split original
            penaltyAmount = Math.min(penaltyAmount, sellerSplit.amountCents);

            if (penaltyAmount > 0) {
              // Registrar penalidade para criação de nova transação via Core
              // NOTA: A transação será criada em executePaymentPlan ou método dedicado
              // Por enquanto, apenas registrar metadata para processamento posterior
              penaltySplits.push({
                type: sla.penalties.fulfillmentTimeViolation.redirectTo === 'regional_fund' ? 'regional_fund' : 'platform',
                targetId: sla.penalties.fulfillmentTimeViolation.redirectTo,
                amountCents: penaltyAmount,
                currency: 'BRL',
              });

              // Marcar payment plan com metadata de penalidade pendente
              (paymentPlan as any).pending_penalties = (paymentPlan as any).pending_penalties || [];
              (paymentPlan as any).pending_penalties.push({
                storeId: order.storeId,
                penalty_amount: penaltyAmount,
                redirect_to: sla.penalties.fulfillmentTimeViolation.redirectTo,
                sla_violations: {
                  fulfillmentTime: latestSnapshot.slaStatus.fulfillmentTime === 'violation',
                  cancellationRate: latestSnapshot.slaStatus.cancellationRate === 'violation',
                  disputeRate: latestSnapshot.slaStatus.disputeRate === 'violation',
                },
              });
            }
          }
        }
      }
    }

    // NOTA: Não recalcular total aqui
    // Penalidades serão aplicadas via NOVA transação em executePaymentPlan ou método dedicado
    // Total do payment plan permanece inalterado (penalidades são transações separadas)

    // Marcar como atualizado
    (paymentPlan as any).sla_penalties_applied = true;

    marketplaceLogger.init('SLA penalties aplicadas ao payment plan', {
      paymentPlanId: paymentPlanId,
    });

    return paymentPlan;
  }

  /**
   * Criar caso de disputa
   */
  createDisputeCase(input: {
    orderId: string;
    checkoutId?: string;
    actorInvolved: {
      actorId: string;
      actorType: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
      role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
    };
    type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
    description: string;
  }): DisputeCase {
    const disputeId = `dispute-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dispute: DisputeCase = {
      disputeId: disputeId,
      orderId: input.orderId,
      checkoutId: input.checkoutId,
      actorInvolved: input.actorInvolved,
      type: input.type,
      status: 'open',
      description: input.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.disputeCases.set(disputeId, dispute);

    // Registrar evento de disputa
    this.recordOrderEvent({
      orderId: input.orderId,
      actorId: input.actorInvolved.actorId,
      actorType: input.actorInvolved.actorType === 'customer' ? 'store' : input.actorInvolved.actorType,
      eventType: 'disputed',
    });

    marketplaceLogger.init('Dispute case criado', { disputeId: disputeId });

    return dispute;
  }

  /**
   * Resolver caso de disputa
   * Gera novo lançamento no ledger (não reescreve)
   */
  async resolveDisputeCase(
    tenantId: string,
    disputeId: string,
    resolution: {
      resolutionType: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
      amountCents: number;
      currency?: string;
      resolvedBy: string;
      notes?: string;
    }
  ): Promise<DisputeCase> {
    const dispute = this.disputeCases.get(disputeId);
    if (!dispute) {
      throw new Error('Dispute case não encontrado');
    }

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new Error('Dispute case já foi resolvido ou rejeitado');
    }

    dispute.status = 'resolved';
    dispute.resolution = {
      resolutionType: resolution.resolutionType,
      amountCents: resolution.amountCents,
      currency: resolution.currency,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date().toISOString(),
      notes: resolution.notes,
    };
    dispute.updatedAt = new Date().toISOString();

    this.disputeCases.set(disputeId, dispute);

    marketplaceLogger.init('Dispute case resolvido', { disputeId: disputeId });

    return dispute;
  }

  /**
   * Buscar dispute case por ID
   */
  getDisputeCase(disputeId: string): DisputeCase | null {
    return this.disputeCases.get(disputeId) || null;
  }

  /**
   * Buscar disputes de um pedido
   */
  getDisputesByOrder(orderId: string): DisputeCase[] {
    return Array.from(this.disputeCases.values())
      .filter(d => d.orderId === orderId);
  }

  // ============================================================
  // INCENTIVOS ECONÔMICOS DIRECIONADOS
  // ============================================================

  /**
   * Incentive Rules (in-memory, imutáveis)
   * Armazena regras de incentivo por região
   */
  private incentiveRules: Map<string, IncentiveRule> = new Map(); // rule_id -> rule

  /**
   * Incentive Grants (in-memory, imutáveis)
   * Armazena concessões de incentivo
   */
  private incentiveGrants: IncentiveGrant[] = [];

  /**
   * Criar regra de incentivo
   */
  async createIncentiveRule(input: {
    tenantId: string;
    region: { country: string; state: string; city: string };
    incentiveType: 'delivery' | 'onboarding' | 'service' | 'logistics';
    maxAmountCents: number;
    maxPerActor: number;
    maxPerPeriod: number;
    requiresTrustLevel: 'L2' | 'L3' | 'L4' | 'L5';
  }): Promise<IncentiveRule> {
    // Validar que região desbloqueou incentive via regras regionais persistidas
    const unlockedIncentive = await regionalActivationService.getUnlockedIncentive(input.tenantId, input.region);
    if (!unlockedIncentive) {
      throw new Error('Região não desbloqueou incentivos via snapshot de impacto');
    }

    const ruleId = `incentive-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const rule: IncentiveRule = {
      ruleId: ruleId,
      region: input.region,
      incentiveType: input.incentiveType,
      maxAmountCents: input.maxAmountCents,
      maxPerActor: input.maxPerActor,
      maxPerPeriod: input.maxPerPeriod,
      currency: 'BRL',
      requiresTrustLevel: input.requiresTrustLevel,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.incentiveRules.set(ruleId, rule);

    marketplaceLogger.init('Regra de incentivo criada', {
      ruleId: ruleId,
      region: `${input.region.city}, ${input.region.state}`,
      incentiveType: input.incentiveType,
    });

    return rule;
  }

  /**
   * Conceder incentivo (reduz custo real)
   */
  async grantIncentive(tenantId: string, input: {
    ruleId: string;
    actorId: string;
    actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
    amountCents: number;
    reference: {
      order_id?: string;
      delivery_id?: string;
      subscription_id?: string;
      onboarding_id?: string;
    };
  }): Promise<IncentiveGrant> {
    const rule = this.incentiveRules.get(input.ruleId);
    if (!rule) {
      throw new Error('Regra de incentivo não encontrada');
    }

    if (rule.status !== 'active') {
      throw new Error('Regra de incentivo não está ativa');
    }

    const identity = await economicIdentityService.getEconomicIdentity(tenantId, input.actorId);
    if (!identity) {
      throw new Error('Identidade econômica não encontrada para o ator');
    }

    const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    const requiredLevel = trustLevels[rule.requiresTrustLevel] || 0;
    const actorLevel = trustLevels[identity.trustLevel] || 0;

    if (actorLevel < requiredLevel) {
      throw new Error(
        `Trust level insuficiente. Requerido: ${rule.requiresTrustLevel}, Atual: ${identity.trustLevel}`
      );
    }

    // Validar limites
    if (input.amountCents > rule.maxAmountCents) {
      throw new Error(`Valor excede máximo permitido. Máximo: ${rule.maxAmountCents}, Solicitado: ${input.amountCents}`);
    }

    // Validar limite por ator (período atual)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const actorGrants = this.incentiveGrants.filter(g => {
      if (g.actorId !== input.actorId || g.ruleId !== input.ruleId || g.status !== 'consumed') {
        return false;
      }
      const grantDate = new Date(g.grantedAt);
      return grantDate.getMonth() === currentMonth && grantDate.getFullYear() === currentYear;
    });

    const actorTotal = actorGrants.reduce((sum, g) => sum + g.amountCents, 0);
    if (actorTotal + input.amountCents > rule.maxPerActor) {
      throw new Error(
        `Limite por ator excedido. Limite: ${rule.maxPerActor}, Já usado: ${actorTotal}, Solicitado: ${input.amountCents}`
      );
    }

    // Validar limite por período (região)
    const regionGrants = this.incentiveGrants.filter(g => {
      if (
        g.region.country !== rule.region.country ||
        g.region.state !== rule.region.state ||
        g.region.city !== rule.region.city ||
        g.ruleId !== input.ruleId ||
        g.status !== 'consumed'
      ) {
        return false;
      }
      const grantDate = new Date(g.grantedAt);
      return grantDate.getMonth() === currentMonth && grantDate.getFullYear() === currentYear;
    });

    const regionTotal = regionGrants.reduce((sum, g) => sum + g.amountCents, 0);
    if (regionTotal + input.amountCents > rule.maxPerPeriod) {
      throw new Error(
        `Limite por período excedido. Limite: ${rule.maxPerPeriod}, Já usado: ${regionTotal}, Solicitado: ${input.amountCents}`
      );
    }

    const regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, rule.region);
    if (!regionalFund) {
      throw new Error('Fundo regional não encontrado para a região');
    }

    if (regionalFund.balance < input.amountCents) {
      throw new Error(
        `Fundo regional sem saldo suficiente. Saldo: ${regionalFund.balance}, Solicitado: ${input.amountCents}`
      );
    }

    const grantId = `incentive-grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const ref = input.reference as { order_id?: string; delivery_id?: string; subscription_id?: string; onboarding_id?: string };
    const grant: IncentiveGrant = {
      grantId,
      ruleId: input.ruleId,
      actorId: input.actorId,
      actorType: input.actorType,
      region: rule.region,
      incentiveType: rule.incentiveType,
      amountCents: input.amountCents,
      currency: rule.currency,
      reference: {
        orderId: ref?.order_id,
        deliveryId: ref?.delivery_id,
        subscriptionId: ref?.subscription_id,
        onboardingId: ref?.onboarding_id,
      },
      status: 'granted',
      grantedAt: new Date().toISOString(),
    };

    this.incentiveGrants.push(grant);

    this.recordIncentiveGrantedEvent(grant, rule);

    marketplaceLogger.init('Incentivo concedido', {
      grantId,
      ruleId: input.ruleId,
      actorId: input.actorId,
      amountCents: input.amountCents,
    });

    return grant;
  }

  /**
   * Consumir incentivo (debita fundo regional e marca como consumido)
   */
  async consumeIncentive(tenantId: string, grantId: string): Promise<void> {
    const grant = this.incentiveGrants.find(g => g.grantId === grantId);
    if (!grant) {
      throw new Error('Grant de incentivo não encontrado');
    }

    if (grant.status !== 'granted') {
      throw new Error(`Grant já foi ${grant.status}`);
    }

    const rule = this.incentiveRules.get(grant.ruleId);
    if (!rule) {
      throw new Error('Regra de incentivo não encontrada');
    }

    const regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, grant.region);
    if (!regionalFund) {
      throw new Error('Fundo regional não encontrado');
    }

    try {
      const allocation = await regionalFundService.allocateRegionalFund(tenantId, {
        regional_fund_id: regionalFund.regionalFundId,
        type: 'incentive',
        target_actorId: grant.actorId,
        target_actorType: grant.actorType,
        amountCents: grant.amountCents,
        reason: `Incentivo ${grant.incentiveType} para ${grant.actorId}`,
        reference: {
          orderId: grant.reference.orderId,
          delivery_id: grant.reference.deliveryId,
          subscription_id: grant.reference.subscriptionId,
        },
      });

      if (allocation.status === 'approved') {
        await regionalFundService.executeAllocation(tenantId, allocation.allocation_id);
      }

      grant.status = 'consumed';
      grant.consumedAt = new Date().toISOString();

      marketplaceLogger.init('Incentivo consumido', {
        grant_id: grantId,
        amountCents: grant.amountCents,
      });
    } catch (err) {
      marketplaceLogger.error('Erro ao consumir incentivo', err);
      throw err;
    }
  }

  /**
   * Registrar evento econômico de incentivo concedido
   */
  private recordIncentiveGrantedEvent(grant: IncentiveGrant, rule: IncentiveRule): void {
    this.generateEconomicEvent({
      type: 'regional_fund_allocation', // Reutiliza tipo existente
      region: grant.region,
      actorId: grant.actorId,
      actorType: grant.actorType,
      reference_id: grant.grantId,
      amountCents: grant.amountCents,
      currency: grant.currency,
      visibility: 'public', // Incentivo é público
    });
  }

  /**
   * Buscar incentivos disponíveis para um ator em uma região
   */
  async getAvailableIncentives(
    tenantId: string,
    actorId: string,
    region: { country: string; state: string; city: string }
  ): Promise<Array<{
    ruleId: string;
    incentiveType: 'delivery' | 'onboarding' | 'service' | 'logistics';
    maxAmountCents: number;
    maxPerActor: number;
    requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
    availableAmountCents: number;
  }>> {
    const unlockedIncentive = await regionalActivationService.getUnlockedIncentive(tenantId, region);
    if (!unlockedIncentive) {
      return [];
    }

    const identity = await economicIdentityService.getEconomicIdentity(tenantId, actorId);
    if (!identity) {
      return [];
    }

    const applicableRules = Array.from(this.incentiveRules.values()).filter(rule => {
      if (rule.status !== 'active') {
        return false;
      }

      if (
        rule.region.country !== region.country ||
        rule.region.state !== region.state ||
        rule.region.city !== region.city
      ) {
        return false;
      }

      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[rule.requiresTrustLevel] || 0;
      const actorLevel = trustLevels[identity.trustLevel] || 0;

      return actorLevel >= requiredLevel;
    });

    // Calcular disponibilidade por regra
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return applicableRules.map(rule => {
      const actorGrants = this.incentiveGrants.filter(g => {
        if (g.actorId !== actorId || g.ruleId !== rule.ruleId || g.status !== 'consumed') {
          return false;
        }
        const grantDate = new Date(g.grantedAt);
        return grantDate.getMonth() === currentMonth && grantDate.getFullYear() === currentYear;
      });

      const actorUsed = actorGrants.reduce((sum, g) => sum + g.amountCents, 0);
      const availableAmountCents = Math.max(0, rule.maxPerActor - actorUsed);

      return {
        ruleId: rule.ruleId,
        incentiveType: rule.incentiveType,
        maxAmountCents: rule.maxAmountCents,
        maxPerActor: rule.maxPerActor,
        requires_trust_level: rule.requiresTrustLevel,
        availableAmountCents: Math.min(availableAmountCents, rule.maxAmountCents),
      };
    });
  }

  // ============================================================
  // SISTEMA DE CONTRATOS COMERCIAIS B2B ENTRE ATORES
  // ============================================================

  private readonly b2bService = new MarketplaceB2BService(this);
  private readonly subscriptionsService = new MarketplaceSubscriptionsService(this);

  /**
   * Criar contrato comercial B2B (rascunho)
   */
  async createB2BContract(tenantId: string, input: {
    supplierId: string;
    supplierType: 'store' | 'hub' | 'industry';
    buyerId: string;
    buyerType: 'store' | 'hub';
    region: { country: string; state: string; city: string };
    products: Array<{
      productId: string;
      name: string;
      unitPrice: number;
      currency: string;
      minimumQuantity: number;
      maximumQuantity?: number;
    }>;
    terms: {
      volumeCommitment: number;
      deliverySchedule: 'weekly' | 'monthly' | 'quarterly';
      paymentTerms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
      penaltyRate?: number;
    };
    startDate: string;
    endDate: string;
  }): Promise<B2BCommercialContract> {
    return this.b2bService.createB2BContract(tenantId, input);
  }

  /**
   * Assinar contrato B2B (ativa contrato)
   */
  signB2BContract(contractId: string): B2BCommercialContract {
    return this.b2bService.signB2BContract(contractId);
  }

  /**
   * Executar contrato B2B (cria Order e PaymentPlan)
   */
  async executeB2BContract(input: {
    contractId: string;
    products: Array<{
      productId: string;
      quantity: number;
    }>;
    deliveredAt: string;
  }): Promise<B2BContractExecution> {
    return this.b2bService.executeB2BContract(input);
  }

  /**
   * Calcular data de vencimento baseado em payment_terms
   */
  private calculatePaymentDueDate(paymentTerms: string, baseDate: string): string {
    const base = new Date(baseDate);
    let days = 0;

    switch (paymentTerms) {
      case 'prepaid':
        days = 0; // Vencimento imediato
        break;
      case 'net_15':
        days = 15;
        break;
      case 'net_30':
        days = 30;
        break;
      case 'net_60':
        days = 60;
        break;
      default:
        days = 30;
    }

    const dueDate = new Date(base);
    dueDate.setDate(dueDate.getDate() + days);

    return dueDate.toISOString();
  }

  /**
   * Aplicar multa por atraso de pagamento
   */
  applyContractPenalty(executionId: string): B2BContractExecution {
    return this.b2bService.applyContractPenalty(executionId);
  }

  /**
   * Marcar execução como entregue
   */
  markExecutionDelivered(executionId: string): void {
    this.b2bService.markExecutionDelivered(executionId);
  }

  /**
   * Marcar execução como paga
   */
  markExecutionPaid(executionId: string): void {
    this.b2bService.markExecutionPaid(executionId);
  }

  /**
   * Verificar execuções em atraso (chamado periodicamente)
   */
  checkOverdueExecutions(): void {
    this.b2bService.checkOverdueExecutions();
  }

  /**
   * Buscar contratos de um ator
   */
  getB2BContractsByActor(actorId: string, role: 'supplier' | 'buyer'): B2BCommercialContract[] {
    return this.b2bService.getB2BContractsByActor(actorId, role);
  }

  /**
   * Buscar execuções de um contrato
   */
  getB2BContractExecutions(contractId: string): B2BContractExecution[] {
    return this.b2bService.getB2BContractExecutions(contractId);
  }

  // ============================================================
  // SISTEMA DE CONSCIÊNCIA DE CUSTO E SUSTENTABILIDADE ECONÔMICA
  // ============================================================

  /**
   * Operational Cost Profiles (in-memory, opt-in, privado) — LEGADO (actor + period)
   * Armazena perfis de custo operacional
   */
  private legacyOperationalCostProfiles: Map<string, LegacyOperationalCostProfile> = new Map(); // profile_id -> profile

  /**
   * Economic Sustainability Snapshots (in-memory, imutáveis)
   * Armazena snapshots de sustentabilidade econômica
   */
  private economicSustainabilitySnapshots: Map<string, EconomicSustainabilitySnapshot> = new Map(); // snapshot_id -> snapshot

  /**
   * Criar perfil de custo operacional (opt-in, privado) — LEGADO
   */
  createLegacyOperationalCostProfile(input: {
    actorId: string;
    actorType: 'store' | 'service_provider';
    period: { year: number; month: number };
    fixed_costs: {
      rent?: number;
      utilities?: number;
      internet?: number;
      salaries?: number;
      taxes?: number;
      other?: number;
    };
    variable_costs: Array<{
      product_id?: string;
      service_id?: string;
      cost_per_unit: number;
      currency: string;
    }>;
    declared_volume_expectation?: number;
  }): LegacyOperationalCostProfile {
    const profileId = `cost-profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const profile: LegacyOperationalCostProfile = {
      profile_id: profileId,
      actorId: input.actorId,
      actorType: input.actorType,
      period: input.period,
      fixed_costs: input.fixed_costs,
      variable_costs: input.variable_costs,
      declared_volume_expectation: input.declared_volume_expectation,
      currency: input.variable_costs[0]?.currency || 'BRL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.legacyOperationalCostProfiles.set(profileId, profile);

    marketplaceLogger.init('Perfil de custo operacional criado', {
      profile_id: profileId,
      actorId: input.actorId,
      period: `${input.period.month}/${input.period.year}`,
    });

    return profile;
  }

  /**
   * Buscar perfil de custo operacional — LEGADO (actor + period)
   */
  getLegacyOperationalCostProfile(actorId: string, period: { year: number; month: number }): LegacyOperationalCostProfile | null {
    for (const profile of this.legacyOperationalCostProfiles.values()) {
      if (
        profile.actorId === actorId &&
        profile.period.year === period.year &&
        profile.period.month === period.month
      ) {
        return profile;
      }
    }
    return null;
  }

  /**
   * Atualizar perfil de custo operacional (opt-in, privado) — LEGADO
   */
  updateLegacyOperationalCostProfile(profileId: string, input: {
    fixed_costs?: {
      rent?: number;
      utilities?: number;
      internet?: number;
      salaries?: number;
      taxes?: number;
      other?: number;
    };
    variable_costs?: Array<{
      product_id?: string;
      service_id?: string;
      cost_per_unit: number;
      currency: string;
    }>;
    declared_volume_expectation?: number;
  }): LegacyOperationalCostProfile {
    const profile = this.legacyOperationalCostProfiles.get(profileId);
    if (!profile) {
      throw new Error('Perfil de custo não encontrado');
    }

    if (input.fixed_costs) {
      profile.fixed_costs = { ...profile.fixed_costs, ...input.fixed_costs };
    }

    if (input.variable_costs) {
      profile.variable_costs = input.variable_costs;
    }

    if (input.declared_volume_expectation !== undefined) {
      profile.declared_volume_expectation = input.declared_volume_expectation;
    }

    profile.updatedAt = new Date().toISOString();
    this.legacyOperationalCostProfiles.set(profileId, profile);

    marketplaceLogger.init('Perfil de custo operacional atualizado', { profile_id: profileId });

    return profile;
  }

  /**
   * Gerar snapshot de sustentabilidade econômica (imutável, 1 por período)
   */
  generateEconomicSustainabilitySnapshot(
    actorId: string,
    period: { year: number; month: number }
  ): EconomicSustainabilitySnapshot {
    // Verificar se snapshot já existe (imutável)
    const existingSnapshot = Array.from(this.economicSustainabilitySnapshots.values()).find(
      s =>
        s.actorId === actorId &&
        s.period.year === period.year &&
        s.period.month === period.month
    );

    if (existingSnapshot) {
      throw new Error(
        `Snapshot já existe para ${actorId} - ${period.month}/${period.year}. ` +
        `Snapshots são imutáveis. Para corrigir, gere um novo período.`
      );
    }

    // Buscar perfil de custo
    const profile = this.getLegacyOperationalCostProfile(actorId, period);
    if (!profile) {
      throw new Error('Perfil de custo operacional não encontrado para o período especificado');
    }

    // Calcular métricas
    const totalFixedCost = this.calculateTotalFixedCost(profile);
    const averageVariableCost = this.calculateAverageVariableCost(profile);
    const averagePrice = this.calculateAveragePrice(actorId, period);
    const breakEvenVolume = this.calculateBreakEvenPoint(totalFixedCost, averagePrice, averageVariableCost);
    const currentMarginPercentage = this.calculateMargin(averagePrice, averageVariableCost);
    const sustainabilityStatus = this.determineSustainabilityStatus(currentMarginPercentage);
    const calculationExplanation = this.generateCalculationExplanation(
      totalFixedCost,
      averageVariableCost,
      averagePrice,
      breakEvenVolume,
      currentMarginPercentage,
      sustainabilityStatus
    );

    const snapshotId = `sustainability-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const snapshot: EconomicSustainabilitySnapshot = {
      snapshotId: snapshotId,
      actorId: actorId,
      actorType: profile.actorType,
      period,
      totalFixedCost: totalFixedCost,
      averageVariableCost: averageVariableCost,
      averagePrice: averagePrice,
      breakEvenVolume: breakEvenVolume,
      currentMarginPercentage: currentMarginPercentage,
      sustainabilityStatus: sustainabilityStatus,
      calculationExplanation: calculationExplanation,
      currency: profile.currency,
      createdAt: new Date().toISOString(),
    };

    this.economicSustainabilitySnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de sustentabilidade econômica gerado', {
      snapshotId: snapshotId,
      actorId: actorId,
      period: `${period.month}/${period.year}`,
    });

    return snapshot;
  }

  /**
   * Calcular total de custos fixos (legado)
   */
  private calculateTotalFixedCost(profile: LegacyOperationalCostProfile): number {
    const costs = profile.fixed_costs;
    return (
      (costs.rent || 0) +
      (costs.utilities || 0) +
      (costs.internet || 0) +
      (costs.salaries || 0) +
      (costs.taxes || 0) +
      (costs.other || 0)
    );
  }

  /**
   * Calcular custo variável médio (legado)
   */
  private calculateAverageVariableCost(profile: LegacyOperationalCostProfile): number {
    if (profile.variable_costs.length === 0) {
      return 0;
    }

    const totalCost = profile.variable_costs.reduce((sum, vc) => sum + vc.cost_per_unit, 0);
    return totalCost / profile.variable_costs.length;
  }

  /**
   * Calcular preço médio praticado (baseado em vendas reais)
   */
  private calculateAveragePrice(actorId: string, period: { year: number; month: number }): number {
    // Buscar orders do período
    const startDate = new Date(period.year, period.month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59, 999);

    const periodOrders = Array.from(this.orders.values()).filter(order => {
      if (order.storeId !== actorId) {
        return false;
      }

      // Orders não têm createdAt; evento de pedido não persistido (FASE X: economic_identity_events é por ator, não por order)
      const orderEvents: Array<{ reference_id?: string; type?: string; createdAt?: string }> = [];

      if (orderEvents.length === 0) {
        return false;
      }

      const eventDate = new Date(orderEvents[0].createdAt);
      return eventDate >= startDate && eventDate <= endDate;
    });

    if (periodOrders.length === 0) {
      // Se não houver vendas, usar preço médio dos produtos ativados
      const storesData = this.getStores();
      const store = storesData.stores.find(s => s.storeId === actorId);
      if (store) {
        // Simplificado: retornar valor padrão se não houver vendas
        return 50; // Valor padrão para cálculo
      }
      return 0;
    }

    // Calcular preço médio por item
    let totalPrice = 0;
    let totalItems = 0;

    for (const order of periodOrders) {
      for (const item of order.items) {
        totalPrice += item.price.amountCents;
        totalItems += item.quantity;
      }
    }

    return totalItems > 0 ? totalPrice / totalItems : 0;
  }

  /**
   * Calcular ponto de equilíbrio (determinístico)
   */
  private calculateBreakEvenPoint(
    totalFixedCost: number,
    averagePrice: number,
    averageVariableCost: number
  ): number {
    if (averagePrice <= averageVariableCost) {
      return Infinity; // Nunca atinge ponto de equilíbrio
    }

    const contributionMargin = averagePrice - averageVariableCost;
    return Math.ceil(totalFixedCost / contributionMargin);
  }

  /**
   * Calcular margem atual (determinístico)
   */
  private calculateMargin(averagePrice: number, averageVariableCost: number): number {
    if (averagePrice === 0) {
      return 0;
    }

    return ((averagePrice - averageVariableCost) / averagePrice) * 100;
  }

  /**
   * Determinar status de sustentabilidade (regras fixas e explícitas)
   */
  private determineSustainabilityStatus(marginPercentage: number): 'healthy' | 'warning' | 'critical' {
    if (marginPercentage >= 20) {
      return 'healthy';
    } else if (marginPercentage >= 5) {
      return 'warning';
    } else {
      return 'critical';
    }
  }

  /**
   * Gerar explicação do cálculo (texto canônico, determinístico)
   */
  private generateCalculationExplanation(
    totalFixedCost: number,
    averageVariableCost: number,
    averagePrice: number,
    breakEvenVolume: number,
    currentMarginPercentage: number,
    sustainabilityStatus: 'healthy' | 'warning' | 'critical'
  ): string {
    let statusText = '';
    switch (sustainabilityStatus) {
      case 'healthy':
        statusText = 'Seu negócio está operando com margem saudável (≥20%).';
        break;
      case 'warning':
        statusText = 'Sua margem está abaixo do ideal (5-20%). Considere revisar custos ou preços.';
        break;
      case 'critical':
        statusText = 'Sua margem está crítica (<5%). Risco operacional alto.';
        break;
    }

    return (
      `Custos fixos mensais: ${totalFixedCost.toFixed(2)}. ` +
      `Custo variável médio: ${averageVariableCost.toFixed(2)}. ` +
      `Preço médio praticado: ${averagePrice.toFixed(2)}. ` +
      `Ponto de equilíbrio: ${breakEvenVolume} unidades/mês. ` +
      `Margem atual: ${currentMarginPercentage.toFixed(2)}%. ` +
      statusText
    );
  }

  /**
   * Buscar snapshots de sustentabilidade de um ator
   */
  getEconomicSustainabilitySnapshots(actorId: string): EconomicSustainabilitySnapshot[] {
    return Array.from(this.economicSustainabilitySnapshots.values())
      .filter(s => s.actorId === actorId)
      .sort((a, b) => {
        // Ordenar por período (mais recente primeiro)
        if (a.period.year !== b.period.year) {
          return b.period.year - a.period.year;
        }
        return b.period.month - a.period.month;
      });
  }

  /**
   * Buscar snapshot mais recente de um ator
   */
  getLatestEconomicSustainabilitySnapshot(actorId: string): EconomicSustainabilitySnapshot | null {
    const snapshots = this.getEconomicSustainabilitySnapshots(actorId);
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  // ============================================================
  // COMPRA COLETIVA PROGRAMADA E LOTES DE PRODUÇÃO COMPROMETIDOS
  // ============================================================

  /**
   * Production Batches (in-memory)
   * Armazena lotes de produção programados
   */
  private productionBatches: Map<string, ProductionBatch> = new Map(); // batch_id -> batch

  /**
   * Batch Commitments (in-memory)
   * Armazena compromissos de compra em lotes
   */
  private batchCommitments: BatchCommitment[] = []; // Array de compromissos

  /**
   * Criar lote de produção programado
   */
  createProductionBatch(input: {
    industryId: string;
    productId: string;
    minQuantity: number;
    maxQuantity?: number;
    unitPrice: { amountCents: number; currency: string };
    commitDeadline: string; // ISO 8601
    regionsAllowed: Array<{ country: string; state: string; city: string }>;
  }): ProductionBatch {
    // Validar que industry existe
    const industry = this.industryAccounts.get(input.industryId);
    if (!industry) {
      throw new Error('Indústria não encontrada');
    }

    // Validar que produto existe
    const canonicalProducts = this.getCanonicalProducts();
    const product = canonicalProducts.products.find(p => p.id === input.productId);
    if (!product) {
      throw new Error('Produto canônico não encontrado');
    }

    // Validar que produto é industrial (se campo existir)
    if ((product as any).product_type && (product as any).product_type !== 'industrial') {
      throw new Error('Apenas produtos industriais podem ter lotes de produção');
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const batch: ProductionBatch = {
      batchId: batchId,
      industryId: input.industryId,
      productId: input.productId,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      unitPrice: input.unitPrice,
      commitDeadline: input.commitDeadline,
      regionsAllowed: input.regionsAllowed,
      status: 'open',
      totalCommittedQuantity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.productionBatches.set(batchId, batch);

    marketplaceLogger.init('Lote de produção programado criado', {
      batchId: batchId,
      industryId: input.industryId,
      productId: input.productId,
      minQuantity: input.minQuantity,
    });

    return batch;
  }

  /**
   * Buscar lotes abertos por região
   */
  getOpenBatches(region: { country: string; state: string; city: string }): ProductionBatch[] {
    const now = new Date().toISOString();

    return Array.from(this.productionBatches.values())
      .filter(batch => {
        // Apenas lotes abertos
        if (batch.status !== 'open') {
          return false;
        }

        // Verificar se deadline não passou
        if (batch.commitDeadline < now) {
          return false;
        }

        // Verificar se região está permitida
        return batch.regionsAllowed.some(
          r =>
            r.country === region.country &&
            r.state === region.state &&
            r.city === region.city
        );
      })
      .sort((a, b) => {
        // Ordenar por deadline mais próximo primeiro
        return a.commitDeadline.localeCompare(b.commitDeadline);
      });
  }

  /**
   * Buscar lote por ID
   */
  getProductionBatch(batchId: string): ProductionBatch | null {
    return this.productionBatches.get(batchId) || null;
  }

  /**
   * Fazer compromisso em um lote
   */
  commitToBatch(input: {
    batchId: string;
    actorId: string;
    actorType: 'user' | 'store' | 'hub';
    quantity: number;
  }): BatchCommitment {
    const batch = this.productionBatches.get(input.batchId);
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Validar que lote está aberto
    if (batch.status !== 'open') {
      throw new Error('Lote não está aberto para compromissos');
    }

    // Validar que deadline não passou
    const now = new Date().toISOString();
    if (batch.commitDeadline < now) {
      throw new Error('Prazo para compromissos expirou');
    }

    // Validar quantidade máxima (se definida)
    const currentTotal = batch.totalCommittedQuantity;
    if (batch.maxQuantity && currentTotal + input.quantity > batch.maxQuantity) {
      throw new Error(
        `Quantidade máxima do lote seria excedida. Disponível: ${batch.maxQuantity - currentTotal}`
      );
    }

    // Validar quantidade mínima
    if (input.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    const commitmentId = `commitment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const commitment: BatchCommitment = {
      commitmentId: commitmentId,
      batchId: input.batchId,
      actorId: input.actorId,
      actorType: input.actorType,
      quantity: input.quantity,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.batchCommitments.push(commitment);

    // Atualizar quantidade total comprometida do lote
    batch.totalCommittedQuantity += input.quantity;
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(input.batchId, batch);

    marketplaceLogger.init('Compromisso de compra em lote criado', {
      commitmentId: commitmentId,
      batchId: input.batchId,
      actorId: input.actorId,
      quantity: input.quantity,
    });

    return commitment;
  }

  /**
   * Cancelar compromisso (antes do deadline)
   */
  cancelCommitment(commitmentId: string): BatchCommitment {
    const commitment = this.batchCommitments.find(c => c.commitmentId === commitmentId);
    if (!commitment) {
      throw new Error('Compromisso não encontrado');
    }

    // Validar que compromisso está ativo
    if (commitment.status !== 'active') {
      throw new Error('Compromisso não pode ser cancelado (já foi cancelado ou convertido)');
    }

    const batch = this.productionBatches.get(commitment.batchId);
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Validar que deadline não passou (pode cancelar antes do deadline)
    const now = new Date().toISOString();
    if (batch.commitDeadline < now) {
      throw new Error('Prazo para cancelamento expirou (lote já foi avaliado)');
    }

    // Atualizar compromisso
    commitment.status = 'cancelled';
    commitment.cancelledAt = new Date().toISOString();

    // Atualizar quantidade total comprometida do lote
    batch.totalCommittedQuantity -= commitment.quantity;
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(commitment.batchId, batch);

    marketplaceLogger.init('Compromisso de compra em lote cancelado', {
      commitmentId: commitmentId,
      batchId: commitment.batchId,
    });

    return commitment;
  }

  /**
   * Buscar compromissos de um lote
   */
  getBatchCommitments(batchId: string): BatchCommitment[] {
    return this.batchCommitments.filter(c => c.batchId === batchId);
  }

  /**
   * Buscar compromissos de um ator
   */
  getActorCommitments(actorId: string): BatchCommitment[] {
    return this.batchCommitments.filter(c => c.actorId === actorId && c.status === 'active');
  }

  /**
   * Avaliar lote no deadline (determinístico)
   * Deve ser chamado após o deadline passar
   */
  evaluateBatchAtDeadline(batchId: string): ProductionBatch {
    const batch = this.productionBatches.get(batchId);
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Validar que lote está aberto
    if (batch.status !== 'open') {
      throw new Error('Lote já foi avaliado ou não está aberto');
    }

    const now = new Date().toISOString();
    if (batch.commitDeadline >= now) {
      throw new Error('Deadline ainda não passou');
    }

    // Verificar se quantidade mínima foi atingida
    if (batch.totalCommittedQuantity < batch.minQuantity) {
      // Lote expira (não executa)
      batch.status = 'expired';
      batch.closedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      this.productionBatches.set(batchId, batch);

      marketplaceLogger.init('Lote de produção expirado (quantidade mínima não atingida)', {
        batchId: batchId,
        minQuantity: batch.minQuantity,
        committedQuantity: batch.totalCommittedQuantity,
      });
    } else {
      // Lote fecha (será executado)
      batch.status = 'closed';
      batch.closedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      this.productionBatches.set(batchId, batch);

      marketplaceLogger.init('Lote de produção fechado (quantidade mínima atingida)', {
        batchId: batchId,
        minQuantity: batch.minQuantity,
        committedQuantity: batch.totalCommittedQuantity,
      });
    }

    return batch;
  }

  /**
   * Converter lote fechado em Orders individuais
   * Cada compromisso vira um Order separado
   */
  convertBatchToOrders(batchId: string): Order[] {
    const batch = this.productionBatches.get(batchId);
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Validar que lote está fechado (não executado ainda)
    if (batch.status !== 'closed') {
      throw new Error('Lote deve estar fechado para ser convertido em orders');
    }

    // Buscar compromissos ativos do lote
    const activeCommitments = this.batchCommitments.filter(
      c => c.batchId === batchId && c.status === 'active'
    );

    if (activeCommitments.length === 0) {
      throw new Error('Nenhum compromisso ativo encontrado para o lote');
    }

    const orders: Order[] = [];

    // Criar Order para cada compromisso
    for (const commitment of activeCommitments) {
      // Determinar store_id baseado no tipo de ator
      let storeId: string;
      if (commitment.actorType === 'store') {
        storeId = commitment.actorId;
      } else if (commitment.actorType === 'hub') {
        // Hub pode atuar como store temporariamente
        storeId = commitment.actorId;
      } else {
        // User precisa de uma loja intermediária (usar primeira loja disponível)
        const storesData = this.getStores();
        const firstStore = storesData.stores[0];
        if (!firstStore) {
          throw new Error('Nenhuma loja disponível para processar pedido de usuário');
        }
        storeId = firstStore.storeId;
      }

      // Criar Order
      const order = this.createOrder(storeId);
      await this.addOrderItem(order.orderId, batch.productId, commitment.quantity);

      // Marcar compromisso como convertido
      commitment.status = 'converted';
      commitment.orderId = order.orderId;

      orders.push(order);

      marketplaceLogger.init('Compromisso convertido em Order', {
        commitmentId: commitment.commitmentId,
        orderId: order.orderId,
        batchId: batchId,
      });
    }

    // Marcar lote como executado
    batch.status = 'executed';
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(batchId, batch);

    // Registrar evento econômico (se método existir)
    const totalAmount = orders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => itemSum + item.subtotal, 0);
    }, 0);

    try {
      // Tentar usar método de geração de eventos se existir
      if (typeof (this as any).recordBatchExecutedEvent === 'function') {
        (this as any).recordBatchExecutedEvent(batch, totalAmount);
      }
    } catch (err) {
      // Ignorar se método não existir
      marketplaceLogger.init('Evento de batch executado não registrado (método não disponível)');
    }

    marketplaceLogger.init('Lote de produção convertido em Orders', {
      batchId: batchId,
      orders_count: orders.length,
      total_amount: totalAmount,
    });

    return orders;
  }

  /**
   * Buscar todos os lotes (para administração)
   */
  getAllProductionBatches(): ProductionBatch[] {
    return Array.from(this.productionBatches.values()).sort((a, b) => {
      // Ordenar por data de criação (mais recente primeiro)
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  // ============================================================
  // ONBOARDING UNIFICADO DE EMPRESAS + CONEXÃO AUTOMÁTICA
  // ============================================================

  /**
   * Company Plans (in-memory, estáticos)
   * Armazena planos disponíveis
   */
  private companyPlans: Map<string, CompanyPlan> = new Map(); // plan_id -> plan

  /**
   * Company Onboardings (in-memory)
   * Armazena processos de onboarding
   */
  private companyOnboardings: Map<string, CompanyOnboarding> = new Map(); // onboarding_id -> onboarding

  /**
   * Payment Terminals (in-memory)
   * Armazena maquininhas de pagamento
   */
  private paymentTerminals: Map<string, PaymentTerminal> = new Map(); // terminal_id -> terminal

  /**
   * Inicializar planos padrão
   */
  initializeCompanyPlans(): void {
    // Plano Básico (gratuito, default)
    const basicPlan: CompanyPlan = {
      planId: 'basic',
      name: 'basic',
      displayName: 'Básico',
      description: 'Plano básico gratuito com funcionalidades essenciais',
      capabilities: {
        maxStores: 1,
        maxBranches: 1,
        maxProducts: 50,
        maxServices: 10,
        maxMonthlyTransactions: 1000,
        b2bContractsEnabled: false,
        industryEnabled: false,
        hubEnabled: false,
        batchProductionEnabled: false,
        pdvEnabled: true,
        advancedAnalytics: false,
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Plano Profissional
    const professionalPlan: CompanyPlan = {
      planId: 'professional',
      name: 'professional',
      displayName: 'Profissional',
      description: 'Plano profissional com mais limites e capacidades',
      capabilities: {
        maxStores: 5,
        maxBranches: 10,
        maxProducts: 500,
        maxServices: 50,
        maxMonthlyTransactions: 10000,
        b2bContractsEnabled: true,
        industryEnabled: false,
        hubEnabled: false,
        batchProductionEnabled: false,
        pdvEnabled: true,
        advancedAnalytics: true,
      },
      price: {
        amountCents: 99.00,
        currency: 'BRL',
        billingCycle: 'monthly',
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Plano Industrial / Hub
    const industrialPlan: CompanyPlan = {
      planId: 'industrial',
      name: 'industrial',
      displayName: 'Industrial / Hub',
      description: 'Plano para indústrias e hubs com alto volume',
      capabilities: {
        maxStores: 20,
        maxBranches: 50,
        maxProducts: 10000,
        maxServices: 200,
        maxMonthlyTransactions: 1000000,
        b2bContractsEnabled: true,
        industryEnabled: true,
        hubEnabled: true,
        batchProductionEnabled: true,
        pdvEnabled: true,
        advancedAnalytics: true,
      },
      price: {
        amountCents: 499.00,
        currency: 'BRL',
        billingCycle: 'monthly',
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companyPlans.set('basic', basicPlan);
    this.companyPlans.set('professional', professionalPlan);
    this.companyPlans.set('industrial', industrialPlan);

    marketplaceLogger.init('Planos de empresa inicializados', {
      plans_count: 3,
    });
  }

  /**
   * Buscar plano por ID
   */
  getCompanyPlan(planId: string): CompanyPlan | null {
    return this.companyPlans.get(planId) || null;
  }

  /**
   * Buscar todos os planos
   */
  getAllCompanyPlans(): CompanyPlan[] {
    return Array.from(this.companyPlans.values());
  }

  /**
   * Criar processo de onboarding de empresa
   * 
   * ⚠️ LEGADO / NÃO UTILIZADO
   * Este método não está integrado ao fluxo canônico de criação de empresa.
   * O fluxo canônico é: POST /companies → createCompany()
   * 
   * Este método NÃO cria empresa nem actor.
   * Apenas armazena dados de onboarding em memória (não persistente).
   * 
   * @deprecated Use POST /companies para criar empresa
   */
  createCompanyOnboarding(input: {
    companyType: 'cnpj' | 'cpf' | 'mei';
    companyName: string;
    document: string;
    category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
    region: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
    };
    // OBRIGATÓRIO: Documentos
    documents: {
      cnpj?: string;
      qsaDocument?: string;
      lastContractualChange?: string;
      addressProof?: string;
    };
    // OBRIGATÓRIO: Conta bancária
    bankAccount: {
      type: 'unifibank' | 'external';
      accountId?: string;
      externalBankName?: string;
      externalAccountNumber?: string;
      isVerified: boolean;
    };
    marketplaceEnabled: boolean;
    servicesEnabled: boolean;
    productsEnabled: boolean;
    pdvEnabled: boolean;
    // OBRIGATÓRIO: Payment Infrastructure
    paymentInfrastructure: {
      acceptUnificard: boolean;
      acceptExternalGateway: boolean;
      externalGatewayProvider?: string;
    };
    planId?: string; // Default: 'basic'
  }): CompanyOnboarding {
    const onboardingId = `onboarding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const companyId = `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Validar plano (default: basic)
    const planId = input.planId || 'basic';
    const plan = this.getCompanyPlan(planId);
    if (!plan) {
      throw new Error(`Plano não encontrado: ${planId}`);
    }

    const onboarding: CompanyOnboarding = {
      onboardingId: onboardingId,
      companyId: companyId,
      companyType: input.companyType,
      companyName: input.companyName,
      document: input.document,
      category: input.category,
      region: input.region,
      documents: {
        cnpj: input.documents.cnpj,
        qsaDocument: input.documents.qsaDocument,
        lastContractualChange: input.documents.lastContractualChange,
        addressProof: input.documents.addressProof,
      },
      bankAccount: {
        type: input.bankAccount.type,
        accountId: input.bankAccount.accountId,
        externalBankName: input.bankAccount.externalBankName,
        externalAccountNumber: input.bankAccount.externalAccountNumber,
        isVerified: input.bankAccount.isVerified,
      },
      marketplaceEnabled: input.marketplaceEnabled,
      servicesEnabled: input.servicesEnabled,
      productsEnabled: input.productsEnabled,
      pdvEnabled: input.pdvEnabled,
      paymentInfrastructure: {
        acceptUnificard: input.paymentInfrastructure.acceptUnificard,
        acceptExternalGateway: input.paymentInfrastructure.acceptExternalGateway,
        externalGatewayProvider: input.paymentInfrastructure.externalGatewayProvider,
      },
      planId: planId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companyOnboardings.set(onboardingId, onboarding);

    marketplaceLogger.init('Processo de onboarding de empresa criado', {
      onboardingId: onboardingId,
      companyId: companyId,
      companyName: input.companyName,
    });

    return onboarding;
  }

  /**
   * Completar onboarding (conectar automaticamente ao ecossistema)
   * 
   * ⚠️ LEGADO / NÃO UTILIZADO
   * Este método não está integrado ao fluxo canônico de criação de empresa.
   * O fluxo canônico é: POST /companies → createCompany() → CompanyOnboardingWizard (frontend)
   * 
   * Este método NÃO cria empresa nem actor.
   * Apenas processa dados de onboarding em memória (não persistente).
   * 
   * @deprecated Use CompanyOnboardingWizard (frontend) que salva em company.metadata.onboarding
   */
  async completeCompanyOnboarding(tenantId: string, onboardingId: string): Promise<CompanyOnboarding> {
    const onboarding = this.companyOnboardings.get(onboardingId);
    if (!onboarding) {
      throw new Error('Onboarding não encontrado');
    }

    if (onboarding.status !== 'draft' && onboarding.status !== 'in_progress') {
      throw new Error('Onboarding já foi completado ou falhou');
    }

    // Validar campos obrigatórios
    if (onboarding.companyType === 'cnpj' && !onboarding.documents.cnpj) {
      throw new Error('CNPJ é obrigatório para empresas do tipo CNPJ');
    }

    if (!onboarding.documents.addressProof) {
      throw new Error('Comprovante de endereço é obrigatório');
    }

    if (!onboarding.bankAccount) {
      throw new Error('Conta bancária é obrigatória');
    }

    if (!onboarding.bankAccount.isVerified) {
      throw new Error('Conta bancária deve ser verificada antes de completar o onboarding');
    }

    if (!onboarding.paymentInfrastructure) {
      throw new Error('Configuração de infraestrutura de pagamento é obrigatória');
    }

    onboarding.status = 'in_progress';
    onboarding.updatedAt = new Date().toISOString();
    this.companyOnboardings.set(onboardingId, onboarding);

    try {
      let regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, onboarding.region);
      if (!regionalFund) {
        regionalFund = await regionalFundService.createRegionalFund(tenantId, {
          region: onboarding.region,
          rules: {
            min_reserve: 10000,
            max_monthly_outflow: 50000,
            allowed_uses: ['infrastructure', 'incentives', 'emergency'],
          },
          governance: {
            decision_maker: 'automatic',
            approval_required: false,
          },
        });
      }

      // 2. Criar EconomicIdentity automaticamente (FASE X — backing real)
      const economicIdentity = await economicIdentityService.createEconomicIdentity(tenantId, {
        actorId: onboarding.companyId,
        actorType: this.mapCategoryToActorType(onboarding.category),
        verified_assets: {
          documents_verified: true,
          bank_account_verified: onboarding.bankAccount.isVerified,
          company_verified: onboarding.companyType !== 'cpf',
        },
      });
      onboarding.economicIdentityId = economicIdentity.economicIdentityId;

      // 2. Criar Store/Branch se aplicável
      if (onboarding.marketplaceEnabled && (onboarding.category === 'product' || onboarding.category === 'hybrid')) {
        // Criar store no Marketplace
        const storesData = this.getStores();
        const newStoreId = `store-${onboarding.companyId}`;
        const newBranchId = `branch-${onboarding.companyId}-001`;

        // Adicionar store aos dados estáticos (simplificado - em produção seria via DB)
        // Por enquanto, apenas registrar IDs
        onboarding.storeId = newStoreId;
        onboarding.branchId = newBranchId;

        // Registrar evento de nova loja
        try {
          if (typeof (this as any).recordNewStoreOpenedEvent === 'function') {
            (this as any).recordNewStoreOpenedEvent({
              storeId: newStoreId,
              region: onboarding.region,
            });
          }
        } catch (err) {
          // Ignorar se método não existir
        }

        // Importar catálogo canônico e ativar operações se template foi escolhido
        if (onboarding.businessTemplateId) {
          try {
            // Registrar uso do template
            this.recordBusinessTemplateUsage(onboarding.businessTemplateId, onboarding.companyId);

            // Buscar BusinessTemplate
            const businessTemplate = this.getBusinessTemplate(onboarding.businessTemplateId);
            if (businessTemplate) {
              // Importar catálogo canônico
              const importResult = await this.importCanonicalCatalog(
                tenantId,
                onboarding.companyId,
                newStoreId,
                onboarding.businessTemplateId,
                { import_all: true }
              );

              // Atualizar estado de ativação
              this.updateCompanyActivationState(onboarding.companyId, {
                catalog_ready: importResult.imported_products > 0 || importResult.imported_services > 0,
                services_ready: importResult.imported_services > 0,
                agenda_configured: businessTemplate.operationalConfig.requiresAgenda,
                dispatch_enabled: businessTemplate.operationalConfig.supportsDispatch,
                quote_flow_enabled: businessTemplate.operationalConfig.supportsQuoteFlow,
                pdvEnabled: businessTemplate.operationalConfig.supportsPdv,
                b2b_enabled: businessTemplate.operationalConfig.supportsB2b,
              });

              marketplaceLogger.init('Catálogo canônico importado e operações ativadas durante onboarding', {
                companyId: onboarding.companyId,
                storeId: newStoreId,
                templateId: onboarding.businessTemplateId,
                imported_products: importResult.imported_products,
                imported_services: importResult.imported_services,
                operationalConfig: businessTemplate.operationalConfig,
              });
            }
          } catch (err) {
            // Log mas não falha o onboarding se importação falhar
            marketplaceLogger.error('Erro ao importar catálogo canônico durante onboarding', err);
          }
        }
      }

      // 3. Criar IndustryAccount se aplicável
      if (onboarding.category === 'industry' || onboarding.category === 'hybrid') {
        const industryAccount = this.createIndustryAccount({
          name: onboarding.companyName,
          cnpj: onboarding.document,
          categoriesSupported: [], // Será preenchido depois
          defaultMarginRules: {
            hubMarginPercentage: 500,
            storeMarginPercentage: 200,
          },
        });
        onboarding.industryAccountId = industryAccount.industryId;
      }

      // 4. Criar DistributionHub se aplicável
      if (onboarding.category === 'hub' || onboarding.category === 'hybrid') {
        const hub = this.createDistributionHub({
          industryId: onboarding.industryAccountId || onboarding.companyId,
          name: onboarding.companyName,
          location: onboarding.region,
          supportedProducts: [],
          fulfillmentType: 'delivery',
          margin_override: { percentage: 3 },
          logisticsProfile: { defaultEtaMinutes: 30, supportedVehicles: ['bike', 'moto', 'car', 'van'] },
        });
        onboarding.hubId = hub.hubId;
      }

      // 5. PaymentTerminal: não armazenado em CompanyOnboarding; criar via fluxo dedicado se necessário.

      // 6. Marcar onboarding como completado
      onboarding.status = 'completed';
      onboarding.completedAt = new Date().toISOString();
      onboarding.updatedAt = new Date().toISOString();
      this.companyOnboardings.set(onboardingId, onboarding);

      marketplaceLogger.init('Onboarding de empresa completado', {
        onboardingId: onboardingId,
        companyId: onboarding.companyId,
        economicIdentityId: onboarding.economicIdentityId,
      });

      return onboarding;
    } catch (error: any) {
      onboarding.status = 'failed';
      onboarding.updatedAt = new Date().toISOString();
      this.companyOnboardings.set(onboardingId, onboarding);

      marketplaceLogger.error('Erro ao completar onboarding', error);
      throw error;
    }
  }

  /**
   * Mapear categoria para tipo de ator
   */
  private mapCategoryToActorType(
    category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid'
  ): 'store' | 'service_provider' | 'industry' | 'hub' {
    switch (category) {
      case 'product':
        return 'store';
      case 'service':
        return 'service_provider';
      case 'industry':
        return 'industry';
      case 'hub':
        return 'hub';
      case 'hybrid':
        return 'store'; // Default para hybrid
    }
  }

  /**
   * Criar maquininha de pagamento
   */
  createPaymentTerminal(input: {
    companyId: string;
    terminalType: 'unified_card' | 'external';
    provider?: string;
  }): PaymentTerminal {
    const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Estrutura de taxas (determinística)
    const transactionFeeStructure = {
      baseRate: input.terminalType === 'unified_card' ? 2.5 : 3.0, // % da transação
      regionalFundPercentage: 0.5, // 0.5% da taxa vai para Fundo Regional
      platformPercentage: 1.0, // 1.0% da taxa vai para Plataforma
      referralPercentage: 0.2, // 0.2% da taxa vai para Indicação (se houver)
    };

    const terminal: PaymentTerminal = {
      terminalId: terminalId,
      companyId: input.companyId,
      terminalType: input.terminalType,
      provider: input.provider,
      status: 'requested',
      transactionFeeStructure: transactionFeeStructure,
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentTerminals.set(terminalId, terminal);

    marketplaceLogger.init('Maquininha de pagamento solicitada', {
      terminalId: terminalId,
      companyId: input.companyId,
      terminalType: input.terminalType,
    });

    return terminal;
  }

  /**
   * Aprovar maquininha de pagamento
   */
  approvePaymentTerminal(terminalId: string): PaymentTerminal {
    const terminal = this.paymentTerminals.get(terminalId);
    if (!terminal) {
      throw new Error('Maquininha não encontrada');
    }

    terminal.status = 'approved';
    terminal.approvedAt = new Date().toISOString();
    terminal.updatedAt = new Date().toISOString();
    this.paymentTerminals.set(terminalId, terminal);

    marketplaceLogger.init('Maquininha de pagamento aprovada', {
      terminalId: terminalId,
    });

    return terminal;
  }

  /**
   * Ativar maquininha de pagamento
   */
  async activatePaymentTerminal(tenantId: string, terminalId: string): Promise<PaymentTerminal> {
    const terminal = this.paymentTerminals.get(terminalId);
    if (!terminal) {
      throw new Error('Maquininha não encontrada');
    }

    if (terminal.status !== 'approved') {
      throw new Error('Maquininha deve ser aprovada antes de ser ativada');
    }

    terminal.status = 'active';
    terminal.activatedAt = new Date().toISOString();
    terminal.updatedAt = new Date().toISOString();
    this.paymentTerminals.set(terminalId, terminal);

    try {
      const regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, {
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
      });
      if (regionalFund) {
        await regionalFundService.recordRegionalFundCredit(tenantId, {
          regional_fund_id: regionalFund.regionalFundId,
          amountCents: 0,
          currency: 'BRL',
          source: 'payment_terminal_setup',
          reference_id: terminalId,
        });
      }
    } catch {
      marketplaceLogger.init('Evento de Fundo Regional não registrado (método não disponível)');
    }

    marketplaceLogger.init('Maquininha de pagamento ativada', {
      terminalId: terminalId,
    });

    return terminal;
  }

  /**
   * Buscar onboarding por ID
   */
  getCompanyOnboarding(onboardingId: string): CompanyOnboarding | null {
    return this.companyOnboardings.get(onboardingId) || null;
  }

  /**
   * Buscar terminal por ID
   */
  getPaymentTerminal(terminalId: string): PaymentTerminal | null {
    return this.paymentTerminals.get(terminalId) || null;
  }

  /**
   * Buscar terminais de uma empresa
   */
  getCompanyPaymentTerminals(companyId: string): PaymentTerminal[] {
    return Array.from(this.paymentTerminals.values()).filter(t => t.companyId === companyId);
  }

  // ============================================================
  // FECHAMENTO DO CICLO: ATIVAÇÃO ECONÔMICA + MONETIZAÇÃO
  // ============================================================

  /**
   * Payment Infrastructure Configs (in-memory)
   * Armazena configurações de infraestrutura de pagamento
   */
  private paymentInfrastructureConfigs: Map<string, PaymentInfrastructureConfig> = new Map(); // config_id -> config

  /**
   * Revenue Snapshots (in-memory, imutáveis)
   * Armazena snapshots mensais de receita por região
   */
  private revenueSnapshots: Map<string, RevenueSnapshot> = new Map(); // snapshot_id -> snapshot

  /**
   * Validar limites do plano da empresa
   */
  validateCompanyPlanLimits(
    companyId: string,
    action: 'create_store' | 'create_branch' | 'create_product' | 'create_service' | 'execute_transaction' | 'create_b2b' | 'create_industry' | 'create_hub' | 'create_batch',
    currentCount?: number
  ): { allowed: boolean; reason?: string; soft_block?: boolean } {
    // Buscar onboarding da empresa
    const onboarding = Array.from(this.companyOnboardings.values()).find(o => o.companyId === companyId);
    if (!onboarding) {
      return { allowed: false, reason: 'Empresa não encontrada' };
    }

    // Buscar plano
    const plan = this.getCompanyPlan(onboarding.planId);
    if (!plan) {
      return { allowed: false, reason: 'Plano não encontrado' };
    }

    // Validar limites específicos
    switch (action) {
      case 'create_store':
        if (currentCount !== undefined && plan.capabilities.maxStores && currentCount >= plan.capabilities.maxStores) {
          return { allowed: false, reason: `Limite de lojas atingido (${plan.capabilities.maxStores})`, soft_block: true };
        }
        break;

      case 'create_branch':
        if (currentCount !== undefined && plan.capabilities.maxBranches && currentCount >= plan.capabilities.maxBranches) {
          return { allowed: false, reason: `Limite de filiais atingido (${plan.capabilities.maxBranches})`, soft_block: true };
        }
        break;

      case 'create_product':
        if (currentCount !== undefined && plan.capabilities.maxProducts && currentCount >= plan.capabilities.maxProducts) {
          return { allowed: false, reason: `Limite de produtos atingido (${plan.capabilities.maxProducts})`, soft_block: true };
        }
        break;

      case 'create_service':
        if (currentCount !== undefined && plan.capabilities.maxServices && currentCount >= plan.capabilities.maxServices) {
          return { allowed: false, reason: `Limite de serviços atingido (${plan.capabilities.maxServices})`, soft_block: true };
        }
        break;

      case 'create_b2b':
        if (!plan.capabilities.b2bContractsEnabled) {
          return { allowed: false, reason: 'Contratos B2B não habilitados no plano atual' };
        }
        break;

      case 'create_industry':
        if (!plan.capabilities.industryEnabled) {
          return { allowed: false, reason: 'Produtos industriais não habilitados no plano atual' };
        }
        break;

      case 'create_hub':
        if (!plan.capabilities.hubEnabled) {
          return { allowed: false, reason: 'Hubs não habilitados no plano atual' };
        }
        break;

      case 'create_batch':
        if (!plan.capabilities.batchProductionEnabled) {
          return { allowed: false, reason: 'Lotes de produção não habilitados no plano atual' };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Criar configuração de infraestrutura de pagamento
   */
  createPaymentInfrastructureConfig(input: {
    companyId: string;
    acceptUnificard: boolean;
    acceptExternalGateway: boolean;
    externalGatewayProvider?: string;
  }): PaymentInfrastructureConfig {
    const configId = `payment-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Estrutura de taxas determinística
    const feeStructure = {
      transactionRate: input.acceptUnificard ? 2.5 : 3.0, // % sobre transação
      regionalFundPercentage: 0.5, // 0.5% da taxa vai para Fundo Regional
      platformPercentage: 1.0, // 1.0% da taxa vai para Plataforma
      infrastructurePercentage: 0.3, // 0.3% da taxa cobre infraestrutura (debitado do Fundo Regional)
      referralPercentage: 0.2, // 0.2% da taxa vai para Indicação/Grupo (se houver)
    };

    const config: PaymentInfrastructureConfig = {
      configId: configId,
      companyId: input.companyId,
      acceptUnificard: input.acceptUnificard,
      acceptExternalGateway: input.acceptExternalGateway,
      externalGatewayProvider: input.externalGatewayProvider,
      feeStructure: feeStructure,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentInfrastructureConfigs.set(configId, config);

    marketplaceLogger.init('Configuração de infraestrutura de pagamento criada', {
      configId: configId,
      companyId: input.companyId,
    });

    return config;
  }

  /**
   * Buscar configuração de infraestrutura de pagamento
   */
  getPaymentInfrastructureConfig(companyId: string): PaymentInfrastructureConfig | null {
    return Array.from(this.paymentInfrastructureConfigs.values()).find(c => c.companyId === companyId) || null;
  }

  /**
   * Gerar snapshot de receita mensal (imutável, 1 por período)
   */
  generateRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RevenueSnapshot {
    // Verificar se snapshot já existe (imutável)
    const existingSnapshot = Array.from(this.revenueSnapshots.values()).find(
      s =>
        s.region.country === region.country &&
        s.region.state === region.state &&
        s.region.city === region.city &&
        s.period.year === period.year &&
        s.period.month === period.month
    );

    if (existingSnapshot) {
      throw new Error(
        `Snapshot de receita já existe para ${region.city}/${region.state} - ${period.month}/${period.year}. ` +
        `Snapshots são imutáveis.`
      );
    }

    // Calcular receitas a partir de PaymentPlans executados, Subscriptions, B2B Contracts, etc.
    // Por enquanto, valores simplificados (em produção viriam de queries reais)
    const snapshotId = `revenue-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const snapshot: RevenueSnapshot = {
      snapshotId,
      region,
      period,
      revenues: {
        transaction: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
          infrastructureCostCents: 0,
        },
        b2b: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
        subscription: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
        terminal: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
          infrastructureCostCents: 0,
        },
        logistics: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
      },
      totalTransactedCents: 0,
      totalFeesCents: 0,
      totalPlatformRevenueCents: 0,
      totalRegionalFundRevenueCents: 0,
      totalInfrastructureCostCents: 0,
      totalIncentivesCents: 0,
      currency: 'BRL',
      createdAt: new Date().toISOString(),
    };

    this.revenueSnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de receita mensal gerado', {
      snapshotId: snapshotId,
      region: `${region.city}, ${region.state}`,
      period: `${period.month}/${period.year}`,
    });

    return snapshot;
  }

  /**
   * Buscar snapshot de receita
   */
  getRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RevenueSnapshot | null {
    return (
      Array.from(this.revenueSnapshots.values()).find(
        s =>
          s.region.country === region.country &&
          s.region.state === region.state &&
          s.region.city === region.city &&
          s.period.year === period.year &&
          s.period.month === period.month
      ) || null
    );
  }

  /**
   * Gerar fluxo financeiro regional (transparência total)
   */
  async getRegionalFinancialFlow(tenantId: string, region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): Promise<RegionalFinancialFlow> {
    const snapshot = this.getRevenueSnapshot(region, period);
    if (!snapshot) {
      throw new Error('Snapshot de receita não encontrado para o período especificado');
    }

    const regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, region);
    const fundBalance = regionalFund ? regionalFund.balance : 0;

    const flow: RegionalFinancialFlow = {
      region,
      period,
      totalTransactedCents: snapshot.totalTransactedCents,
      totalFeesCents: snapshot.totalFeesCents,
      regionalFund: {
        totalRevenueCents: snapshot.totalRegionalFundRevenueCents,
        infrastructureCostCents: snapshot.totalInfrastructureCostCents,
        netBalanceCents: snapshot.totalRegionalFundRevenueCents - snapshot.totalInfrastructureCostCents,
      },
      platform: {
        totalRevenueCents: snapshot.totalPlatformRevenueCents,
      },
      infrastructure: {
        totalCostCents: snapshot.totalInfrastructureCostCents,
        fundedByRegionalFundCents: snapshot.totalInfrastructureCostCents,
      },
      incentives: {
        totalGrantedCents: snapshot.totalIncentivesCents,
      },
      currency: snapshot.currency,
      generatedAt: new Date().toISOString(),
    };

    return flow;
  }

  // ============================================================
  // ORQUESTRADOR DE DEMANDA DE SERVIÇOS (AGORA / AGENDADO / COMBO)
  // ============================================================

  /**
   * Service Requests (in-memory)
   * Armazena requisições de serviços
   */
  private serviceRequests: Map<string, ServiceRequest> = new Map(); // requestId -> request

  /**
   * Service Dispatches (in-memory)
   * Armazena dispatches de requisições
   */
  private serviceDispatches: Map<string, ServiceDispatch> = new Map(); // dispatch_id -> dispatch

  /**
   * Provider Online Status (in-memory, mock)
   * Armazena status online dos providers
   */
  private providerOnlineStatus: Map<string, boolean> = new Map(); // provider_actor_id -> online

  /** Adapter de estado para o MarketplaceDispatchService (leitura/escrita sem dependência circular) */
  private get dispatchStateAdapter(): IDispatchStateReader & IProviderOnlineWriter {
    return {
      getServiceDispatch: (id) => this.serviceDispatches.get(id) ?? null,
      getAllServiceDispatches: () => this.serviceDispatches.values(),
      getServiceRequest: (id) => this.serviceRequests.get(id) ?? null,
      getServiceAvailabilities: (id) => this.serviceAvailabilities.get(id),
      getPreReservationsByDispatch: (id) => this.getPreReservationsByDispatch(id),
      getOrderEvents: (actorId) => this.orderEvents.get(actorId) || [],
      setOrderEvents: (actorId, events) => this.orderEvents.set(actorId, events),
      setProviderOnlineStatus: (id, online) => this.providerOnlineStatus.set(id, online),
    };
  }

  private readonly dispatchService = new MarketplaceDispatchService(this.dispatchStateAdapter);

  /**
   * Criar requisição de serviço
   * Com proteções anti-spam
   */
  createServiceRequest(input: {
    requesterActorId: string;
    city: string;
    neighborhood?: string;
    intent: 'now' | 'scheduled' | 'bundle';
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    schedule: {
      mode: 'now' | 'scheduled';
      maxWaitMinutes?: number;
      date?: string;
      timeWindowMinutes?: number;
    };
    constraints: {
      providerRadiusMode: 'same_neighborhood' | 'same_city';
      minTrustLevelRequired: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
      allowMultipleProviders: boolean;
    };
  }): ServiceRequest {
    // Validar intent
    if (input.intent === 'scheduled' && !input.schedule.date) {
      throw new Error('Data é obrigatória para intent=scheduled');
    }

    if (input.intent === 'now' && !input.schedule.maxWaitMinutes) {
      throw new Error('max_wait_minutes é obrigatório para intent=now');
    }

    // Validar serviceItems
    for (const item of input.serviceItems) {
      const offering = this.serviceOfferings.get(item.offeringId);
      if (!offering) {
        throw new Error(`Service offering não encontrado: ${item.offeringId}`);
      }

      if (!offering.isActive) {
        throw new Error(`Service offering não está ativo: ${item.offeringId}`);
      }

      if (item.quantity <= 0) {
        throw new Error('Quantidade deve ser maior que zero');
      }
    }

    // Validar scheduled (data futura)
    if (input.intent === 'scheduled' && input.schedule.date) {
      const scheduledDate = new Date(input.schedule.date);
      const now = new Date();
      if (scheduledDate <= now) {
        throw new Error('Data agendada deve ser futura');
      }
    }

    // Verificar anti-spam
    if (!this.checkAntiSpam(input.requesterActorId, input.serviceItems)) {
      throw new Error('Múltiplas requests simultâneas iguais detectadas. Aguarde alguns minutos.');
    }

    const requestId = `service-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: ServiceRequest = {
      requestId: requestId,
      requesterActorId: input.requesterActorId,
      city: input.city,
      neighborhood: input.neighborhood,
      intent: input.intent,
      serviceItems: input.serviceItems,
      schedule: {
        mode: input.schedule.mode,
        maxWaitMinutes: input.schedule.maxWaitMinutes,
        date: input.schedule.date,
        timeWindowMinutes: input.schedule.timeWindowMinutes,
      },
      constraints: {
        providerRadiusMode: input.constraints.providerRadiusMode,
        minTrustLevelRequired: input.constraints.minTrustLevelRequired,
        allowMultipleProviders: input.constraints.allowMultipleProviders,
      },
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    this.serviceRequests.set(requestId, request);

    // Registrar no histórico do usuário (anti-spam)
    const userHistory = this.userRequestHistory.get(input.requesterActorId) || [];
    userHistory.push({
      requestId: requestId,
      serviceItems: input.serviceItems,
      createdAt: new Date().toISOString(),
    });
    this.userRequestHistory.set(input.requesterActorId, userHistory);

    // Registrar evento econômico (restricted)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_request_created',
          region: { country: 'BR', state: 'PR', city: input.city },
          actorId: input.requesterActorId,
          actorType: 'user',
          reference_id: requestId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Requisição de serviço criada', {
      requestId: requestId,
      intent: input.intent,
      items_count: input.serviceItems.length,
    });

    return request;
  }

  /**
   * Listar providers elegíveis (determinístico)
   */
  async listEligibleServiceProviders(tenantId: string, requestId: string): Promise<Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
  }>> {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const candidates: Array<{
      providerActorId: string;
      offeringId: string;
      eligibilityReason: string;
      reputation_score?: number;
    }> = [];

    for (const item of request.serviceItems) {
      const offering = this.serviceOfferings.get(item.offeringId);
      if (!offering) {
        continue;
      }

      const providersWithOffering = Array.from(this.serviceOfferings.entries())
        .filter(([offeringKey, o]) => offeringKey === item.offeringId && o.isActive)
        .map(([, o]) => o.storeId);

      for (const providerId of providersWithOffering) {
        const presence = this.getProviderPresence(providerId);
        const isOnline = presence ? presence.status === 'online' : (this.providerOnlineStatus.get(providerId) || false);
        if (!isOnline) {
          continue;
        }

        const availability = this.serviceAvailabilities.get(item.offeringId);
        if (!availability || availability.length === 0) {
          continue;
        }

        let availabilityMatches = false;
        if (request.intent === 'now') {
          const today = new Date();
          const weekday = today.getDay();
          const todayAvailability = availability.find(a => a.weekday === weekday);
          if (todayAvailability && todayAvailability.capacity > 0) {
            availabilityMatches = true;
          }
        } else if (request.intent === 'scheduled' && request.schedule.date) {
          const scheduledDate = new Date(request.schedule.date);
          const weekday = scheduledDate.getDay();
          const scheduledAvailability = availability.find(a => a.weekday === weekday);
          if (scheduledAvailability && scheduledAvailability.capacity > 0) {
            availabilityMatches = true;
          }
        }

        if (!availabilityMatches) {
          continue;
        }

        const identity = await economicIdentityService.getEconomicIdentity(tenantId, providerId);
        if (!identity) {
          continue;
        }

        const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
        const requiredLevel = trustLevels[request.constraints.minTrustLevelRequired] || 0;
        const providerLevel = trustLevels[identity.trustLevel] || 0;

        if (providerLevel < requiredLevel) {
          continue;
        }

        // 4. Região compatível
        const storesData = this.getStores();
        const store = storesData.stores.find(s => s.storeId === providerId);
        if (!store) {
          continue;
        }

        let regionMatches = false;
        if (request.constraints.providerRadiusMode === 'same_neighborhood') {
          // Verificar se há branch no mesmo bairro
          const branchInNeighborhood = store.branches.some(
            b => b.location?.city === request.city && b.location?.neighborhood === request.neighborhood
          );
          if (branchInNeighborhood) {
            regionMatches = true;
          }
        } else if (request.constraints.providerRadiusMode === 'same_city') {
          // Verificar se há branch na mesma cidade
          const branchInCity = store.branches.some(b => b.location?.city === request.city);
          if (branchInCity) {
            regionMatches = true;
          }
        }

        if (!regionMatches) {
          continue;
        }

        // 5. Sem bloqueio SLA/disputas (usar guards existentes)
        // Por enquanto, apenas verificar se não há disputas abertas
        const disputes = Array.from(this.disputeCases.values()).filter(
          d => d.actorInvolved.actorId === providerId && d.status === 'open'
        );
        if (disputes.length > 0) {
          continue;
        }

        // 6. Verificar capacidade produtiva (PROMPT 23)
        const offering = this.serviceOfferings.get(item.offeringId);
        if (offering) {
          const serviceTemplateId = offering.templateId;
          const targetDate = request.intent === 'now'
            ? new Date().toISOString().split('T')[0]
            : request.schedule.date
            ? request.schedule.date.split('T')[0]
            : null;
          const targetTime = request.intent === 'now'
            ? new Date().toTimeString().split(' ')[0].substring(0, 5)
            : '09:00';

          if (targetDate) {
            const resourceAvailability = this.checkResourceAvailability(
              serviceTemplateId,
              providerId,
              targetDate,
              targetTime
            );

            if (!resourceAvailability.available) {
              // Registrar evento de rejeição por capacidade
              this.recordCapacityEvent({
                resourceId: resourceAvailability.missing_resources[0],
                storeId: providerId,
                companyId: providerId,
                eventType: 'service_rejected_capacity',
                details: {
                  serviceRequestId: requestId,
                  reason: `Recursos necessários não disponíveis: ${resourceAvailability.missing_resources.join(', ')}`,
                },
              });
              continue; // Recurso não disponível
            }

            // Verificar se recursos elegíveis não estão sobrecarregados
            const eligibleResources = this.getEligibleResourcesForMatching(providerId, serviceTemplateId);
            if (eligibleResources.length === 0) {
              continue; // Nenhum recurso elegível (todos sobrecarregados)
            }
          }
        }

        const eligibilityReason = `Provider elegível: online, disponível, trust ${identity.trustLevel}, região compatível, capacidade disponível`;

        // Buscar score de reputação (se existir snapshot)
        const snapshots = this.getReputationSnapshots(providerId);
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const reputationScore = latestSnapshot ? latestSnapshot.score.finalScore : undefined;

        candidates.push({
          providerActorId: providerId,
          offeringId: item.offeringId,
          eligibilityReason: eligibilityReason,
          reputation_score: reputationScore,
        });
      }
    }

    // Ordenar candidatos:
    // 1. Menor "distance bucket" (neighborhood primeiro, city depois)
    // 2. Maior score de reputação (se existir)
    // 3. Ordem alfabética por actor_id (se não houver score)

    candidates.sort((a, b) => {
      // Por enquanto, ordenar por reputation_score (desc) e depois por actor_id (asc)
      if (a.reputation_score !== undefined && b.reputation_score !== undefined) {
        if (b.reputation_score !== a.reputation_score) {
          return b.reputation_score - a.reputation_score;
        }
      } else if (a.reputation_score !== undefined) {
        return -1;
      } else if (b.reputation_score !== undefined) {
        return 1;
      }

      return a.providerActorId.localeCompare(b.providerActorId);
    });

    return candidates;
  }

  /**
   * Dispatch de requisição de serviço
   */
  async dispatchServiceRequest(tenantId: string, requestId: string): Promise<ServiceDispatch> {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.status !== 'open') {
      throw new Error('Requisição não está aberta para dispatch');
    }

    const existingDispatch = Array.from(this.serviceDispatches.values()).find(
      d => d.requestId === requestId && (d.status === 'sent' || d.status === 'accepted')
    );

    if (existingDispatch) {
      const dispatchAge = Date.now() - new Date(existingDispatch.createdAt).getTime();
      const tenMinutes = 10 * 60 * 1000;
      if (dispatchAge < tenMinutes) {
        throw new Error('Já existe dispatch ativo para esta requisição (aguarde 10 minutos)');
      }
    }

    const candidates = await this.listEligibleServiceProviders(tenantId, requestId);

    if (candidates.length === 0) {
      throw new Error('Nenhum provider elegível encontrado');
    }

    // Ordenar candidatos determinísticamente
    const sortedCandidates = this.sortCandidatesDeterministically(candidates, request);

    // Limitar a 20 candidatos (já ordenados)
    const limitedCandidates = sortedCandidates.slice(0, 20);

    const dispatchId = `service-dispatch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dispatch: ServiceDispatch = {
      dispatchId,
      requestId,
      candidates: limitedCandidates.map(c => ({
        providerActorId: c.providerActorId,
        offeringId: c.offeringId,
        eligibilityReason: c.eligibilityReason,
      })),
      rulesApplied: {
        trust: true,
        availability: true,
        online: true,
        region: true,
      },
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    this.serviceDispatches.set(dispatchId, dispatch);

    // Criar pré-reservas para cada candidato (matching com consciência de agenda)
    const preReservations = this.createPreReservationsForDispatch(dispatchId, request);

    // Registrar dispatch enviado para cada candidato (para cálculo de SLA)
    for (const candidate of limitedCandidates) {
      this.dispatchService.recordDispatchSent(dispatchId, candidate.providerActorId, requestId);
    }

    marketplaceLogger.init('Pré-reservas criadas para dispatch', {
      dispatchId: dispatchId,
      pre_reservations_count: preReservations.length,
    });

    // Atualizar status da requisição
    request.status = 'dispatched';
    request.dispatchedAt = new Date().toISOString();
    this.serviceRequests.set(requestId, request);

    marketplaceLogger.init('Dispatch de requisição de serviço criado', {
      dispatchId: dispatchId,
      requestId: requestId,
      candidates_count: limitedCandidates.length,
    });

    return dispatch;
  }

  /**
   * Aceitar dispatch de serviço
   */
  acceptServiceDispatch(dispatchId: string, providerActorId: string): Order {
    const dispatch = this.serviceDispatches.get(dispatchId);
    if (!dispatch) {
      throw new Error('Dispatch não encontrado');
    }

    if (dispatch.status !== 'sent') {
      throw new Error('Dispatch não está disponível para aceitação');
    }

    // Validar provider é candidato
    const candidate = dispatch.candidates.find(c => c.providerActorId === providerActorId);
    if (!candidate) {
      throw new Error('Provider não é candidato deste dispatch');
    }

    const request = this.serviceRequests.get(dispatch.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Buscar pré-reservas do dispatch para este provider
    const preReservations = this.getPreReservationsByDispatch(dispatchId)
      .filter(pr => pr.providerActorId === providerActorId && pr.status === 'active');

    // Confirmar pré-reservas (virar ServiceBookings)
    const bookingIds: string[] = [];
    for (const preReservation of preReservations) {
      try {
        const confirmed = this.confirmPreReservation(preReservation.preReservationId);
        bookingIds.push(confirmed.booking_id);
      } catch (err) {
        marketplaceLogger.error('Erro ao confirmar pré-reserva', err);
        // Continuar com outras pré-reservas
      }
    }

    if (bookingIds.length === 0) {
      throw new Error('Nenhuma pré-reserva ativa encontrada para este provider');
    }

    // Registrar resposta a dispatch (aceito)
    this.recordDispatchResponse(dispatchId, 'accepted');

    // Marcar dispatch como aceito
    dispatch.status = 'accepted';
    dispatch.acceptedBy = providerActorId;
    dispatch.acceptedAt = new Date().toISOString();
    this.serviceDispatches.set(dispatchId, dispatch);

    // Marcar requisição como aceita
    request.status = 'accepted';
    request.acceptedAt = new Date().toISOString();
    this.serviceRequests.set(dispatch.requestId, request);

      // Se intent for quote_required, criar ServiceVisit ao invés de ServiceBooking
    if (request.intent === 'quote_required') {
      // Criar ServiceVisit
      const visit = this.createServiceVisit({
        requestId: request.requestId,
        dispatchId: dispatchId,
        providerActorId: providerActorId,
        scheduledDate: request.schedule.date || new Date().toISOString().split('T')[0],
        scheduledTime: '09:00', // Default, pode ser ajustado
      });

      // Registrar evento econômico
      try {
        if (typeof (this as any).generateEconomicEvent === 'function') {
          (this as any).generateEconomicEvent({
            type: 'service_visit_scheduled',
            region: { country: 'BR', state: 'PR', city: request.city },
            actorId: providerActorId,
            actorType: 'service_provider',
            reference_id: visit.visitId,
            visibility: { scope: 'local' },
          });
        }
      } catch (err) {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('Visita de orçamento agendada', {
        visitId: visit.visitId,
        requestId: request.requestId,
        providerActorId: providerActorId,
      });

      // Retornar Order vazio (não há pagamento ainda)
      const storesData = this.getStores();
      const firstStore = storesData.stores[0];
      if (!firstStore) {
        throw new Error('Nenhuma loja disponível para criar order');
      }

      const emptyOrder = this.createOrder(providerActorId);

      return emptyOrder;
    }

    // Usar bookings já criados a partir das pré-reservas confirmadas
    // (já foram criados em acceptServiceDispatch)

    // Se não houver bookings (caso raro), criar manualmente
    let finalBookingIds = bookingIds;

    if (finalBookingIds.length === 0) {
      // Fallback: criar bookings manualmente (compatibilidade)
      finalBookingIds = [];

      if (request.intent === 'now') {
        // Intent=now: reserva no slot atual (próximo slot disponível do dia)
        for (const item of request.serviceItems) {
        const offering = this.serviceOfferings.get(item.offeringId);
        if (!offering) {
          continue;
        }

        const today = new Date();
        const weekday = today.getDay();
        const availability = this.serviceAvailabilities.get(item.offeringId);
        const todayAvailability = availability?.find(a => a.weekday === weekday);

        if (todayAvailability) {
          // Criar booking para hoje, próximo horário disponível
          const booking = this.createServiceBooking({
            offeringId: item.offeringId,
            user_id: request.requesterActorId,
            date: today.toISOString().split('T')[0],
            time: todayAvailability.starts_at,
            quantity: item.quantity,
          });

          manualBookingIds.push(booking.booking_id);
        }
        }
      }
    } else if (request.intent === 'scheduled' && request.schedule.date) {
      // Intent=scheduled: reserva no slot correspondente
      for (const item of request.serviceItems) {
        const scheduledDate = new Date(request.schedule.date);
        const weekday = scheduledDate.getDay();
        const availability = this.serviceAvailabilities.get(item.offeringId);
        const scheduledAvailability = availability?.find(a => a.weekday === weekday);

        if (scheduledAvailability) {
          const booking = this.createServiceBooking({
            offeringId: item.offeringId,
            user_id: request.requesterActorId,
            date: request.schedule.date.split('T')[0],
            time: scheduledAvailability.starts_at,
            quantity: item.quantity,
          });

          manualBookingIds.push(booking.booking_id);
        }
      }
    } else if (request.intent === 'bundle') {
      // Intent=bundle
      if (request.constraints.allowMultipleProviders) {
        // Criar booking por item com provider possivelmente diferente
        for (const item of request.serviceItems) {
          // Usar provider que aceitou (ou primeiro candidato para este item)
          const itemCandidate = dispatch.candidates.find(c => c.offeringId === item.offeringId);
          if (itemCandidate) {
            const offering = this.serviceOfferings.get(item.offeringId);
            if (offering) {
              const booking = this.createServiceBooking({
                offeringId: item.offeringId,
                user_id: request.requesterActorId,
                date: request.schedule.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                time: '09:00', // Default
                quantity: item.quantity,
              });

              manualBookingIds.push(booking.booking_id);
            }
          }
        }
      } else {
        // Exige provider que cubra todos os offeringId
        const allOfferingsCovered = request.serviceItems.every(item =>
          dispatch.candidates.some(c => c.offeringId === item.offeringId && c.providerActorId === providerActorId)
        );

        if (!allOfferingsCovered) {
          throw new Error('Provider não cobre todos os serviços do bundle');
        }

        // Criar bookings para todos os itens
        for (const item of request.serviceItems) {
          const offering = this.serviceOfferings.get(item.offeringId);
          if (offering) {
            const booking = this.createServiceBooking({
              offeringId: item.offeringId,
              user_id: request.requesterActorId,
              date: request.schedule.date?.split('T')[0] || new Date().toISOString().split('T')[0],
              time: '09:00', // Default
              quantity: item.quantity,
            });

            manualBookingIds.push(booking.booking_id);
          }
        }
      }
      
      finalBookingIds = manualBookingIds;
    }

    // Se ainda não houver bookings, erro
    if (finalBookingIds.length === 0) {
      throw new Error('Nenhum booking criado para este dispatch');
    }

    // Buscar ou criar Order do usuário
    let userOrder: Order | null = null;

    // Buscar order aberto do usuário (usando customer_id se disponível)
    // Por enquanto, criar sempre um novo Order para simplificar
    // Em produção, poderia buscar por customer_id se Order tivesse esse campo preenchido
    const storesData = this.getStores();
    const firstStore = storesData.stores[0];
    if (!firstStore) {
      throw new Error('Nenhuma loja disponível para criar order');
    }

    // Criar novo Order sempre (simplificado)
    // Em produção, poderia buscar Order existente por customer_id
    userOrder = this.createOrder(providerActorId);

    // Confirmar bookings e adicionar ServiceOrders ao Order
    // (bookings já foram criados via confirmPreReservation ou fallback)
    for (const bookingId of finalBookingIds) {
      // Confirmar booking (cria ServiceOrder)
      const confirmed = this.confirmServiceBooking(bookingId);
      
      // Adicionar ServiceOrder ao Order
      this.addServiceOrderToOrder(userOrder.orderId, confirmed.orderId);
    }

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        const eventType = request.intent === 'bundle' ? 'bundle_service_booked' : 'service_request_accepted';
        (this as any).generateEconomicEvent({
          type: eventType,
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: providerActorId,
          actorType: 'service_provider',
          reference_id: dispatchId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Dispatch de serviço aceito', {
      dispatchId: dispatchId,
      providerActorId: providerActorId,
      bookings_count: finalBookingIds.length,
      orderId: userOrder.orderId,
    });

    return userOrder;
  }

  /**
   * Expirar requisicao de servico
   */
  expireServiceRequest(requestId: string): ServiceRequest {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.status !== 'open' && request.status !== 'dispatched') {
      throw new Error('Requisição não pode ser expirada (já foi aceita, cancelada ou expirada)');
    }

    // Verificar se passou max_wait/deadline
    const now = new Date();
    let shouldExpire = false;

    if (request.intent === 'now' && request.schedule.maxWaitMinutes) {
      const requestAge = (now.getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      if (requestAge > request.schedule.maxWaitMinutes) {
        shouldExpire = true;
      }
    } else if (request.intent === 'scheduled' && request.schedule.date) {
      const scheduledDate = new Date(request.schedule.date);
      if (now > scheduledDate) {
        shouldExpire = true;
      }
    }

    if (!shouldExpire) {
      throw new Error('Prazo ainda não expirou');
    }

    request.status = 'expired';
    request.expiredAt = new Date().toISOString();
    this.serviceRequests.set(requestId, request);

    // Expirar dispatch ativo se houver
    const activeDispatch = Array.from(this.serviceDispatches.values()).find(
      d => d.requestId === requestId && d.status === 'sent'
    );
    if (activeDispatch) {
      activeDispatch.status = 'expired';
      activeDispatch.expiredAt = new Date().toISOString();
      this.serviceDispatches.set(activeDispatch.dispatchId, activeDispatch);
    }

    // Registrar evento econômico (restricted)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_request_created', // Reutilizar tipo
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: request.requesterActorId,
          actorType: 'user',
          reference_id: requestId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Requisição de serviço expirada', {
      requestId: requestId,
    });

    return request;
  }

  /**
   * Buscar requisição por ID
   */
  getServiceRequest(requestId: string): ServiceRequest | null {
    return this.serviceRequests.get(requestId) || null;
  }

  /**
   * Buscar dispatch por ID
   */
  getServiceDispatch(dispatchId: string): ServiceDispatch | null {
    return this.serviceDispatches.get(dispatchId) || null;
  }

  /**
   * Definir status online de provider (mock)
   */
  setProviderOnlineStatus(providerActorId: string, online: boolean): void {
    this.providerOnlineStatus.set(providerActorId, online);
  }

  // ============================================================
  // PRESENCE/ONLINE CANÔNICO PARA PROVIDERS + SLA DE RESPOSTA
  // ============================================================

  /**
   * Atualizar presença de provider
   */
  updateProviderPresence(input: {
    providerActorId: string;
    status: 'online' | 'offline';
    region: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
    };
  }): ProviderPresence {
    return this.dispatchService.updateProviderPresence(input);
  }

  /**
   * Buscar presença de provider
   */
  getProviderPresence(providerActorId: string): ProviderPresence | null {
    return this.dispatchService.getProviderPresence(providerActorId);
  }

  /**
   * Registrar resposta a dispatch (aceito ou recusado)
   */
  recordDispatchResponse(dispatchId: string, status: 'accepted' | 'declined'): void {
    this.dispatchService.recordDispatchResponse(dispatchId, status);
  }

  /**
   * Buscar métricas de SLA de resposta de um provider
   */
  getProviderResponseSLAMetrics(providerActorId: string): {
    averageResponseTimeMinutes: number;
    totalDispatchesReceived: number;
    totalDispatchesAccepted: number;
    totalDispatchesDeclined: number;
    acceptanceRate: number; // % de aceitação
    lastResponseTimeMinutes?: number;
  } | null {
    return this.dispatchService.getProviderResponseSLAMetrics(providerActorId);
  }

  // ============================================================
  // APP DO PRESTADOR: INBOX DE DISPATCH
  // ============================================================

  /**
   * Buscar inbox de dispatches para um provider
   */
  getProviderDispatchInbox(providerActorId: string): Array<{
    dispatchId: string;
    requestId: string;
    request_summary: {
      intent: 'now' | 'scheduled' | 'bundle';
      serviceItems: Array<{ offeringId: string; quantity: number }>;
      city: string;
      neighborhood?: string;
      schedule: {
        mode: 'now' | 'scheduled';
        date?: string;
        time?: string;
      };
    };
    pre_reservation?: {
      preReservationId: string;
      date: string;
      time: string;
      expiresAt: string;
      status: 'active' | 'expired';
    };
    status: 'accepted' | 'expired' | 'sent' | 'declined';
    createdAt: string;
  }> {
    const inbox = this.dispatchService.getProviderDispatchInbox(providerActorId);
    return inbox.map(item => ({
      ...item,
      status: this.normalizeDispatchInboxStatus(item.status),
    }));
  }

  private normalizeDispatchInboxStatus(
    status: string
  ): 'accepted' | 'expired' | 'sent' | 'declined' {
    if (status === 'accepted') return 'accepted';
    if (status === 'expired') return 'expired';
    if (status === 'declined') return 'declined';
    return 'sent';
  }

  /**
   * Buscar status de dispatch para um provider específico
   */
  getDispatchStatusForProvider(dispatchId: string, providerActorId: string): {
    dispatchId: string;
    providerActorId: string;
    is_eligible: boolean;
    pre_reservation_status?: 'active' | 'expired' | 'confirmed' | 'released';
    pre_reservation_expiresAt?: string;
    time_remaining_minutes?: number;
    already_accepted: boolean;
    acceptedBy?: string;
  } {
    return this.dispatchService.getDispatchStatusForProvider(dispatchId, providerActorId);
  }

  // ============================================================
  // MATCHING ECONÔMICO DE SERVIÇOS + PRÉ-RESERVA INTELIGENTE
  // ============================================================

  /**
   * Service Pre-Reservations (in-memory)
   * Armazena pré-reservas temporárias na agenda
   */
  private servicePreReservations: Map<string, ServicePreReservation> = new Map(); // pre_reservation_id -> pre_reservation

  /**
   * User Request History (in-memory)
   * Armazena histórico de requests por usuário (anti-spam)
   */
  private userRequestHistory: Map<string, Array<{
    requestId: string;
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    createdAt: string;
  }>> = new Map(); // requester_actor_id -> requests

  /**
   * Criar pré-reserva temporária na agenda
   */
  private createPreReservation(input: {
    dispatchId: string;
    requestId: string;
    providerActorId: string;
    offeringId: string;
    date: string;
    time: string;
    quantity: number;
    holdDurationMinutes?: number; // Padrão: 10 minutos
  }): ServicePreReservation {
    const holdDuration = input.holdDurationMinutes ?? 10;
    const expiresAt = new Date(Date.now() + holdDuration * 60 * 1000);

    const preReservationId = `pre-reservation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const preReservation: ServicePreReservation = {
      preReservationId: preReservationId,
      dispatchId: input.dispatchId,
      requestId: input.requestId,
      providerActorId: input.providerActorId,
      offeringId: input.offeringId,
      date: input.date,
      time: input.time,
      quantity: input.quantity,
      holdDurationMinutes: holdDuration,
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.servicePreReservations.set(preReservationId, preReservation);

    // Registrar evento econômico (restricted)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_pre_reservation_created',
          region: { country: 'BR', state: 'PR', city: 'Curitiba' }, // TODO: obter da request
          actorId: input.providerActorId,
          actorType: 'service_provider',
          reference_id: preReservationId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Pré-reserva criada', {
      preReservationId: preReservationId,
      dispatchId: input.dispatchId,
      providerActorId: input.providerActorId,
      expiresAt: expiresAt.toISOString(),
    });

    return preReservation;
  }

  /**
   * Verificar se slot está disponível (sem conflito com pré-reservas ativas)
   */
  private isSlotAvailable(offeringId: string, date: string, time: string, quantity: number): boolean {
    // Verificar disponibilidade base
    const availability = this.serviceAvailabilities.get(offeringId);
    if (!availability || availability.length === 0) {
      return false;
    }

    const dateObj = new Date(date);
    const weekday = dateObj.getDay();
    const slot = availability.find(a => a.weekday === weekday);
    if (!slot) {
      return false;
    }

    // Verificar horário dentro do slot
    if (time < slot.starts_at || time >= slot.ends_at) {
      return false;
    }

    // Verificar capacidade (bookings confirmados)
    const existingBookings = Array.from(this.serviceBookings.values())
      .filter(b =>
        b.offeringId === offeringId &&
        b.date === date &&
        b.time === time &&
        b.status !== 'cancelled'
      );

    const totalBooked = existingBookings.reduce((sum, b) => sum + b.quantity, 0);

    // Verificar pré-reservas ativas (hold)
    const activePreReservations = Array.from(this.servicePreReservations.values())
      .filter(pr =>
        pr.offeringId === offeringId &&
        pr.date === date &&
        pr.time === time &&
        pr.status === 'active' &&
        new Date(pr.expiresAt) > new Date()
      );

    const totalHeld = activePreReservations.reduce((sum, pr) => sum + pr.quantity, 0);

    // Capacidade disponível = capacidade total - bookings confirmados - pré-reservas ativas
    const availableCapacity = slot.capacity - totalBooked - totalHeld;

    return availableCapacity >= quantity;
  }

  /**
   * Ordenar candidatos determinísticamente
   */
  private sortCandidatesDeterministically(
    candidates: Array<{
      providerActorId: string;
      offeringId: string;
      eligibilityReason: string;
      reputation_score?: number;
    }>,
    request: ServiceRequest
  ): Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string;
    reputation_score?: number;
    sort_score: number; // Score determinístico para ordenação
  }> {
    return candidates.map(candidate => {
      const presence = this.getProviderPresence(candidate.providerActorId);
      
      // Calcular prioridade de matching baseada em métricas de governança
      const governancePriority = this.calculateMatchingPriority(candidate.providerActorId);
      const slaMetrics = this.getProviderResponseSLAMetrics(candidate.providerActorId);

      // Calcular score determinístico
      // 1. Disponibilidade exata do slot (já validado, score = 1 se disponível)
      let sortScore = 1;

      // 2. Menor distância lógica (bairro = 2, cidade = 1)
      if (request.constraints.providerRadiusMode === 'same_neighborhood') {
        sortScore += 2;
      } else {
        sortScore += 1;
      }

      // 3. Melhor SLA de resposta (menor tempo médio = maior score)
      if (slaMetrics) {
        // Inverter tempo médio (menor tempo = maior score)
        // Normalizar: 0-60 minutos -> 0-10 pontos
        const responseTimeScore = Math.max(0, 10 - (slaMetrics.averageResponseTimeMinutes / 6));
        sortScore += responseTimeScore;
      }

      // 4. Maior taxa de aceitação
      if (slaMetrics) {
        // Taxa de aceitação: 0-100% -> 0-5 pontos
        sortScore += (slaMetrics.acceptanceRate / 20);
      }

      // 5. Prioridade de governança (métricas anti-desvio)
      // Multiplicar score pela prioridade (0.0 a 1.0)
      // Providers com boa governança mantêm score alto
      // Providers com desvio têm score reduzido
      sortScore *= governancePriority;

      // 6. Ordem alfabética (fallback) - não adiciona ao score, mas será usado no sort

      return {
        ...candidate,
        sort_score: sortScore,
      };
    }).sort((a, b) => {
      // Ordenar por score (desc), depois por actor_id (asc) como fallback
      if (b.sort_score !== a.sort_score) {
        return b.sort_score - a.sort_score;
      }
      return a.providerActorId.localeCompare(b.providerActorId);
    });
  }

  /**
   * Verificar anti-spam (usuário não pode criar múltiplas requests simultâneas iguais)
   */
  private checkAntiSpam(requesterActorId: string, serviceItems: Array<{ offeringId: string; quantity: number }>): boolean {
    const userHistory = this.userRequestHistory.get(requesterActorId) || [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Verificar se há request recente com os mesmos itens
    const recentDuplicate = userHistory.find(req => {
      if (new Date(req.createdAt) < fiveMinutesAgo) {
        return false;
      }

      // Comparar serviceItems
      if (req.serviceItems.length !== serviceItems.length) {
        return false;
      }

      const itemsMatch = req.serviceItems.every(item1 =>
        serviceItems.some(item2 =>
          item1.offeringId === item2.offeringId && item1.quantity === item2.quantity
        )
      );

      return itemsMatch;
    });

    return !recentDuplicate;
  }

  /**
   * Verificar anti-abuso (provider com alta taxa de não resposta perde prioridade)
   */
  private checkProviderAbuse(providerActorId: string): boolean {
    const slaMetrics = this.getProviderResponseSLAMetrics(providerActorId);
    if (!slaMetrics) {
      return true; // Sem histórico, permitir
    }

    // Se taxa de aceitação < 30% e total de dispatches > 10, considerar abuso
    if (slaMetrics.totalDispatchesReceived > 10 && slaMetrics.acceptanceRate < 30) {
      return false;
    }

    return true;
  }

  /**
   * Criar pré-reservas para dispatch (matching com consciência de agenda)
   */
  private createPreReservationsForDispatch(dispatchId: string, request: ServiceRequest): Array<ServicePreReservation> {
    const dispatch = this.serviceDispatches.get(dispatchId);
    if (!dispatch) {
      throw new Error('Dispatch não encontrado');
    }

    const preReservations: ServicePreReservation[] = [];

    // Para cada candidato, tentar criar pré-reserva
    for (const candidate of dispatch.candidates) {
      // Verificar anti-abuso
      if (!this.checkProviderAbuse(candidate.providerActorId)) {
        continue;
      }

      // Buscar offering
      const offering = this.serviceOfferings.get(candidate.offeringId);
      if (!offering) {
        continue;
      }

      // Determinar data e horário baseado no intent
      let targetDate: string;
      let targetTime: string;

      if (request.intent === 'now') {
        // Intent = "now": disponibilidade imediata (agora + tolerância)
        const now = new Date();
        targetDate = now.toISOString().split('T')[0];
        const availability = this.serviceAvailabilities.get(candidate.offeringId);
        if (availability && availability.length > 0) {
          const today = now.getDay();
          const todaySlot = availability.find(a => a.weekday === today);
          if (todaySlot) {
            targetTime = todaySlot.starts_at;
          } else {
            continue; // Sem disponibilidade hoje
          }
        } else {
          continue;
        }
      } else if (request.intent === 'scheduled' && request.schedule.date) {
        // Intent = "scheduled": data e horário exatos
        targetDate = request.schedule.date.split('T')[0];
        const availability = this.serviceAvailabilities.get(candidate.offeringId);
        if (availability && availability.length > 0) {
          const scheduledDate = new Date(request.schedule.date);
          const weekday = scheduledDate.getDay();
          const scheduledSlot = availability.find(a => a.weekday === weekday);
          if (scheduledSlot) {
            targetTime = scheduledSlot.starts_at;
          } else {
            continue; // Sem disponibilidade na data
          }
        } else {
          continue;
        }
      } else {
        continue; // Intent não suportado
      }

      // Buscar item da request correspondente
      const requestItem = request.serviceItems.find(item => item.offeringId === candidate.offeringId);
      if (!requestItem) {
        continue;
      }

      // Verificar se slot está disponível (sem conflito)
      if (!this.isSlotAvailable(candidate.offeringId, targetDate, targetTime, requestItem.quantity)) {
        continue; // Slot não disponível
      }

      // Criar pré-reserva
      const preReservation = this.createPreReservation({
        dispatchId: dispatchId,
        requestId: request.requestId,
        providerActorId: candidate.providerActorId,
        offeringId: candidate.offeringId,
        date: targetDate,
        time: targetTime,
        quantity: requestItem.quantity,
        holdDurationMinutes: 10, // Padrão: 10 minutos
      });

      preReservations.push(preReservation);
    }

    return preReservations;
  }

  /**
   * Confirmar pré-reserva (vira ServiceBooking)
   */
  private confirmPreReservation(preReservationId: string): {
    booking_id: string;
    preReservationId: string;
  } {
    const preReservation = this.servicePreReservations.get(preReservationId);
    if (!preReservation) {
      throw new Error('Pré-reserva não encontrada');
    }

    if (preReservation.status !== 'active') {
      throw new Error('Pré-reserva não está ativa');
    }

    // Verificar se não expirou
    if (new Date(preReservation.expiresAt) < new Date()) {
      throw new Error('Pré-reserva expirada');
    }

    // Criar ServiceBooking
    const request = this.serviceRequests.get(preReservation.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const booking = this.createServiceBooking({
      offeringId: preReservation.offeringId,
      user_id: request.requesterActorId,
      date: preReservation.date,
      time: preReservation.time,
      quantity: preReservation.quantity,
    });

    // Marcar pré-reserva como confirmada
    preReservation.status = 'confirmed';
    preReservation.confirmedAt = new Date().toISOString();
    this.servicePreReservations.set(preReservationId, preReservation);

    // Registrar evento econômico (restricted)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_pre_reservation_confirmed',
          region: { country: 'BR', state: 'PR', city: 'Curitiba' }, // TODO: obter da request
          actorId: preReservation.providerActorId,
          actorType: 'service_provider',
          reference_id: preReservationId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Pré-reserva confirmada', {
      preReservationId: preReservationId,
      booking_id: booking.booking_id,
    });

    return {
      booking_id: booking.booking_id,
      preReservationId: preReservationId,
    };
  }

  /**
   * Expirar pré-reservas automaticamente
   */
  expirePreReservations(): void {
    const now = new Date();
    const expiredPreReservations: ServicePreReservation[] = [];

    for (const preReservation of this.servicePreReservations.values()) {
      if (preReservation.status === 'active' && new Date(preReservation.expiresAt) < now) {
        preReservation.status = 'expired';
        preReservation.expiredAt = now.toISOString();
        this.servicePreReservations.set(preReservation.preReservationId, preReservation);
        expiredPreReservations.push(preReservation);

        // Registrar evento econômico (restricted)
        try {
          if (typeof (this as any).generateEconomicEvent === 'function') {
            (this as any).generateEconomicEvent({
              type: 'service_pre_reservation_expired',
              region: { country: 'BR', state: 'PR', city: 'Curitiba' }, // TODO: obter da request
              actorId: preReservation.providerActorId,
              actorType: 'service_provider',
              reference_id: preReservation.preReservationId,
              visibility: { scope: 'restricted' },
            });
          }
        } catch (err) {
          // Ignorar se método não existir
        }
      }
    }

    if (expiredPreReservations.length > 0) {
      marketplaceLogger.init('Pré-reservas expiradas', {
        count: expiredPreReservations.length,
      });
    }
  }

  /**
   * Buscar pré-reserva por ID
   */
  getPreReservation(preReservationId: string): ServicePreReservation | null {
    return this.servicePreReservations.get(preReservationId) || null;
  }

  /**
   * Buscar pré-reservas por dispatch
   */
  getPreReservationsByDispatch(dispatchId: string): ServicePreReservation[] {
    return Array.from(this.servicePreReservations.values())
      .filter(pr => pr.dispatchId === dispatchId);
  }

  // ============================================================
  // APP DO USUÁRIO (DEMANDANTE): TIMELINE DE SERVIÇO
  // ============================================================

  /**
   * Buscar timeline de eventos de um ServiceRequest
   */
  getServiceRequestTimeline(requestId: string): Array<{
    type: string;
    timestamp: string;
    actor_id?: string;
    payload?: any;
  }> {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const timeline: Array<{
      type: string;
      timestamp: string;
      actorId?: string;
      payload?: any;
    }> = [];

    // Evento: service_request_created
    timeline.push({
      type: 'service_request_created',
      timestamp: request.createdAt,
      actorId: request.requesterActorId,
      payload: {
        intent: request.intent,
        serviceItems: request.serviceItems,
        city: request.city,
        neighborhood: request.neighborhood,
      },
    });

    // Buscar dispatches relacionados
    const dispatches = Array.from(this.serviceDispatches.values())
      .filter(d => d.requestId === requestId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const dispatch of dispatches) {
      // Evento: service_dispatch_sent
      timeline.push({
        type: 'service_dispatch_sent',
        timestamp: dispatch.createdAt,
        payload: {
          dispatchId: dispatch.dispatchId,
          candidates_count: dispatch.candidates.length,
          candidates: dispatch.candidates.map(c => ({
            providerActorId: c.providerActorId,
            offeringId: c.offeringId,
          })),
        },
      });

      // Buscar pré-reservas deste dispatch
      const preReservations = this.getPreReservationsByDispatch(dispatch.dispatchId);
      for (const preReservation of preReservations) {
        // Evento: service_pre_reservation_created
        timeline.push({
          type: 'service_pre_reservation_created',
          timestamp: preReservation.createdAt,
          actorId: preReservation.providerActorId,
          payload: {
            preReservationId: preReservation.preReservationId,
            date: preReservation.date,
            time: preReservation.time,
            expiresAt: preReservation.expiresAt,
          },
        });

        // Se expirada
        if (preReservation.status === 'expired') {
          timeline.push({
            type: 'service_pre_reservation_expired',
            timestamp: preReservation.expiresAt,
            actorId: preReservation.providerActorId,
            payload: {
              preReservationId: preReservation.preReservationId,
            },
          });
        }

        // Se confirmada
        if (preReservation.status === 'confirmed' && preReservation.confirmedAt) {
          timeline.push({
            type: 'service_pre_reservation_confirmed',
            timestamp: preReservation.confirmedAt,
            actorId: preReservation.providerActorId,
            payload: {
              preReservationId: preReservation.preReservationId,
            },
          });
        }
      }

      // Se dispatch foi recusado
      if (dispatch.status === 'declined') {
        timeline.push({
          type: 'service_dispatch_declined',
          timestamp: dispatch.expiredAt || dispatch.createdAt,
          actorId: dispatch.acceptedBy, // Provider que recusou (se houver)
          payload: {
            dispatchId: dispatch.dispatchId,
          },
        });
      }

      // Se dispatch foi aceito
      if (dispatch.status === 'accepted' && dispatch.acceptedAt) {
        timeline.push({
          type: 'service_dispatch_accepted',
          timestamp: dispatch.acceptedAt,
          actorId: dispatch.acceptedBy,
          payload: {
            dispatchId: dispatch.dispatchId,
          },
        });
      }
    }

    // Buscar bookings relacionados
    // Buscar via dispatches aceitos
    const acceptedDispatches = dispatches.filter(d => d.status === 'accepted');
    const bookings: any[] = [];
    
    for (const dispatch of acceptedDispatches) {
      const preReservations = this.getPreReservationsByDispatch(dispatch.dispatchId);
      const confirmedPreReservation = preReservations.find(pr => pr.status === 'confirmed');
      
      if (confirmedPreReservation) {
        // Buscar booking criado a partir desta pré-reserva
        const relatedBookings = Array.from(this.serviceBookings.values())
          .filter(b =>
            b.offeringId === confirmedPreReservation.offeringId &&
            b.date === confirmedPreReservation.date &&
            b.time === confirmedPreReservation.time
          );
        bookings.push(...relatedBookings);
      }
    }

    for (const booking of bookings) {
      if (booking.status === 'confirmed' && booking.confirmedAt) {
        timeline.push({
          type: 'service_booking_confirmed',
          timestamp: booking.confirmedAt,
          payload: {
            booking_id: booking.booking_id,
            date: booking.date,
            time: booking.time,
          },
        });
      }
    }

    // Buscar orders relacionados (via service orders)
    const serviceOrders = Array.from(this.serviceOrders.values())
      .filter(so => {
        // Verificar se service order está relacionado a esta request
        const relatedBooking = bookings.find(b => b.booking_id === so.bookingId);
        return !!relatedBooking;
      });

    for (const serviceOrder of serviceOrders) {
      // Buscar order pai (serviceOrder.orderId é o order_id)
      const parentOrder = this.orders.get(serviceOrder.orderId);

      if (parentOrder) {
        timeline.push({
          type: 'order_created',
          timestamp: parentOrder.createdAt,
          payload: {
            orderId: parentOrder.orderId,
            totalCents: parentOrder.totalCents,
          },
        });

        // Verificar se order foi pago (via checkout/payment plan)
        const checkout = Array.from(this.checkouts.values())
          .find(c => this.checkoutOrderIds.get(c.checkoutId) === parentOrder.orderId);

        if (checkout && checkout.status === 'paid') {
          timeline.push({
            type: 'order_paid',
            timestamp: checkout.paidAt || checkout.createdAt,
            payload: {
              checkoutId: checkout.checkoutId,
              orderId: parentOrder.orderId,
            },
          });
        }
      }
    }

    // Se request foi expirada
    if (request.status === 'expired' && request.expiredAt) {
      timeline.push({
        type: 'service_request_expired',
        timestamp: request.expiredAt,
        payload: {
          requestId: requestId,
        },
      });
    }

    // Se request foi completada
    if (request.status === 'completed' && (request as any).completedAt) {
      timeline.push({
        type: 'service_completed',
        timestamp: (request as any).completedAt,
        payload: {
          requestId: requestId,
        },
      });
    }

    // Ordenar por timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  }

  /**
   * Buscar status atual de um ServiceRequest
   */
  getServiceRequestStatus(requestId: string): {
    requestId: string;
    status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
    intent: 'now' | 'scheduled' | 'bundle';
    provider?: {
      providerActorId: string;
      confirmedAt: string;
    };
    confirmed_schedule?: {
      date: string;
      time: string;
    };
    serviceItems: Array<{ offeringId: string; quantity: number }>;
    city: string;
    neighborhood?: string;
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Determinar status atual
    let currentStatus: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';

    if (request.status === 'expired') {
      currentStatus = 'expired';
    } else if (request.status === 'completed') {
      currentStatus = 'completed';
    } else if (request.status === 'accepted') {
      // Buscar dispatch aceito
      const acceptedDispatch = Array.from(this.serviceDispatches.values())
        .find(d => d.requestId === requestId && d.status === 'accepted');

      if (acceptedDispatch && acceptedDispatch.acceptedBy) {
        // Buscar pré-reserva confirmada (via dispatch_id)
        const preReservations = this.getPreReservationsByDispatch(acceptedDispatch.dispatchId);
        const confirmedPreReservation = preReservations.find(pr =>
          pr.providerActorId === acceptedDispatch.acceptedBy &&
          pr.status === 'confirmed'
        );

        if (confirmedPreReservation) {
          // Buscar booking confirmado
          const confirmedBooking = Array.from(this.serviceBookings.values())
            .find(b =>
              b.offeringId === confirmedPreReservation.offeringId &&
              b.date === confirmedPreReservation.date &&
              b.time === confirmedPreReservation.time &&
              b.status === 'confirmed'
            );

          if (confirmedBooking) {
            // Verificar se order foi criado e pago
            const serviceOrder = Array.from(this.serviceOrders.values())
              .find(so => so.bookingId === confirmedBooking.booking_id);

            if (serviceOrder) {
              const parentOrder = this.orders.get(serviceOrder.orderId);

              if (parentOrder) {
                const checkout = Array.from(this.checkouts.values())
                  .find(c => this.checkoutOrderIds.get(c.checkoutId) === parentOrder.orderId);

                if (checkout && checkout.status === 'paid') {
                  // Verificar se foi marcado como completo
                  if (request.status === 'completed') {
                    currentStatus = 'completed';
                  } else {
                    currentStatus = 'in_progress';
                  }
                } else {
                  currentStatus = 'confirmed';
                }
              } else {
                currentStatus = 'confirmed';
              }
            } else {
              currentStatus = 'confirmed';
            }
          } else {
            currentStatus = 'confirmed';
          }
        } else {
          currentStatus = 'confirmed';
        }
      } else {
        currentStatus = 'confirmed';
      }
    } else if (request.status === 'dispatched') {
      currentStatus = 'waiting_provider';
    } else if (request.status === 'open') {
      currentStatus = 'searching';
    } else {
      currentStatus = 'searching';
    }

    // Buscar provider confirmado
    let provider: { providerActorId: string; confirmedAt: string } | undefined;
    const acceptedDispatch = Array.from(this.serviceDispatches.values())
      .find(d => d.requestId === requestId && d.status === 'accepted');

    if (acceptedDispatch && acceptedDispatch.acceptedBy && acceptedDispatch.acceptedAt) {
      provider = {
        providerActorId: acceptedDispatch.acceptedBy,
        confirmedAt: acceptedDispatch.acceptedAt,
      };
    }

    // Buscar horário confirmado
    let confirmedSchedule: { date: string; time: string } | undefined;
    if (acceptedDispatch && acceptedDispatch.acceptedBy) {
      const preReservations = this.getPreReservationsByDispatch(acceptedDispatch.dispatchId);
      const confirmedPreReservation = preReservations.find(pr =>
        pr.providerActorId === acceptedDispatch.acceptedBy &&
        pr.status === 'confirmed'
      );

      if (confirmedPreReservation) {
        confirmedSchedule = {
          date: confirmedPreReservation.date,
          time: confirmedPreReservation.time,
        };
      }
    }

    const intent: 'now' | 'scheduled' | 'bundle' = request.intent === 'now' || request.intent === 'scheduled' || request.intent === 'bundle' ? request.intent : 'now';
    return {
      requestId: requestId,
      status: currentStatus,
      intent,
      provider,
      confirmed_schedule: confirmedSchedule,
      serviceItems: request.serviceItems,
      city: request.city,
      neighborhood: request.neighborhood,
    };
  }

  // ============================================================
  // PAGAMENTO NO SERVIÇO: ESCROW LIGHT + CONFIRMAÇÃO DUPLA
  // ============================================================

  /**
   * Service Payment Holds (in-memory)
   * Armazena retenções de pagamento para serviços
   */
  private servicePaymentHolds: Map<string, ServicePaymentHold> = new Map(); // hold_id -> hold

  /**
   * Service Completion Signals (in-memory)
   * Armazena sinais de conclusão (confirm, dispute, cancel)
   */
  private serviceCompletionSignals: Map<string, ServiceCompletionSignal> = new Map(); // signal_id -> signal

  /**
   * Service Visits (in-memory)
   * Armazena visitas de orçamento
   */
  private serviceVisits: Map<string, ServiceVisit> = new Map(); // visit_id -> visit

  /**
   * Service Quotes (in-memory)
   * Armazena orçamentos enviados
   */
  private serviceQuotes: Map<string, ServiceQuote> = new Map(); // quote_id -> quote

  /**
   * Criar payment hold para serviço
   */
  createServicePaymentHold(
    requestId: string,
    paymentPlanId: string,
    amountCents: number,
    currency: string,
    releasePolicy: 'client_confirm' | 'auto_after_deadline' | 'provider_confirm_with_proof' = 'client_confirm',
    releaseDeadlineHours: number = 24
  ): ServicePaymentHold {
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const deadline = new Date(now.getTime() + releaseDeadlineHours * 60 * 60 * 1000);

    const hold: ServicePaymentHold = {
      holdId,
      requestId,
      paymentPlanId,
      amountCents,
      currency,
      status: 'held',
      createdAt: now.toISOString(),
      releaseDeadlineAt: deadline.toISOString(),
      releasePolicy,
    };

    this.servicePaymentHolds.set(holdId, hold);

    marketplaceLogger.init('Payment hold criado para serviço', {
      holdId: holdId,
      requestId: requestId,
      paymentPlanId: paymentPlanId,
      amountCents,
      releasePolicy: releasePolicy,
    });

    return hold;
  }

  /**
   * Buscar payment hold por requestId
   */
  getServicePaymentHoldByRequest(requestId: string): ServicePaymentHold | null {
    const hold = Array.from(this.servicePaymentHolds.values())
      .find(h => h.requestId === requestId && h.status === 'held');
    return hold || null;
  }

  /**
   * Buscar payment hold por ID
   */
  getServicePaymentHold(holdId: string): ServicePaymentHold | null {
    return this.servicePaymentHolds.get(holdId) || null;
  }

  /**
   * Criar sinal de conclusão
   */
  createServiceCompletionSignal(
    requestId: string,
    actorId: string,
    role: 'customer' | 'provider',
    action: 'confirm_completed' | 'dispute' | 'cancel',
    reason?: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'
  ): ServiceCompletionSignal {
    const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const signal: ServiceCompletionSignal = {
      signalId: signalId,
      requestId: requestId,
      actorId: actorId,
      role,
      action,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.serviceCompletionSignals.set(signalId, signal);

    marketplaceLogger.init('Sinal de conclusão criado', {
      signalId: signalId,
      requestId: requestId,
      actorId: actorId,
      role,
      action,
    });

    return signal;
  }

  /**
   * Confirmar conclusão do serviço (customer)
   */
  confirmServiceCompletedByCustomer(requestId: string, customerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Validar que é o customer
    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode confirmar');
    }

    // Buscar hold
    const hold = this.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    // Criar sinal
    this.createServiceCompletionSignal(requestId, customerActorId, 'customer', 'confirm_completed');

    // Liberar hold
    return this.releaseServicePaymentHold(hold.holdId, customerActorId);
  }

  /**
   * Confirmar conclusão do serviço (provider)
   */
  confirmServiceCompletedByProvider(requestId: string, providerActorId: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Buscar dispatch aceito
    const acceptedDispatch = Array.from(this.serviceDispatches.values())
      .find(d => d.requestId === requestId && d.status === 'accepted');

    if (!acceptedDispatch || acceptedDispatch.acceptedBy !== providerActorId) {
      throw new Error('Apenas o provider que aceitou o serviço pode confirmar');
    }

    // Buscar hold
    const hold = this.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    // Criar sinal
    this.createServiceCompletionSignal(requestId, providerActorId, 'provider', 'confirm_completed');

    // Se policy for provider_confirm_with_proof, liberar
    // (por enquanto, apenas criar sinal - release só via customer ou auto)
    if (hold.releasePolicy === 'provider_confirm_with_proof') {
      return this.releaseServicePaymentHold(hold.holdId, providerActorId);
    }

    // Para outras políticas, apenas registrar sinal
    // (release só via customer ou auto)
    throw new Error('Provider não pode liberar pagamento diretamente nesta política');
  }

  /**
   * Disputar serviço
   */
  disputeService(requestId: string, actorId: string, role: 'customer' | 'provider', reason: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'): {
    holdId: string;
    disputeCaseId: string;
    status: 'disputed';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Validar role
    if (role === 'customer' && request.requesterActorId !== actorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode disputar');
    }

    let acceptedDispatch: { acceptedBy: string } | undefined;
    if (role === 'provider') {
      const found = Array.from(this.serviceDispatches.values())
        .find(d => d.requestId === requestId && d.status === 'accepted');
      if (!found || found.acceptedBy !== actorId) {
        throw new Error('Apenas o provider que aceitou o serviço pode disputar');
      }
      acceptedDispatch = { acceptedBy: found.acceptedBy };
    }

    // Buscar hold
    const hold = this.getServicePaymentHoldByRequest(requestId);
    if (!hold) {
      throw new Error('Nenhum payment hold encontrado para esta requisição');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    // Criar sinal
    this.createServiceCompletionSignal(requestId, actorId, role, 'dispute', reason);

    // Criar DisputeCase (reaproveitar sistema existente)
    let disputeCaseId: string;
    try {
      if (typeof (this as any).createDisputeCase === 'function') {
        const disputeCase = (this as any).createDisputeCase({
          orderId: requestId, // Usar requestId como referência
          actorInvolved: [request.requesterActorId, acceptedDispatch?.acceptedBy].filter(Boolean) as string[],
          type: 'service_dispute',
          status: 'open',
        });
        disputeCaseId = disputeCase.dispute_id;
      } else {
        // Fallback: criar ID simples
        disputeCaseId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    } catch (err) {
      disputeCaseId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Marcar hold como disputado
    hold.status = 'disputed';
    hold.disputeCaseId = disputeCaseId;
    this.servicePaymentHolds.set(hold.holdId, hold);

    marketplaceLogger.init('Payment hold marcado como disputado', {
      holdId: hold.holdId,
      requestId: requestId,
      disputeCaseId: disputeCaseId,
    });

    return {
      holdId: hold.holdId,
      disputeCaseId: disputeCaseId,
      status: 'disputed',
    };
  }

  /**
   * Verificar e expirar holds (auto-release)
   */
  expireServicePaymentHolds(): {
    expired_count: number;
    released_count: number;
  } {
    const now = new Date();
    let expiredCount = 0;
    let releasedCount = 0;

    for (const hold of this.servicePaymentHolds.values()) {
      if (hold.status === 'held' && new Date(hold.releaseDeadlineAt) <= now) {
        // Verificar se há disputa
        const hasDispute = Array.from(this.serviceCompletionSignals.values())
          .some(s => s.requestId === hold.requestId && s.action === 'dispute');

        if (!hasDispute) {
          // Auto-release
          try {
            this.releaseServicePaymentHold(hold.holdId, 'auto');
            releasedCount++;
          } catch (err) {
            // Se falhar, marcar como expirado
            hold.status = 'expired';
            this.servicePaymentHolds.set(hold.holdId, hold);
            expiredCount++;
          }
        } else {
          // Se houver disputa, não libera automaticamente
          hold.status = 'expired';
          this.servicePaymentHolds.set(hold.holdId, hold);
          expiredCount++;
        }
      }
    }

    return { expired_count: expiredCount, released_count: releasedCount };
  }

  /**
   * Liberar payment hold (executa splits finais)
   */
  private releaseServicePaymentHold(holdId: string, releasedBy: string): {
    holdId: string;
    releasedAt: string;
    status: 'released';
  } {
    const hold = this.servicePaymentHolds.get(holdId);
    if (!hold) {
      throw new Error('Payment hold não encontrado');
    }

    if (hold.status !== 'held') {
      throw new Error(`Payment hold não está em status 'held' (status atual: ${hold.status})`);
    }

    // Buscar PaymentPlan
    const paymentPlan = this.paymentPlans.get(hold.paymentPlanId);
    if (!paymentPlan) {
      throw new Error('PaymentPlan não encontrado');
    }

    // Se payment plan já foi executado, apenas marcar hold como released
    // (o dinheiro já está retido na plataforma)
    if (paymentPlan.status === 'executed') {
      const releasedAt = new Date().toISOString();
      hold.status = 'released';
      hold.releasedAt = releasedAt;
      hold.releasedBy = releasedBy;
      this.servicePaymentHolds.set(holdId, hold);

      // Executar splits finais (debitar da plataforma, creditar targets)
      // Por enquanto, apenas marcar como released
      // (em produção, aqui seria a lógica de ledger para liberar os splits)

      marketplaceLogger.init('Payment hold liberado', {
        holdId: holdId,
        paymentPlanId: hold.paymentPlanId,
        releasedBy: releasedBy,
      });

      return {
        holdId: holdId,
        releasedAt: releasedAt,
        status: 'released',
      };
    }

    // Se payment plan não foi executado, não pode liberar
    throw new Error('PaymentPlan não foi executado ainda');
  }

  /**
   * Marcar serviço como completo
   */
  completeServiceRequest(requestId: string, completedBy: string): {
    requestId: string;
    completedAt: string;
    status: 'completed';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Validar que request foi aceita e está em progresso
    if (request.status !== 'accepted') {
      throw new Error('Serviço não pode ser marcado como completo (não foi aceito)');
    }

    // Buscar dispatch aceito
    const acceptedDispatch = Array.from(this.serviceDispatches.values())
      .find(d => d.requestId === requestId && d.status === 'accepted');

    if (!acceptedDispatch || !acceptedDispatch.acceptedBy) {
      throw new Error('Nenhum provider aceito encontrado para este serviço');
    }

    // Validar que completedBy é o provider que aceitou
    if (completedBy !== acceptedDispatch.acceptedBy) {
      throw new Error('Apenas o provider que aceitou pode marcar como completo');
    }

    // Marcar request como completo
    request.status = 'completed';
    const completedAt = new Date().toISOString();
    (request as any).completedAt = completedAt;

    this.serviceRequests.set(requestId, request);

    // Adicionar evento na timeline (será incluído na próxima consulta)
    // (não precisamos armazenar separadamente, pois será reconstruído)

    // Registrar evento econômico (local)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_completed',
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: completedBy,
          actorType: 'service_provider',
          reference_id: requestId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    // Alimentar SLA/Reputação
    // (já é feito via eventos de ordem, mas podemos registrar aqui também)
    marketplaceLogger.init('Serviço marcado como completo', {
      requestId: requestId,
      providerActorId: completedBy,
      completedAt: completedAt,
    });

    return {
      requestId: requestId,
      completedAt: completedAt,
      status: 'completed',
    };
  }

  // ============================================================
  // ORÇAMENTO ASSISTIDO + EXECUÇÃO VINCULADA (QUOTE → SERVICE)
  // ============================================================

  /**
   * Criar ServiceVisit (visita de orçamento)
   */
  createServiceVisit(input: {
    requestId: string;
    dispatchId: string;
    providerActorId: string;
    scheduledDate: string;
    scheduledTime: string;
  }): ServiceVisit {
    const visitId = `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const visit: ServiceVisit = {
      visitId: visitId,
      requestId: input.requestId,
      dispatchId: input.dispatchId,
      providerActorId: input.providerActorId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      status: 'visit_scheduled',
      createdAt: new Date().toISOString(),
    };

    this.serviceVisits.set(visitId, visit);

    marketplaceLogger.init('ServiceVisit criada', {
      visitId: visitId,
      requestId: input.requestId,
      providerActorId: input.providerActorId,
    });

    return visit;
  }

  /**
   * Marcar visita como completa
   */
  completeServiceVisit(visitId: string): ServiceVisit {
    const visit = this.serviceVisits.get(visitId);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }

    if (visit.status !== 'visit_scheduled') {
      throw new Error(`Visita não está em status 'visit_scheduled' (status atual: ${visit.status})`);
    }

    visit.status = 'visit_completed';
    visit.completedAt = new Date().toISOString();
    this.serviceVisits.set(visitId, visit);

    // Atualizar métricas de governança
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.calculateServiceGovernanceMetrics(
      visit.providerActorId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    marketplaceLogger.init('Visita marcada como completa', {
      visitId: visitId,
    });

    return visit;
  }

  /**
   * Buscar visitas por requestId
   */
  getServiceVisitsByRequest(requestId: string): ServiceVisit[] {
    return Array.from(this.serviceVisits.values())
      .filter(v => v.requestId === requestId);
  }

  /**
   * Buscar visita por ID
   */
  getServiceVisit(visitId: string): ServiceVisit | null {
    return this.serviceVisits.get(visitId) || null;
  }

  /**
   * Criar ServiceQuote (orçamento)
   */
  createServiceQuote(input: {
    requestId: string;
    visitId: string;
    providerActorId: string;
    serviceValue: { amountCents: number; currency: string };
    description: string;
    requiresMaterials: boolean;
    executionDate?: string;
    executionTime?: string;
  }): ServiceQuote {
    const visit = this.serviceVisits.get(input.visitId);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }

    if (visit.status !== 'visit_completed') {
      throw new Error('Visita precisa estar completa para enviar orçamento');
    }

    if (visit.providerActorId !== input.providerActorId) {
      throw new Error('Apenas o provider que realizou a visita pode enviar orçamento');
    }

    // Verificar se já existe quote pendente para esta visita
    const existingQuote = Array.from(this.serviceQuotes.values())
      .find(q => q.visitId === input.visitId && q.status === 'pending');
    if (existingQuote) {
      throw new Error('Já existe um orçamento pendente para esta visita');
    }

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const quote: ServiceQuote = {
      quoteId: quoteId,
      requestId: input.requestId,
      visitId: input.visitId,
      providerActorId: input.providerActorId,
      serviceValue: input.serviceValue,
      description: input.description,
      requiresMaterials: input.requiresMaterials,
      executionDate: input.executionDate,
      executionTime: input.executionTime,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.serviceQuotes.set(quoteId, quote);

    // Atualizar métricas de governança
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.calculateServiceGovernanceMetrics(
      input.providerActorId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_quote_sent',
          region: { country: 'BR', state: 'PR', city: 'Curitiba' }, // TODO: obter da request
          actorId: input.providerActorId,
          actorType: 'service_provider',
          reference_id: quoteId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('ServiceQuote criado', {
      quoteId: quoteId,
      requestId: input.requestId,
      visitId: input.visitId,
      serviceValue: input.serviceValue,
    });

    return quote;
  }

  /**
   * Aceitar ServiceQuote (gera ServiceBooking + ServiceOrder + PaymentHold)
   */
  acceptServiceQuote(quoteId: string, customerActorId: string): {
    quoteId: string;
    bookingId: string;
    orderId: string;
    paymentHoldId: string;
  } {
    const quote = this.serviceQuotes.get(quoteId);
    if (!quote) {
      throw new Error('Orçamento não encontrado');
    }

    if (quote.status !== 'pending') {
      throw new Error(`Orçamento não está em status 'pending' (status atual: ${quote.status})`);
    }

    const request = this.serviceRequests.get(quote.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode aceitar o orçamento');
    }

    // Buscar visit
    const visit = this.serviceVisits.get(quote.visitId);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }

    // Criar ServiceBooking
    const booking = this.createServiceBooking({
      offeringId: request.serviceItems[0].offeringId, // Usar primeiro item
      user_id: customerActorId,
      date: quote.executionDate || visit.scheduledDate,
      time: quote.executionTime || visit.scheduledTime,
      quantity: request.serviceItems[0].quantity,
    });

    // Confirmar booking (cria ServiceOrder)
    const confirmed = this.confirmServiceBooking(booking.booking_id);

    // Criar Order
    const order = this.createOrder(quote.providerActorId);
    await this.addOrderItem(order.orderId, confirmed.orderId, 1);

    // Criar Checkout
    const checkout = this.createCheckoutFromOrder(order.orderId);

    // Confirmar Checkout
    this.confirmCheckout(checkout.checkoutId);

    // Criar PaymentPlan
    const paymentPlan = this.createPaymentPlan(checkout.checkoutId, 'balance'); // Default balance

    // PaymentHold será criado automaticamente pelo createPaymentPlan se for serviço

    // Marcar quote como aceito
    quote.status = 'accepted';
    quote.acceptedAt = new Date().toISOString();
    quote.bookingId = booking.booking_id;
    quote.orderId = order.orderId;
    this.serviceQuotes.set(quoteId, quote);

    // Atualizar métricas de governança
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.calculateServiceGovernanceMetrics(
      quote.providerActorId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_quote_accepted',
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: customerActorId,
          actorType: 'user',
          reference_id: quoteId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    // Buscar payment hold criado
    const hold = this.getServicePaymentHoldByRequest(quote.requestId);

    marketplaceLogger.init('ServiceQuote aceito', {
      quoteId: quoteId,
      bookingId: booking.booking_id,
      orderId: order.orderId,
      paymentPlanId: paymentPlan.paymentPlanId,
    });

    return {
      quoteId: quoteId,
      bookingId: booking.booking_id,
      orderId: order.orderId,
      paymentHoldId: hold?.holdId || '',
    };
  }

  /**
   * Recusar ServiceQuote
   */
  declineServiceQuote(quoteId: string, customerActorId: string): ServiceQuote {
    const quote = this.serviceQuotes.get(quoteId);
    if (!quote) {
      throw new Error('Orçamento não encontrado');
    }

    if (quote.status !== 'pending') {
      throw new Error(`Orçamento não está em status 'pending' (status atual: ${quote.status})`);
    }

    const request = this.serviceRequests.get(quote.requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.requesterActorId !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode recusar o orçamento');
    }

    // Marcar quote como recusado
    quote.status = 'declined';
    quote.declinedAt = new Date().toISOString();
    this.serviceQuotes.set(quoteId, quote);

    // Atualizar métricas de governança
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.calculateServiceGovernanceMetrics(
      quote.providerActorId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_quote_declined',
          region: { country: 'BR', state: 'PR', city: request.city },
          actorId: customerActorId,
          actorType: 'user',
          reference_id: quoteId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('ServiceQuote recusado', {
      quoteId: quoteId,
    });

    return quote;
  }

  /**
   * Buscar quotes por requestId
   */
  getServiceQuotesByRequest(requestId: string): ServiceQuote[] {
    return Array.from(this.serviceQuotes.values())
      .filter(q => q.requestId === requestId);
  }

  /**
   * Buscar quote por ID
   */
  getServiceQuote(quoteId: string): ServiceQuote | null {
    return this.serviceQuotes.get(quoteId) || null;
  }

  // ============================================================
  // GOVERNANÇA ANTI-DESVIO DE SERVIÇOS (QUOTE & EXECUÇÃO)
  // ============================================================

  /**
   * Service Governance Metrics (in-memory)
   * Armazena métricas de governança por provider
   */
  private serviceGovernanceMetrics: Map<string, ServiceGovernanceMetrics> = new Map(); // provider_actor_id -> metrics

  /**
   * Calcular métricas de governança para um provider
   */
  calculateServiceGovernanceMetrics(
    providerActorId: string,
    startDate: string,
    endDate: string,
    categoryId?: string
  ): ServiceGovernanceMetrics {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Buscar todas as visitas do provider no período
    const visits = Array.from(this.serviceVisits.values())
      .filter(v => {
        if (v.providerActorId !== providerActorId) return false;
        const visitDate = new Date(v.createdAt);
        return visitDate >= start && visitDate <= end;
      });

    // Buscar todos os quotes do provider no período
    const quotes = Array.from(this.serviceQuotes.values())
      .filter(q => {
        if (q.providerActorId !== providerActorId) return false;
        const quoteDate = new Date(q.createdAt);
        return quoteDate >= start && quoteDate <= end;
      });

    // Calcular métricas
    const visitas_completadas = visits.filter(v => v.status === 'visit_completed').length;
    const visitas_sem_orcamento = visits.filter(v => {
      const hasQuote = quotes.some(q => q.visitId === v.visitId);
      return !hasQuote && v.status === 'visit_completed';
    }).length;

    const orcamentos_enviados = quotes.length;
    const orcamentos_aceitos = quotes.filter(q => q.status === 'accepted').length;
    const orcamentos_recusados = quotes.filter(q => q.status === 'declined').length;
    const orcamentos_expirados = quotes.filter(q => q.status === 'expired').length;

    // Taxa de conversão: quotes aceitos / visitas completadas
    const taxa_quote_to_execution = visitas_completadas > 0
      ? (orcamentos_aceitos / visitas_completadas) * 100
      : 0;

    // Determinar status baseado em regras determinísticas
    let status: 'healthy' | 'warning' | 'sla_violation' | 'trust_penalty' = 'healthy';
    const taxa_visitas_sem_orcamento = visitas_completadas > 0
      ? (visitas_sem_orcamento / visitas_completadas) * 100
      : 0;

    // Regra 1: >30% visitas sem orçamento → warning
    if (taxa_visitas_sem_orcamento > 30) {
      status = 'warning';
    }

    // Regra 2: >50% visitas sem orçamento por 30 dias → SLA violation
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 30 && taxa_visitas_sem_orcamento > 50) {
      status = 'sla_violation';
    }

    // Buscar métricas anteriores para contar warnings/violations
    const existingMetrics = this.serviceGovernanceMetrics.get(providerActorId);
    const warnings_count = existingMetrics?.warningsCount || 0;
    const sla_violations_count = existingMetrics?.slaViolationsCount || 0;
    const trust_downgrades_count = existingMetrics?.trustDowngradesCount || 0;

    const metrics: ServiceGovernanceMetrics = {
      providerActorId: providerActorId,
      categoryId: categoryId,
      period: {
        startDate,
        endDate,
      },
      visitasSemOrcamento: visitas_sem_orcamento,
      orcamentosEnviados: orcamentos_enviados,
      orcamentosAceitos: orcamentos_aceitos,
      orcamentosRecusados: orcamentos_recusados,
      orcamentosExpirados: orcamentos_expirados,
      taxaQuoteToExecution: taxa_quote_to_execution,
      status,
      warningsCount: status === 'warning' ? warnings_count + 1 : warnings_count,
      slaViolationsCount: status === 'sla_violation' ? sla_violations_count + 1 : sla_violations_count,
      trustDowngradesCount: trust_downgrades_count,
      calculatedAt: new Date().toISOString(),
      lastWarningAt: status === 'warning' ? new Date().toISOString() : existingMetrics?.lastWarningAt,
      lastSlaViolationAt: status === 'sla_violation' ? new Date().toISOString() : existingMetrics?.lastSlaViolationAt,
      lastTrustDowngradeAt: existingMetrics?.lastTrustDowngradeAt,
    };

    this.serviceGovernanceMetrics.set(providerActorId, metrics);

    // Aplicar penalidades se necessário
    this.applyGovernancePenalties(providerActorId, metrics);

    return metrics;
  }

  /**
   * Aplicar penalidades de governança
   */
  private applyGovernancePenalties(providerActorId: string, metrics: ServiceGovernanceMetrics): void {
    // Warning: apenas registrar, sem ação
    if (metrics.status === 'warning' && metrics.warningsCount === 1) {
      marketplaceLogger.init('Warning de governança aplicado', {
        providerActorId: providerActorId,
        taxa_visitas_sem_orcamento: metrics.visitasSemOrcamento,
      });
    }

    // SLA Violation: registrar no SLAContract
    if (metrics.status === 'sla_violation') {
      try {
        if (typeof (this as any).recordOrderEvent === 'function') {
          (this as any).recordOrderEvent({
            actorId: providerActorId,
            eventType: 'service_governance_sla_violation',
            metadata: {
              visitas_sem_orcamento: metrics.visitasSemOrcamento,
              taxa_visitas_sem_orcamento: metrics.visitasSemOrcamento / (metrics.orcamentosEnviados + metrics.visitasSemOrcamento) * 100,
            },
          });
        }
      } catch (err) {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('SLA violation de governança registrada', {
        providerActorId: providerActorId,
        sla_violations_count: metrics.slaViolationsCount,
      });
    }

    // Trust Downgrade: apenas se reincidente (nunca automático de primeira)
    if (metrics.slaViolationsCount >= 2 && metrics.status === 'sla_violation') {
      try {
        if (typeof (this as any).downgradeTrustLevel === 'function') {
          (this as any).downgradeTrustLevel(providerActorId, 'service_governance_recurring_violation');
          metrics.trustDowngradesCount += 1;
          metrics.lastTrustDowngradeAt = new Date().toISOString();
          this.serviceGovernanceMetrics.set(providerActorId, metrics);
        }
      } catch (err) {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('Trust downgrade aplicado por governança', {
        providerActorId: providerActorId,
        trust_downgrades_count: metrics.trustDowngradesCount,
      });
    }
  }

  /**
   * Buscar métricas de governança de um provider
   */
  getServiceGovernanceMetrics(providerActorId: string): ServiceGovernanceMetrics | null {
    return this.serviceGovernanceMetrics.get(providerActorId) || null;
  }

  // ============================================================
  // TEMPLATES CANÔNICOS DE CATÁLOGO POR CATEGORIA (IMPORTAÇÃO INICIAL)
  // ============================================================

  /**
   * Product Templates (in-memory)
   * Templates canônicos de produtos mantidos na matriz
   */
  private productTemplates: Map<string, ProductTemplate> = new Map(); // template_id -> template

  /**
   * Service Templates Canonical (in-memory)
   * Templates canônicos de serviços mantidos na matriz
   */
  private serviceTemplatesCanonical: Map<string, ServiceTemplateCanonical> = new Map(); // template_id -> template

  /**
   * Template Usage Audit (in-memory)
   * Auditoria de uso: quais categorias usam quais templates
   */
  private templateUsageAudit: Map<string, {
    templateId: string;
    template_type: 'product' | 'service';
    categoryId: string;
    business_template_id?: string;
    usage_count: number;
    last_usedAt: string;
  }> = new Map(); // template_id -> audit

  /**
   * Inicializar templates canônicos de produtos por categoria
   */
  initializeProductTemplates(): void {
    const templates: ProductTemplate[] = [
      // Supermercado
      {
        templateId: 'prod-template-rice-1kg',
        name: 'Arroz Tipo 1 (1kg)',
        description: 'Arroz branco tipo 1, pacote de 1kg',
        categoryId: 'cat-supermarket',
        type: 'industrialized',
        defaultUnit: 'pacote',
        canonicalImages: {
          main: '/templates/products/rice-1kg.jpg',
          thumbnail: '/templates/products/rice-1kg-thumb.jpg',
        },
        attributes: {
          volume: '1kg',
          embalagem: 'plástico',
          marca_sugerida: 'Tio João',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'prod-template-beans-1kg',
        name: 'Feijão Preto (1kg)',
        description: 'Feijão preto, pacote de 1kg',
        categoryId: 'cat-supermarket',
        type: 'industrialized',
        defaultUnit: 'pacote',
        canonicalImages: {
          main: '/templates/products/beans-1kg.jpg',
          thumbnail: '/templates/products/beans-1kg-thumb.jpg',
        },
        attributes: {
          volume: '1kg',
          embalagem: 'plástico',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'prod-template-oil-900ml',
        name: 'Óleo de Soja (900ml)',
        description: 'Óleo de soja refinado, garrafa de 900ml',
        categoryId: 'cat-supermarket',
        type: 'industrialized',
        defaultUnit: 'garrafa',
        canonicalImages: {
          main: '/templates/products/oil-900ml.jpg',
          thumbnail: '/templates/products/oil-900ml-thumb.jpg',
        },
        attributes: {
          volume: '900ml',
          embalagem: 'plástico',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Farmácia
      {
        templateId: 'prod-template-paracetamol',
        name: 'Paracetamol 500mg',
        description: 'Paracetamol comprimidos 500mg, caixa com 20 comprimidos',
        categoryId: 'cat-medicines',
        type: 'industrialized',
        defaultUnit: 'caixa',
        canonicalImages: {
          main: '/templates/products/paracetamol.jpg',
          thumbnail: '/templates/products/paracetamol-thumb.jpg',
        },
        attributes: {
          volume: '20 comprimidos',
          embalagem: 'cartela',
          prescricao: 'isento',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'prod-template-ibuprofen',
        name: 'Ibuprofeno 400mg',
        description: 'Ibuprofeno comprimidos 400mg, caixa com 20 comprimidos',
        categoryId: 'cat-medicines',
        type: 'industrialized',
        defaultUnit: 'caixa',
        canonicalImages: {
          main: '/templates/products/ibuprofen.jpg',
          thumbnail: '/templates/products/ibuprofen-thumb.jpg',
        },
        attributes: {
          volume: '20 comprimidos',
          embalagem: 'cartela',
          prescricao: 'isento',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Distribuidora de Bebidas
      {
        templateId: 'prod-template-beer-350ml',
        name: 'Cerveja (350ml)',
        description: 'Cerveja lata 350ml',
        categoryId: 'cat-beverages',
        type: 'industrialized',
        defaultUnit: 'lata',
        canonicalImages: {
          main: '/templates/products/beer-350ml.jpg',
          thumbnail: '/templates/products/beer-350ml-thumb.jpg',
        },
        attributes: {
          volume: '350ml',
          embalagem: 'lata',
          teor_alcoolico: '4.5%',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'prod-template-soda-2l',
        name: 'Refrigerante (2L)',
        description: 'Refrigerante garrafa 2 litros',
        categoryId: 'cat-beverages',
        type: 'industrialized',
        defaultUnit: 'garrafa',
        canonicalImages: {
          main: '/templates/products/soda-2l.jpg',
          thumbnail: '/templates/products/soda-2l-thumb.jpg',
        },
        attributes: {
          volume: '2L',
          embalagem: 'PET',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Material de Construção
      {
        templateId: 'prod-template-cement-50kg',
        name: 'Cimento (50kg)',
        description: 'Cimento Portland, saco de 50kg',
        categoryId: 'cat-construction',
        type: 'industrialized',
        defaultUnit: 'saco',
        canonicalImages: {
          main: '/templates/products/cement-50kg.jpg',
          thumbnail: '/templates/products/cement-50kg-thumb.jpg',
        },
        attributes: {
          volume: '50kg',
          embalagem: 'papel',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'prod-template-brick',
        name: 'Tijolo Comum',
        description: 'Tijolo cerâmico comum',
        categoryId: 'cat-construction',
        type: 'industrialized',
        defaultUnit: 'milheiro',
        canonicalImages: {
          main: '/templates/products/brick.jpg',
          thumbnail: '/templates/products/brick-thumb.jpg',
        },
        attributes: {
          volume: '1000 unidades',
          embalagem: 'pallet',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];

    for (const template of templates) {
      this.productTemplates.set(template.templateId, template);
    }

    marketplaceLogger.init('Product templates canônicos inicializados', {
      count: templates.length,
    });
  }

  /**
   * Inicializar templates canônicos de serviços por categoria
   */
  initializeServiceTemplatesCanonical(): void {
    const templates: ServiceTemplateCanonical[] = [
      // Serviços de Entrega
      {
        templateId: 'service-template-delivery',
        name: 'Entrega',
        description: 'Serviço de entrega de produtos',
        categoryId: 'cat-delivery',
        type: 'one_time',
        defaultDurationMinutes: 60,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/delivery-icon.png',
          banner: '/templates/services/delivery-banner.png',
        },
        attributes: {
          requires_vehicle: true,
          max_distance_km: 10,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Serviços de Saúde
      {
        templateId: 'service-template-prescription',
        name: 'Prescrição Médica',
        description: 'Serviço de prescrição e orientação farmacêutica',
        categoryId: 'cat-health',
        type: 'one_time',
        defaultDurationMinutes: 15,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/prescription-icon.png',
          banner: '/templates/services/prescription-banner.png',
        },
        attributes: {
          requires_license: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'service-template-consultation',
        name: 'Consulta Médica',
        description: 'Consulta médica geral',
        categoryId: 'cat-health',
        type: 'one_time',
        defaultDurationMinutes: 30,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/consultation-icon.png',
          banner: '/templates/services/consultation-banner.png',
        },
        attributes: {
          requires_license: true,
          requires_appointment: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'service-template-exam',
        name: 'Exame Médico',
        description: 'Exame médico geral',
        categoryId: 'cat-health',
        type: 'quote_required',
        defaultDurationMinutes: 60,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/exam-icon.png',
          banner: '/templates/services/exam-banner.png',
        },
        attributes: {
          requires_license: true,
          requires_appointment: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Serviços de Fitness
      {
        templateId: 'service-template-gym-membership',
        name: 'Mensalidade de Academia',
        description: 'Plano mensal de academia',
        categoryId: 'cat-fitness',
        type: 'recurring',
        defaultDurationMinutes: undefined,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/gym-icon.png',
          banner: '/templates/services/gym-banner.png',
        },
        attributes: {
          billingCycle: 'monthly',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'service-template-personal-training',
        name: 'Personal Trainer',
        description: 'Aula particular de personal trainer',
        categoryId: 'cat-fitness',
        type: 'one_time',
        defaultDurationMinutes: 60,
        defaultPricingModel: 'hourly',
        canonicalImages: {
          icon: '/templates/services/personal-training-icon.png',
          banner: '/templates/services/personal-training-banner.png',
        },
        attributes: {
          requires_certification: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Serviços de Beleza
      {
        templateId: 'service-template-haircut',
        name: 'Corte de Cabelo',
        description: 'Corte de cabelo masculino/feminino',
        categoryId: 'cat-beauty',
        type: 'one_time',
        defaultDurationMinutes: 45,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/haircut-icon.png',
          banner: '/templates/services/haircut-banner.png',
        },
        attributes: {
          requires_appointment: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'service-template-manicure',
        name: 'Manicure',
        description: 'Serviço de manicure',
        categoryId: 'cat-beauty',
        type: 'one_time',
        defaultDurationMinutes: 60,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/manicure-icon.png',
          banner: '/templates/services/manicure-banner.png',
        },
        attributes: {
          requires_appointment: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'service-template-facial',
        name: 'Limpeza de Pele',
        description: 'Limpeza de pele facial',
        categoryId: 'cat-beauty',
        type: 'one_time',
        defaultDurationMinutes: 90,
        defaultPricingModel: 'fixed',
        canonicalImages: {
          icon: '/templates/services/facial-icon.png',
          banner: '/templates/services/facial-banner.png',
        },
        attributes: {
          requires_appointment: true,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Serviços de Alimentação
      {
        templateId: 'service-template-catering',
        name: 'Buffet/Catering',
        description: 'Serviço de buffet e catering para eventos',
        categoryId: 'cat-food',
        type: 'quote_required',
        defaultDurationMinutes: undefined,
        defaultPricingModel: 'per_unit',
        canonicalImages: {
          icon: '/templates/services/catering-icon.png',
          banner: '/templates/services/catering-banner.png',
        },
        attributes: {
          requires_quote: true,
          min_guests: 10,
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];

    for (const template of templates) {
      this.serviceTemplatesCanonical.set(template.templateId, template);
    }

    marketplaceLogger.init('Service templates canônicos inicializados', {
      count: templates.length,
    });
  }

  // ============================================================
  // BUSINESS TEMPLATES (ARQUÉTIPOS DE EMPRESA) + ATIVAÇÃO GUIADA
  // ============================================================

  /**
   * Business Templates (in-memory)
   * Arquétipos canônicos de empresa
   */
  private businessTemplates: Map<string, BusinessTemplate> = new Map(); // template_id -> template

  /**
   * Business Template Usage Audit (in-memory)
   * Auditoria de uso: quantas empresas usam cada template
   */
  private businessTemplateUsageAudit: Map<string, {
    templateId: string;
    usage_count: number;
    last_usedAt: string;
    companies: string[]; // IDs de empresas que usam este template
  }> = new Map(); // template_id -> audit

  /**
   * Company Activation States (in-memory)
   * Estados de ativação guiada por empresa
   */
  private companyActivationStates: Map<string, {
    companyId: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdvEnabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  }> = new Map(); // company_id -> state

  /**
   * Inicializar Business Templates (arquétipos canônicos)
   */
  initializeBusinessTemplates(): void {
    const templates: BusinessTemplate[] = [
      // Supermercado
      {
        templateId: 'supermarket',
        name: 'Supermercado',
        description: 'Supermercado com produtos industrializados e próprios',
        type: 'supermarket',
        version: 'v2.0',
        categoryIds: ['cat-supermarket'],
        allowedProductTypes: 'both',
        defaultProductTemplates: [
          'prod-template-rice-1kg',
          'prod-template-beans-1kg',
          'prod-template-oil-900ml',
        ],
        defaultServiceTemplates: ['service-template-delivery'],
        operationalConfig: {
          requiresAgenda: false,
          supportsDispatch: true,
          supportsQuoteFlow: false,
          supportsPdv: true,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'sales'],
        recommendedPlan: 'Basic',
        canonicalImages: {
          logo: '/templates/business/supermarket-logo.png',
          banner: '/templates/business/supermarket-banner.png',
          icon: '/templates/business/supermarket-icon.png',
        },
        flags: {
          allowsOwnProducts: true,
          allowsIndustrialProducts: true,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Farmácia
      {
        templateId: 'pharmacy',
        name: 'Farmácia',
        description: 'Farmácia com medicamentos e produtos de saúde',
        type: 'pharmacy',
        version: 'v2.0',
        categoryIds: ['cat-medicines', 'cat-health'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: [
          'prod-template-paracetamol',
          'prod-template-ibuprofen',
        ],
        defaultServiceTemplates: [
          'service-template-prescription',
          'service-template-consultation',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: true,
          supportsQuoteFlow: false,
          supportsPdv: true,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'sales', 'service_operator'],
        recommendedPlan: 'Professional',
        canonicalImages: {
          logo: '/templates/business/pharmacy-logo.png',
          banner: '/templates/business/pharmacy-banner.png',
          icon: '/templates/business/pharmacy-icon.png',
        },
        flags: {
          allowsOwnProducts: false,
          allowsIndustrialProducts: true,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Distribuidora de Bebidas
      {
        templateId: 'beverage_distributor',
        name: 'Distribuidora de Bebidas',
        description: 'Distribuidora de bebidas alcoólicas e não alcoólicas',
        type: 'beverage_distributor',
        version: 'v2.0',
        categoryIds: ['cat-beverages'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: [
          'prod-template-beer-350ml',
          'prod-template-soda-2l',
        ],
        defaultServiceTemplates: ['service-template-delivery'],
        operationalConfig: {
          requiresAgenda: false,
          supportsDispatch: true,
          supportsQuoteFlow: false,
          supportsPdv: true,
          supportsB2b: true,
        },
        defaultRolesEnabled: ['manager', 'sales'],
        recommendedPlan: 'Professional',
        canonicalImages: {
          logo: '/templates/business/beverage-logo.png',
          banner: '/templates/business/beverage-banner.png',
          icon: '/templates/business/beverage-icon.png',
        },
        flags: {
          allowsOwnProducts: false,
          allowsIndustrialProducts: true,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Academia
      {
        templateId: 'gym',
        name: 'Academia',
        description: 'Academia com serviços de treinamento e mensalidades',
        type: 'gym',
        version: 'v2.0',
        categoryIds: ['cat-fitness'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: [
          'service-template-gym-membership',
          'service-template-personal-training',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: false,
          supportsQuoteFlow: false,
          supportsPdv: false,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'service_operator'],
        recommendedPlan: 'Basic',
        canonicalImages: {
          logo: '/templates/business/gym-logo.png',
          banner: '/templates/business/gym-banner.png',
          icon: '/templates/business/gym-icon.png',
        },
        flags: {
          allowsOwnProducts: true,
          allowsIndustrialProducts: false,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Clínica
      {
        templateId: 'clinic',
        name: 'Clínica Médica',
        description: 'Clínica médica com consultas e exames',
        type: 'clinic',
        version: 'v2.0',
        categoryIds: ['cat-health'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: [],
        defaultServiceTemplates: [
          'service-template-consultation',
          'service-template-exam',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: false,
          supportsQuoteFlow: true,
          supportsPdv: false,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'service_operator', 'accountant'],
        recommendedPlan: 'Professional',
        canonicalImages: {
          logo: '/templates/business/clinic-logo.png',
          banner: '/templates/business/clinic-banner.png',
          icon: '/templates/business/clinic-icon.png',
        },
        flags: {
          allowsOwnProducts: false,
          allowsIndustrialProducts: true,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Prestador de Serviços
      {
        templateId: 'service_provider',
        name: 'Prestador de Serviços',
        description: 'Prestador de serviços gerais (limpeza, manutenção, etc.)',
        type: 'service_provider',
        version: 'v2.0',
        categoryIds: ['cat-home-services'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: [
          'service-template-cleaning',
          'service-template-maintenance',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: true,
          supportsQuoteFlow: true,
          supportsPdv: false,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'service_operator'],
        recommendedPlan: 'Basic',
        canonicalImages: {
          logo: '/templates/business/service-provider-logo.png',
          banner: '/templates/business/service-provider-banner.png',
          icon: '/templates/business/service-provider-icon.png',
        },
        flags: {
          allowsOwnProducts: true,
          allowsIndustrialProducts: false,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Restaurante
      {
        templateId: 'restaurant',
        name: 'Restaurante',
        description: 'Restaurante com cardápio e serviços de catering',
        type: 'restaurant',
        version: 'v2.0',
        categoryIds: ['cat-food'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: [
          'service-template-catering',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: true,
          supportsQuoteFlow: true,
          supportsPdv: true,
          supportsB2b: true,
        },
        defaultRolesEnabled: ['manager', 'sales', 'service_operator'],
        recommendedPlan: 'Professional',
        canonicalImages: {
          logo: '/templates/business/restaurant-logo.png',
          banner: '/templates/business/restaurant-banner.png',
          icon: '/templates/business/restaurant-icon.png',
        },
        flags: {
          allowsOwnProducts: true,
          allowsIndustrialProducts: false,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Material de Construção
      {
        templateId: 'construction_material',
        name: 'Material de Construção',
        description: 'Loja de materiais de construção',
        type: 'construction_material',
        version: 'v2.0',
        categoryIds: ['cat-construction'],
        allowedProductTypes: 'both',
        defaultProductTemplates: [
          'prod-template-cement-50kg',
          'prod-template-brick',
        ],
        defaultServiceTemplates: ['service-template-delivery'],
        operationalConfig: {
          requiresAgenda: false,
          supportsDispatch: true,
          supportsQuoteFlow: false,
          supportsPdv: true,
          supportsB2b: true,
        },
        defaultRolesEnabled: ['manager', 'sales'],
        recommendedPlan: 'Professional',
        canonicalImages: {
          logo: '/templates/business/construction-logo.png',
          banner: '/templates/business/construction-banner.png',
          icon: '/templates/business/construction-icon.png',
        },
        flags: {
          allowsOwnProducts: true,
          allowsIndustrialProducts: true,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Serviços de Beleza
      {
        templateId: 'beauty_services',
        name: 'Salão de Beleza',
        description: 'Salão de beleza com serviços de corte, manicure, etc.',
        type: 'beauty_services',
        version: 'v2.0',
        categoryIds: ['cat-beauty'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: [
          'service-template-haircut',
          'service-template-manicure',
          'service-template-facial',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: false,
          supportsQuoteFlow: false,
          supportsPdv: false,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'service_operator'],
        recommendedPlan: 'Basic',
        canonicalImages: {
          logo: '/templates/business/beauty-logo.png',
          banner: '/templates/business/beauty-banner.png',
          icon: '/templates/business/beauty-icon.png',
        },
        flags: {
          allowsOwnProducts: true,
          allowsIndustrialProducts: false,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Clínica de Saúde
      {
        templateId: 'health_clinic',
        name: 'Clínica de Saúde',
        description: 'Clínica de saúde com consultas e exames',
        type: 'health_clinic',
        version: 'v2.0',
        categoryIds: ['cat-health'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: [],
        defaultServiceTemplates: [
          'service-template-consultation',
          'service-template-exam',
        ],
        operationalConfig: {
          requiresAgenda: true,
          supportsDispatch: false,
          supportsQuoteFlow: true,
          supportsPdv: false,
          supportsB2b: false,
        },
        defaultRolesEnabled: ['manager', 'service_operator', 'accountant'],
        recommendedPlan: 'Professional',
        canonicalImages: {
          logo: '/templates/business/health-clinic-logo.png',
          banner: '/templates/business/health-clinic-banner.png',
          icon: '/templates/business/health-clinic-icon.png',
        },
        flags: {
          allowsOwnProducts: false,
          allowsIndustrialProducts: true,
          allowsServices: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];

    for (const template of templates) {
      this.businessTemplates.set(template.templateId, template);
    }

    marketplaceLogger.init('Business templates (arquétipos) inicializados', {
      count: templates.length,
    });
  }

  /**
   * Buscar todos os Business Templates
   */
  getAllBusinessTemplates(): BusinessTemplate[] {
    return Array.from(this.businessTemplates.values());
  }

  /**
   * Buscar Business Template por ID
   */
  getBusinessTemplate(templateId: string): BusinessTemplate | null {
    return this.businessTemplates.get(templateId) || null;
  }

  /**
   * Buscar Business Templates por tipo
   */
  getBusinessTemplatesByType(type: BusinessTemplate['type']): BusinessTemplate[] {
    return Array.from(this.businessTemplates.values())
      .filter(t => t.type === type);
  }

  /**
   * Atualizar estado de ativação de uma empresa
   */
  updateCompanyActivationState(
    companyId: string,
    updates: Partial<{
      catalog_ready: boolean;
      services_ready: boolean;
      agenda_configured: boolean;
      dispatch_enabled: boolean;
      quote_flow_enabled: boolean;
      pdvEnabled: boolean;
      b2b_enabled: boolean;
    }>
  ): {
    companyId: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdvEnabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  } {
    let state = this.companyActivationStates.get(companyId);
    if (!state) {
      state = {
        companyId: companyId,
        catalog_ready: false,
        services_ready: false,
        agenda_configured: false,
        dispatch_enabled: false,
        quote_flow_enabled: false,
        pdvEnabled: false,
        b2b_enabled: false,
        updatedAt: new Date().toISOString(),
      };
    }

    // Atualizar campos
    Object.assign(state, updates);
    state.updatedAt = new Date().toISOString();

    this.companyActivationStates.set(companyId, state);

    marketplaceLogger.init('Estado de ativação atualizado', {
      companyId: companyId,
      updates,
    });

    return state;
  }

  /**
   * Buscar estado de ativação de uma empresa
   */
  getCompanyActivationState(companyId: string): {
    companyId: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdvEnabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  } | null {
    return this.companyActivationStates.get(companyId) || null;
  }

  /**
   * Registrar uso de Business Template
   */
  recordBusinessTemplateUsage(templateId: string, companyId: string): void {
    let audit = this.businessTemplateUsageAudit.get(templateId);
    if (!audit) {
      audit = {
        templateId: templateId,
        usage_count: 0,
        last_usedAt: new Date().toISOString(),
        companies: [],
      };
    }

    if (!audit.companies.includes(companyId)) {
      audit.companies.push(companyId);
      audit.usage_count += 1;
    }

    audit.last_usedAt = new Date().toISOString();
    this.businessTemplateUsageAudit.set(templateId, audit);
  }

  /**
   * Buscar auditoria de uso de Business Templates
   */
  getBusinessTemplateUsageAudit(templateId?: string): Array<{
    templateId: string;
    usage_count: number;
    last_usedAt: string;
    companies: string[];
  }> {
    if (templateId) {
      const audit = this.businessTemplateUsageAudit.get(templateId);
      return audit ? [audit] : [];
    }

    return Array.from(this.businessTemplateUsageAudit.values());
  }

  /**
   * Buscar product templates por categoria
   */
  getProductTemplatesByCategory(categoryId: string): ProductTemplate[] {
    return Array.from(this.productTemplates.values())
      .filter(t => t.categoryId === categoryId);
  }

  /**
   * Buscar service templates canônicos por categoria
   */
  getServiceTemplatesCanonicalByCategory(categoryId: string): ServiceTemplateCanonical[] {
    return Array.from(this.serviceTemplatesCanonical.values())
      .filter(t => t.categoryId === categoryId);
  }

  /**
   * Importar templates de produtos para uma loja (persistido via productCatalogService + storeProductService)
   */
  async importProductTemplates(
    tenantId: string,
    storeId: string,
    templateIds: string[],
    options?: {
      import_all?: boolean;
      import_partial?: boolean;
      skip_items?: string[];
    }
  ): Promise<{
    imported_count: number;
    skipped_count: number;
    imported_templates: Array<{
      templateId: string;
      store_product_id?: string;
      status: 'imported' | 'skipped';
    }>;
  }> {
    const imported: Array<{
      templateId: string;
      store_product_id?: string;
      status: 'imported' | 'skipped';
    }> = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (const templateId of templateIds) {
      if (options?.skip_items?.includes(templateId)) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      const template = this.productTemplates.get(templateId);
      if (!template) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      const alreadyActivated = await storeProductService.hasActivationForTemplate(tenantId, storeId, templateId);
      if (alreadyActivated) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      let productId = await storeProductService.findProductByTemplateId(tenantId, templateId);
      if (!productId) {
        const product = await productCatalogService.createProduct(tenantId, {
          name: template.name,
          description: template.description ?? '',
          categoryId: template.categoryId,
          productType: 'UNIT',
          metadata: { templateId },
        });
        productId = product.id;
      }

      await storeProductService.addProductToStore(tenantId, storeId, productId, 'inactive');

      imported.push({
        templateId: templateId,
        store_product_id: productId,
        status: 'imported',
      });
      importedCount++;

      const auditKey = `product-${templateId}`;
      const existingAudit = this.templateUsageAudit.get(auditKey);
      if (existingAudit) {
        existingAudit.usage_count += 1;
        existingAudit.last_usedAt = new Date().toISOString();
      } else {
        this.templateUsageAudit.set(auditKey, {
          templateId: templateId,
          template_type: 'product',
          categoryId: template.categoryId,
          usage_count: 1,
          last_usedAt: new Date().toISOString(),
        });
      }
    }

    marketplaceLogger.init('Product templates importados', {
      storeId: storeId,
      imported_count: importedCount,
      skipped_count: skippedCount,
    });

    return {
      imported_count: importedCount,
      skipped_count: skippedCount,
      imported_templates: imported,
    };
  }

  /**
   * Importar templates de serviços para uma loja
   */
  importServiceTemplates(
    storeId: string,
    templateIds: string[],
    options?: {
      import_all?: boolean;
      import_partial?: boolean;
      skip_items?: string[];
    }
  ): {
    imported_count: number;
    skipped_count: number;
    imported_templates: Array<{
      templateId: string;
      offering_id?: string;
      status: 'imported' | 'skipped';
    }>;
  } {
    const imported: Array<{
      templateId: string;
      offering_id?: string;
      status: 'imported' | 'skipped';
    }> = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (const templateId of templateIds) {
      // Verificar se deve pular
      if (options?.skip_items?.includes(templateId)) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      const template = this.serviceTemplatesCanonical.get(templateId);
      if (!template) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Verificar se já existe offering para este template
      const existingOffering = Array.from(this.serviceOfferings.values())
        .find(so => so.templateId === templateId && so.storeId === storeId);

      if (existingOffering) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Criar ServiceOffering em estado inactive
      const offeringId = `offering-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const offering: any = {
        offering_id: offeringId,
        storeId: storeId,
        templateId: templateId,
        price: {
          amountCents: 0, // Preço padrão, será ajustado pelo dono
          currency: 'BRL',
        },
        duration_minutes: template.defaultDurationMinutes || 60,
        recurrence: template.type === 'recurring' ? { cycle: 'monthly' } : null,
        isActive: false, // Inactive por padrão
      };

      this.serviceOfferings.set(offeringId, offering);

      imported.push({
        templateId: templateId,
        offering_id: offeringId,
        status: 'imported',
      });
      importedCount++;

      // Registrar auditoria de uso
      const auditKey = `service-${templateId}`;
      const existingAudit = this.templateUsageAudit.get(auditKey);
      if (existingAudit) {
        existingAudit.usage_count += 1;
        existingAudit.last_usedAt = new Date().toISOString();
      } else {
        this.templateUsageAudit.set(auditKey, {
          templateId: templateId,
          template_type: 'service',
          categoryId: template.categoryId,
          usage_count: 1,
          last_usedAt: new Date().toISOString(),
        });
      }
    }

    marketplaceLogger.init('Service templates importados', {
      storeId: storeId,
      imported_count: importedCount,
      skipped_count: skippedCount,
    });

    return {
      imported_count: importedCount,
      skipped_count: skippedCount,
      imported_templates: imported,
    };
  }

  /**
   * Importar catálogo canônico para uma empresa
   * Cria produtos/serviços em estado "inactive"
   * Usa ProductTemplate e ServiceTemplateCanonical
   */
  async importCanonicalCatalog(
    tenantId: string,
    companyId: string,
    storeId: string,
    businessTemplateId: string,
    options?: {
      import_all?: boolean;
      import_partial?: boolean;
      product_template_ids?: string[];
      serviceTemplateIds?: string[];
      skip_product_templates?: string[];
      skip_service_templates?: string[];
    }
  ): Promise<{
    imported_products: number;
    imported_services: number;
    imported_categories: number;
    imported_templates: {
      products: Array<{ templateId: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
      services: Array<{ templateId: string; offering_id?: string; status: 'imported' | 'skipped' }>;
    };
  }> {
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) {
      throw new Error('Business template não encontrado');
    }

    // Buscar empresa/onboarding
    const onboarding = Array.from(this.companyOnboardings.values())
      .find(o => o.companyId === companyId);
    if (!onboarding) {
      throw new Error('Onboarding não encontrado');
    }

    const importedCategories = businessTemplate.categoryIds.length;

    // Importar product templates
    let productTemplateIds: string[] = [];
    if (options?.import_all) {
      // Importar todos os templates do business template
      const allProductTemplates = this.getProductTemplatesByBusinessTemplate(businessTemplateId);
      productTemplateIds = allProductTemplates.map(t => t.templateId);
    } else if (options?.product_template_ids) {
      productTemplateIds = options.product_template_ids;
    } else {
      // Importar apenas os sugeridos pelo business template
      productTemplateIds = businessTemplate.defaultProductTemplates;
    }

    const productImportResult = await this.importProductTemplates(tenantId, storeId, productTemplateIds, {
      import_all: options?.import_all,
      import_partial: options?.import_partial,
      skip_items: options?.skip_product_templates,
    });

    // Importar service templates
    let serviceTemplateIds: string[] = [];
    if (options?.import_all) {
      // Importar todos os templates do business template
      const allServiceTemplates = this.getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId);
      serviceTemplateIds = allServiceTemplates.map(t => t.templateId);
    } else if (options?.serviceTemplateIds) {
      serviceTemplateIds = options.serviceTemplateIds;
    } else {
      // Importar apenas os padrão do business template
      serviceTemplateIds = businessTemplate.defaultServiceTemplates;
    }

    const serviceImportResult = this.importServiceTemplates(storeId, serviceTemplateIds, {
      import_all: options?.import_all,
      import_partial: options?.import_partial,
      skip_items: options?.skip_service_templates,
    });

    marketplaceLogger.init('Catálogo canônico importado', {
      companyId: companyId,
      storeId: storeId,
      business_templateId: businessTemplateId,
      imported_products: productImportResult.imported_count,
      imported_services: serviceImportResult.imported_count,
      imported_categories: importedCategories,
    });

    return {
      imported_products: productImportResult.imported_count,
      imported_services: serviceImportResult.imported_count,
      imported_categories: importedCategories,
      imported_templates: {
        products: productImportResult.imported_templates,
        services: serviceImportResult.imported_templates,
      },
    };
  }

  /**
   * Buscar product template por ID
   */
  getProductTemplate(templateId: string): ProductTemplate | null {
    return this.productTemplates.get(templateId) || null;
  }

  /**
   * Buscar service template canônico por ID
   */
  getServiceTemplateCanonical(templateId: string): ServiceTemplateCanonical | null {
    return this.serviceTemplatesCanonical.get(templateId) || null;
  }

  /**
   * Listar todos os product templates
   */
  getAllProductTemplates(): ProductTemplate[] {
    return Array.from(this.productTemplates.values());
  }

  /**
   * Listar todos os service templates canônicos
   */
  getAllServiceTemplatesCanonical(): ServiceTemplateCanonical[] {
    return Array.from(this.serviceTemplatesCanonical.values());
  }

  /**
   * Buscar auditoria de uso de templates
   */
  getTemplateUsageAudit(templateId?: string, categoryId?: string): Array<{
    templateId: string;
    template_type: 'product' | 'service';
    categoryId: string;
    business_template_id?: string;
    usage_count: number;
    last_usedAt: string;
  }> {
    let audits = Array.from(this.templateUsageAudit.values());

    if (templateId) {
      audits = audits.filter(a => a.templateId === templateId);
    }

    if (categoryId) {
      audits = audits.filter(a => a.categoryId === categoryId);
    }

    return audits;
  }

  /**
   * Buscar product templates por business template
   */
  getProductTemplatesByBusinessTemplate(businessTemplateId: string): ProductTemplate[] {
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) {
      return [];
    }

    // Buscar templates pelos IDs definidos no business template
    const templates: ProductTemplate[] = [];
    for (const templateId of businessTemplate.defaultProductTemplates) {
      const template = this.productTemplates.get(templateId);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Buscar service templates por business template
   */
  getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId: string): ServiceTemplateCanonical[] {
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) {
      return [];
    }

    // Buscar templates pelos IDs definidos no business template
    const templates: ServiceTemplateCanonical[] = [];
    for (const templateId of businessTemplate.defaultServiceTemplates) {
      const template = this.serviceTemplatesCanonical.get(templateId);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Calcular prioridade de matching baseada em métricas de governança
   * Retorna um fator de prioridade (0.0 a 1.0)
   * 1.0 = máxima prioridade, 0.0 = mínima prioridade
   */
  calculateMatchingPriority(providerActorId: string): number {
    const metrics = this.serviceGovernanceMetrics.get(providerActorId);
    if (!metrics) {
      return 1.0; // Sem histórico, máxima prioridade
    }

    let priority = 1.0;

    // Penalidade por warning: -10%
    if (metrics.status === 'warning') {
      priority -= 0.1;
    }

    // Penalidade por SLA violation: -30%
    if (metrics.status === 'sla_violation') {
      priority -= 0.3;
    }

    // Penalidade por trust downgrade: -50%
    if (metrics.trustDowngradesCount > 0) {
      priority -= 0.5;
    }

    // Penalidade progressiva por taxa baixa de conversão
    if (metrics.taxaQuoteToExecution < 20) {
      priority -= 0.2;
    } else if (metrics.taxaQuoteToExecution < 50) {
      priority -= 0.1;
    }

    // Garantir que prioridade não fique negativa
    return Math.max(0.0, priority);
  }

  // ============================================================
  // ESCALA DE SERVIÇOS & CAPACIDADE PRODUTIVA (MULTI-AGENDA)
  // ============================================================

  /**
   * Service Resources (in-memory)
   * Recursos de serviço: prestadores, profissionais, equipamentos, instalações
   */
  private serviceResources: Map<string, ServiceResource> = new Map(); // resource_id -> resource

  /**
   * Resource Dependencies (in-memory)
   * Dependências entre recursos (quais recursos são necessários para cada serviço)
   */
  private resourceDependencies: Map<string, ServiceResourceDependency> = new Map(); // dependency_id -> dependency

  /**
   * Resource Capacity Metrics (in-memory)
   * Métricas de capacidade por recurso (calculadas dinamicamente)
   */
  private resourceCapacityMetrics: Map<string, ResourceCapacityMetrics> = new Map(); // resource_id -> metrics

  /**
   * Company Capacity Metrics (in-memory)
   * Métricas de capacidade agregadas por empresa
   */
  private companyCapacityMetrics: Map<string, CompanyCapacityMetrics> = new Map(); // store_id -> metrics

  /**
   * Capacity Events (in-memory)
   * Eventos de capacidade para auditoria e feed econômico
   */
  private capacityEvents: Map<string, CapacityEvent> = new Map(); // eventId -> event

  /**
   * Capacity Snapshots (in-memory)
   * Snapshots históricos de capacidade por período
   */
  private capacitySnapshots: Map<string, CapacitySnapshot> = new Map(); // snapshot_id -> snapshot

  /**
   * Criar ou atualizar um ServiceResource
   */
  createOrUpdateServiceResource(
    storeId: string,
    type: ServiceResourceType,
    name: string,
    options: {
      description?: string;
      actorId?: string;
      physical_id?: string;
      has_own_agenda?: boolean;
      required_for_services?: string[];
      compensation_config?: {
        model: CompensationModel;
        percent_value?: number;
        fixed_amount?: number;
        monthly_salary?: number;
        base_salary?: number;
        variable_percent?: number;
        min_compensation?: number;
        max_compensation?: number;
        isActive: boolean;
        effective_from: string;
        effective_until?: string;
      };
    }
  ): ServiceResource {
    // Gerar resource_id único
    const resourceId = options.actorId
      ? `resource-${type}-${options.actorId}`
      : options.physical_id
      ? `resource-${type}-${options.physical_id}`
      : `resource-${type}-${Date.now()}`;

    const existing = this.serviceResources.get(resourceId);
    const now = new Date().toISOString();

    const resource: ServiceResource = {
      resourceId: resourceId,
      storeId: storeId,
      type,
      name,
      description: options.description,
      actorId: options.actorId,
      physicalId: options.physical_id,
      hasOwnAgenda: options.has_own_agenda ?? true,
      requiredForServices: options.required_for_services || [],
      status: existing?.status || 'active',
      statusReason: existing?.statusReason,
      statusUpdatedAt: existing?.statusUpdatedAt || now,
      historicalMetrics: existing?.historicalMetrics || {
        averageExecutionTimeMinutes: 0,
        sla_response_rate: 1.0,
        slaExecutionRate: 1.0,
        cancellationRate: 0,
        overrunRate: 0,
        totalServicesCompleted: 0,
        last30DaysServices: 0,
      },
      currentCapacity: existing?.currentCapacity || {
        totalSlotsAvailable: 0,
        slotsReserved: 0,
        slotsConfirmed: 0,
        slotsInProgress: 0,
        slotsAvailable: 0,
        riskLevel: 'low',
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    // Se compensation_config foi fornecido, configurar
    if (options.compensation_config) {
      this.setResourceCompensationConfig(resourceId, {
        compensationModel: options.compensation_config.model,
        percentValueBps: options.compensation_config.percent_value,
        fixedAmountCents: options.compensation_config.fixed_amount,
        currency: options.compensation_config.fixed_amount ? 'BRL' : undefined,
        monthlySalaryCents: options.compensation_config.monthly_salary,
        baseSalaryCents: options.compensation_config.base_salary,
        variablePercentBps: options.compensation_config.variable_percent,
        minCompensationCents: options.compensation_config.min_compensation,
        maxCompensationCents: options.compensation_config.max_compensation,
        isActive: options.compensation_config.isActive,
        effectiveFrom: options.compensation_config.effective_from,
        effectiveUntil: options.compensation_config.effective_until,
      });
    }

    this.serviceResources.set(resourceId, resource);

    // Recalcular capacidade do recurso
    this.recalculateResourceCapacity(resourceId);

    marketplaceLogger.init('ServiceResource criado/atualizado', {
      resourceId: resourceId,
      storeId: storeId,
      type,
    });

    return resource;
  }

  /**
   * Buscar ServiceResource por ID
   */
  getServiceResource(resourceId: string): ServiceResource | null {
    return this.serviceResources.get(resourceId) || null;
  }

  /**
   * Listar ServiceResources de uma loja
   */
  getServiceResourcesByStore(storeId: string): ServiceResource[] {
    return Array.from(this.serviceResources.values())
      .filter(r => r.storeId === storeId);
  }

  /**
   * Atualizar status de um ServiceResource
   */
  updateServiceResourceStatus(
    resourceId: string,
    status: ServiceResourceStatus,
    reason?: string
  ): ServiceResource | null {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) {
      return null;
    }

    resource.status = status;
    resource.statusReason = reason;
    resource.statusUpdatedAt = new Date().toISOString();
    resource.updatedAt = new Date().toISOString();

    this.serviceResources.set(resourceId, resource);

    // Recalcular capacidade
    this.recalculateResourceCapacity(resourceId);

    // Se ficou sobrecarregado, registrar evento
    if (status === 'overloaded') {
      this.recordCapacityEvent({
        resourceId: resourceId,
        storeId: resource.storeId,
        companyId: resource.storeId, // Simplificação: storeId = companyId
        eventType: 'resource_overloaded',
        details: {
          capacityAvailable: resource.currentCapacity.slotsAvailable,
          capacityUtilized: resource.currentCapacity.slotsReserved + resource.currentCapacity.slotsConfirmed + resource.currentCapacity.slotsInProgress,
          saturationRate: resource.currentCapacity.slotsAvailable === 0 ? 1.0 : (resource.currentCapacity.slotsReserved + resource.currentCapacity.slotsConfirmed + resource.currentCapacity.slotsInProgress) / resource.currentCapacity.totalSlotsAvailable,
          reason: reason || 'Capacidade máxima atingida',
        },
      });
    }

    marketplaceLogger.init('Status de ServiceResource atualizado', {
      resourceId: resourceId,
      status,
      reason,
    });

    return resource;
  }

  /**
   * Criar dependência entre recursos
   */
  createResourceDependency(
    serviceTemplateId: string,
    requiredResourceIds: string[],
    allRequired: boolean = true
  ): ServiceResourceDependency {
    const dependencyId = `dependency-${serviceTemplateId}-${Date.now()}`;

    const dependency: ServiceResourceDependency = {
      dependencyId: dependencyId,
      serviceTemplateId: serviceTemplateId,
      requiredResources: requiredResourceIds,
      allRequired: allRequired,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.resourceDependencies.set(dependencyId, dependency);

    marketplaceLogger.init('Dependência de recursos criada', {
      dependencyId: dependencyId,
      serviceTemplateId: serviceTemplateId,
      requiredResources: requiredResourceIds,
    });

    return dependency;
  }

  /**
   * Buscar dependências de um serviço
   */
  getResourceDependenciesByService(serviceTemplateId: string): ServiceResourceDependency[] {
    return Array.from(this.resourceDependencies.values())
      .filter(d => d.serviceTemplateId === serviceTemplateId);
  }

  /**
   * Recalcular capacidade de um recurso (baseado em fatos reais)
   */
  recalculateResourceCapacity(resourceId: string): void {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) {
      return;
    }

    // Buscar agenda do recurso (se tiver agenda própria)
    // Por enquanto, vamos usar dados simulados baseados em ServiceAvailability
    const serviceOfferings = Array.from(this.serviceOfferings.values())
      .filter(so => so.storeId === resource.storeId);

    // Calcular total de slots disponíveis na agenda
    let totalSlots = 0;
    const now = new Date();
    const currentDay = now.getDay(); // 0 = domingo, 6 = sábado

    for (const offering of serviceOfferings) {
      const availability = this.serviceAvailabilities.get(offering.offering_id) || [];

      for (const avail of availability) {
        // Verificar se o dia atual está na disponibilidade
        const weekdayMap: Record<number, string> = {
          0: 'sunday',
          1: 'monday',
          2: 'tuesday',
          3: 'wednesday',
          4: 'thursday',
          5: 'friday',
          6: 'saturday',
        };
        const currentWeekday = weekdayMap[currentDay];

        if (avail.weekday === currentWeekday) {
          // Calcular slots disponíveis no horário
          const startHour = parseInt(avail.starts_at.split(':')[0]);
          const endHour = parseInt(avail.ends_at.split(':')[0]);
          const durationMinutes = offering.duration_minutes || 60;
          const slotsPerHour = 60 / durationMinutes;
          const hoursAvailable = endHour - startHour;
          totalSlots += Math.floor(hoursAvailable * slotsPerHour * avail.capacity);
        }
      }
    }

    // Buscar pré-reservas ativas
    const preReservations = Array.from(this.servicePreReservations.values())
      .filter(pr => {
        // Verificar se a pré-reserva é para um serviço que exige este recurso
        const dispatch = this.serviceDispatches.get(pr.dispatchId);
        if (!dispatch) return false;

        const request = this.serviceRequests.get(dispatch.requestId);
        if (!request) return false;

        // Verificar se o serviço exige este recurso
        const dependencies = this.getResourceDependenciesByService(request.serviceTemplateId || '');
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(pr => {
        const expiresAt = new Date(pr.expiresAt);
        return expiresAt > now && !pr.confirmedAt;
      });

    // Buscar serviços confirmados
    const confirmedBookings = Array.from(this.serviceBookings.values())
      .filter(booking => {
        const offering = this.serviceOfferings.get(booking.offeringId);
        if (!offering || offering.storeId !== resource.storeId) return false;

        const dependencies = this.getResourceDependenciesByService(offering.templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(booking => {
        const bookingDate = new Date(booking.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() >= today.getTime() && booking.status === 'confirmed';
      });

    // Buscar serviços em execução
    const inProgressBookings = Array.from(this.serviceBookings.values())
      .filter(booking => {
        const offering = this.serviceOfferings.get(booking.offeringId);
        if (!offering || offering.storeId !== resource.storeId) return false;

        const dependencies = this.getResourceDependenciesByService(offering.templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(booking => booking.status === 'in_progress');

    // Atualizar capacidade atual
    resource.currentCapacity = {
      totalSlotsAvailable: totalSlots,
      slotsReserved: preReservations.length,
      slotsConfirmed: confirmedBookings.length,
      slotsInProgress: inProgressBookings.length,
      slotsAvailable: Math.max(0, totalSlots - preReservations.length - confirmedBookings.length - inProgressBookings.length),
      riskLevel: this.calculateRiskLevel(resource, totalSlots, preReservations.length + confirmedBookings.length + inProgressBookings.length),
    };

    // Se capacidade disponível = 0, marcar como sobrecarregado
    if (resource.currentCapacity.slotsAvailable === 0 && resource.status === 'active') {
      this.updateServiceResourceStatus(resourceId, 'overloaded', 'Capacidade disponível zerada');
    } else if (resource.currentCapacity.slotsAvailable > 0 && resource.status === 'overloaded') {
      // Se voltou a ter capacidade, voltar para ativo
      this.updateServiceResourceStatus(resourceId, 'active', 'Capacidade disponível restaurada');
    }

    // Atualizar métricas de capacidade
    this.updateResourceCapacityMetrics(resourceId);

    this.serviceResources.set(resourceId, resource);
  }

  /**
   * Calcular nível de risco de SLA
   */
  private calculateRiskLevel(
    resource: ServiceResource,
    totalSlots: number,
    utilizedSlots: number
  ): 'low' | 'medium' | 'high' {
    if (totalSlots === 0) return 'high';

    const utilizationRate = utilizedSlots / totalSlots;
    const historicalMetrics = resource.historicalMetrics;

    // Risco baseado em utilização
    if (utilizationRate >= 0.9) return 'high';
    if (utilizationRate >= 0.7) return 'medium';

    // Risco baseado em métricas históricas
    if (historicalMetrics.slaExecutionRate < 0.7) return 'high';
    if (historicalMetrics.slaExecutionRate < 0.85) return 'medium';
    if (historicalMetrics.overrunRate > 0.3) return 'high';
    if (historicalMetrics.overrunRate > 0.15) return 'medium';

    return 'low';
  }

  /**
   * Atualizar métricas de capacidade de um recurso
   */
  private updateResourceCapacityMetrics(resourceId: string): void {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) return;

    const capacity = resource.currentCapacity;
    const metrics = resource.historicalMetrics;

    const capacityMetrics: ResourceCapacityMetrics = {
      resourceId: resourceId,
      resourceName: resource.name,
      storeId: resource.storeId,
      capacityTotal: capacity.totalSlotsAvailable,
      capacityReserved: capacity.slotsReserved,
      capacityConfirmed: capacity.slotsConfirmed,
      capacityInProgress: capacity.slotsInProgress,
      capacityUtilized: capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress,
      capacityAvailable: capacity.slotsAvailable,
      riskSla: capacity.riskLevel,
      riskFactors: this.getRiskFactors(resource, capacity),
      historicalAverageUtilization: metrics.totalServicesCompleted > 0
        ? (metrics.last30DaysServices / 30) / capacity.totalSlotsAvailable
        : 0,
      historicalPeakUtilization: Math.min(1.0, metrics.last30DaysServices / capacity.totalSlotsAvailable),
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.resourceCapacityMetrics.set(resourceId, capacityMetrics);
  }

  /**
   * Obter fatores de risco
   */
  private getRiskFactors(resource: ServiceResource, capacity: ServiceResource['currentCapacity']): string[] {
    const factors: string[] = [];

    if (capacity.slotsAvailable === 0) {
      factors.push('Capacidade zerada');
    }

    if (capacity.riskLevel === 'high') {
      factors.push('Alto risco de quebra de SLA');
    }

    const metrics = resource.historicalMetrics;
    if (metrics.overrunRate > 0.2) {
      factors.push('Alta taxa de atrasos históricos');
    }

    if (metrics.slaExecutionRate < 0.8) {
      factors.push('Taxa de execução dentro do SLA abaixo do esperado');
    }

    if (metrics.cancellationRate > 0.15) {
      factors.push('Alta taxa de cancelamento');
    }

    return factors;
  }

  /**
   * Recalcular capacidade agregada de uma empresa
   */
  recalculateCompanyCapacity(storeId: string): void {
    const resources = this.getServiceResourcesByStore(storeId)
      .filter(r => r.status === 'active' || r.status === 'overloaded');

    if (resources.length === 0) {
      return;
    }

    // Recalcular capacidade de cada recurso
    for (const resource of resources) {
      this.recalculateResourceCapacity(resource.resourceId);
    }

    // Agregar métricas
    let totalCapacity = 0;
    let utilizedCapacity = 0;
    let availableCapacity = 0;
    const bottleneckResources: Array<{
      resourceId: string;
      resourceName: string;
      utilization_rate: number;
      riskLevel: 'low' | 'medium' | 'high';
    }> = [];

    for (const resource of resources) {
      const capacity = resource.currentCapacity;
      totalCapacity += capacity.totalSlotsAvailable;
      utilizedCapacity += capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress;
      availableCapacity += capacity.slotsAvailable;

      // Identificar gargalos (utilização > 80%)
      const utilizationRate = capacity.totalSlotsAvailable > 0
        ? (capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress) / capacity.totalSlotsAvailable
        : 0;

      if (utilizationRate > 0.8) {
        bottleneckResources.push({
          resourceId: resource.resourceId,
          resourceName: resource.name,
          utilization_rate: utilizationRate,
          riskLevel: capacity.riskLevel,
        });
      }
    }

    const saturationRate = totalCapacity > 0 ? utilizedCapacity / totalCapacity : 0;

    // Buscar contagem de serviços rejeitados (simulado por enquanto)
    const rejectedCount = 0; // TODO: Implementar rastreamento de rejeições

    const companyMetrics: CompanyCapacityMetrics = {
      companyId: storeId, // Simplificação: storeId = companyId
      storeId: storeId,
      period: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      },
      totalCapacity: totalCapacity,
      utilizedCapacity: utilizedCapacity,
      availableCapacity: availableCapacity,
      bottleneckResources: bottleneckResources,
      saturation_rate: saturationRate,
      rejected_services_count: rejectedCount,
      rejected_services_last_30_days: rejectedCount,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.companyCapacityMetrics.set(storeId, companyMetrics);
  }

  /**
   * Buscar métricas de capacidade de uma empresa
   */
  getCompanyCapacityMetrics(storeId: string): CompanyCapacityMetrics | null {
    // Recalcular antes de retornar
    this.recalculateCompanyCapacity(storeId);
    return this.companyCapacityMetrics.get(storeId) || null;
  }

  /**
   * Buscar métricas de capacidade de um recurso
   */
  getResourceCapacityMetrics(resourceId: string): ResourceCapacityMetrics | null {
    // Recalcular antes de retornar
    this.recalculateResourceCapacity(resourceId);
    return this.resourceCapacityMetrics.get(resourceId) || null;
  }

  /**
   * Verificar se recursos estão disponíveis para um serviço
   */
  checkResourceAvailability(
    serviceTemplateId: string,
    storeId: string,
    date: string,
    time: string
  ): {
    available: boolean;
    missing_resources: string[];
    available_resources: string[];
  } {
    const dependencies = this.getResourceDependenciesByService(serviceTemplateId);

    if (dependencies.length === 0) {
      // Serviço não exige recursos específicos
      return {
        available: true,
        missing_resources: [],
        available_resources: [],
      };
    }

    const requiredResources: string[] = [];
    for (const dep of dependencies) {
      if (dep.allRequired) {
        requiredResources.push(...dep.requiredResources);
      } else {
        // Pelo menos um dos recursos deve estar disponível
        requiredResources.push(...dep.requiredResources);
      }
    }

    const availableResources: string[] = [];
    const missingResources: string[] = [];

    for (const resourceId of requiredResources) {
      const resource = this.serviceResources.get(resourceId);
      if (!resource) {
        missingResources.push(resourceId);
        continue;
      }

      if (resource.storeId !== storeId) {
        missingResources.push(resourceId);
        continue;
      }

      if (resource.status === 'overloaded' || resource.status === 'unavailable') {
        missingResources.push(resourceId);
        continue;
      }

      // Verificar se há capacidade disponível
      if (resource.currentCapacity.slotsAvailable <= 0) {
        missingResources.push(resourceId);
        continue;
      }

      availableResources.push(resourceId);
    }

    // Se todas as dependências exigem todos os recursos, todos devem estar disponíveis
    const allRequired = dependencies.every(d => d.allRequired);
    const available = allRequired
      ? missingResources.length === 0
      : availableResources.length > 0;

    return {
      available,
      missing_resources: missingResources,
      available_resources: availableResources,
    };
  }

  /**
   * Registrar evento de capacidade
   */
  private recordCapacityEvent(event: Omit<CapacityEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    const eventId = `capacity-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const capacityEvent: CapacityEvent = {
      eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.capacityEvents.set(eventId, capacityEvent);

    // Gerar evento econômico se relevante
    if (event.eventType === 'service_rejected_capacity') {
      this.generateEconomicEvent({
        type: 'service_rejected_capacity',
        region: 'local', // TODO: Obter região real
        actorId: event.storeId,
        reference_id: event.details.serviceRequestId,
        amountCents: undefined,
        currency: null,
        visibility: 'restricted',
      });
    }
  }

  /**
   * Listar recursos elegíveis para matching (não sobrecarregados)
   */
  getEligibleResourcesForMatching(storeId: string, serviceTemplateId: string): ServiceResource[] {
    const resources = this.getServiceResourcesByStore(storeId)
      .filter(r => {
        // Apenas recursos ativos
        if (r.status !== 'active') return false;

        // Verificar se o recurso é necessário para este serviço
        const dependencies = this.getResourceDependenciesByService(serviceTemplateId);
        if (dependencies.length === 0) return true; // Serviço não exige recursos específicos

        return dependencies.some(d => d.requiredResources.includes(r.resourceId));
      })
      .filter(r => {
        // Proteção anti-overload: apenas recursos com capacidade disponível
        return r.currentCapacity.slotsAvailable > 0;
      });

    return resources;
  }

  // ============================================================
  // GESTÃO DE COMISSÃO & REPASSE INTERNO POR RECURSO (PROMPT 24)
  // ============================================================

  /**
   * Resource Compensations (in-memory)
   * Repasses internos registrados após conclusão de serviços
   */
  private resourceCompensations: Map<string, ResourceCompensation> = new Map(); // compensationId -> compensation

  /**
   * Resource Compensation Configs (in-memory)
   * Configurações de compensação por recurso
   */
  private resourceCompensationConfigs: Map<string, ResourceCompensationConfig> = new Map(); // resourceId -> config

  /**
   * Configurar modelo de compensação para um recurso
   */
  setResourceCompensationConfig(
    resourceId: string,
    config: Omit<ResourceCompensationConfig, 'resourceId' | 'createdAt' | 'updatedAt' | 'immutable'>
  ): ResourceCompensationConfig {
    const now = new Date().toISOString();
    const existing = this.resourceCompensationConfigs.get(resourceId);

    const compensationConfig: ResourceCompensationConfig = {
      resourceId: resourceId,
      ...config,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    this.resourceCompensationConfigs.set(resourceId, compensationConfig);

    // Atualizar ServiceResource com a configuração
    const resource = this.serviceResources.get(resourceId);
    if (resource) {
      resource.compensationConfig = {
        model: config.compensationModel,
        percentValue: config.percentValueBps,
        fixedAmount: config.fixedAmountCents,
        monthlySalary: config.monthlySalaryCents,
        baseSalary: config.baseSalaryCents,
        variablePercent: config.variablePercentBps,
        minCompensation: config.minCompensationCents,
        maxCompensation: config.maxCompensationCents,
        isActive: config.isActive,
        effectiveFrom: config.effectiveFrom,
        effectiveUntil: config.effectiveUntil,
      };
      resource.updatedAt = now;
      this.serviceResources.set(resourceId, resource);
    }

    marketplaceLogger.init('Configuração de compensação atualizada', {
      resourceId: resourceId,
      model: config.compensationModel,
    });

    return compensationConfig;
  }

  /**
   * Buscar configuração de compensação de um recurso
   */
  getResourceCompensationConfig(resourceId: string): ResourceCompensationConfig | null {
    return this.resourceCompensationConfigs.get(resourceId) || null;
  }

  /**
   * Calcular compensação para um recurso após conclusão de serviço
   */
  calculateResourceCompensation(
    resourceId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    serviceValue: { amountCents: number; currency: string }
  ): ResourceCompensation {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) {
      throw new Error('Recurso não encontrado');
    }

    const config = this.resourceCompensationConfigs.get(resourceId);
    if (!config || !config.isActive) {
      // Sem configuração ou inativa = modelo 'none' (100% fica na empresa)
      return this.createCompensationRecord(
        resourceId,
        serviceOrderId,
        serviceBookingId,
        resource.storeId,
        serviceValue,
        'none',
        { amountCents: 0, currency: serviceValue.currency },
        {}
      );
    }

    // Verificar se está dentro do período de vigência
    const now = new Date();
    const effectiveFrom = new Date(config.effectiveFrom);
    if (now < effectiveFrom) {
      throw new Error('Configuração de compensação ainda não está em vigência');
    }

    if (config.effectiveUntil) {
      const effectiveUntil = new Date(config.effectiveUntil);
      if (now > effectiveUntil) {
        throw new Error('Configuração de compensação expirou');
      }
    }

    let compensationAmountCents = 0;
    const calculationDetails: ResourceCompensation['calculationDetails'] = {
      adjustments: [],
    };

    // Calcular compensação baseado no modelo
    switch (config.compensationModel) {
      case 'none':
        compensationAmountCents = 0;
        break;

      case 'fixed_percent':
        if (config.percentValueBps === undefined || config.percentValueBps === null) {
          throw new Error('Percentual não configurado para modelo fixed_percent');
        }
        compensationAmountCents = Math.round((serviceValue.amountCents * config.percentValueBps) / 100);
        calculationDetails.baseValue = serviceValue.amountCents;
        calculationDetails.percentApplied = config.percentValueBps;
        break;

      case 'fixed_value':
        if (config.fixedAmountCents === undefined || config.fixedAmountCents === null) {
          throw new Error('Valor fixo não configurado para modelo fixed_value');
        }
        compensationAmountCents = config.fixedAmountCents;
        calculationDetails.fixedValueApplied = config.fixedAmountCents;
        break;

      case 'salary':
        // Funcionário assalariado não gera repasse por serviço
        compensationAmountCents = 0;
        break;

      case 'mixed':
        if (config.baseSalaryCents === undefined || config.baseSalaryCents === null || config.variablePercentBps === undefined || config.variablePercentBps === null) {
          throw new Error('Salário base ou percentual variável não configurado para modelo mixed');
        }
        // Variável: percentual sobre o valor do serviço
        const variableAmount = Math.round((serviceValue.amountCents * config.variablePercentBps) / 100);
        compensationAmountCents = variableAmount;
        calculationDetails.baseValue = serviceValue.amountCents;
        calculationDetails.percentApplied = config.variablePercentBps;
        break;
    }

    // Aplicar limites mínimo e máximo
    if (config.minCompensationCents !== undefined && config.minCompensationCents !== null && compensationAmountCents < config.minCompensationCents) {
      const adjustment = config.minCompensationCents - compensationAmountCents;
      compensationAmountCents = config.minCompensationCents;
      calculationDetails.adjustments = calculationDetails.adjustments || [];
      calculationDetails.adjustments.push({
        type: 'min_limit',
        amountCents: adjustment,
        reason: `Aplicado limite mínimo de ${config.minCompensationCents / 100} ${serviceValue.currency}`,
      });
    }

    if (config.maxCompensationCents !== undefined && config.maxCompensationCents !== null && compensationAmountCents > config.maxCompensationCents) {
      const adjustment = compensationAmountCents - config.maxCompensationCents;
      compensationAmountCents = config.maxCompensationCents;
      calculationDetails.adjustments = calculationDetails.adjustments || [];
      calculationDetails.adjustments.push({
        type: 'max_limit',
        amountCents: -adjustment,
        reason: `Aplicado limite máximo de ${config.maxCompensationCents / 100} ${serviceValue.currency}`,
      });
    }

    return this.createCompensationRecord(
      resourceId,
      serviceOrderId,
      serviceBookingId,
      resource.storeId,
      serviceValue,
      config.compensationModel,
      { amountCents: compensationAmountCents, currency: serviceValue.currency },
      calculationDetails
    );
  }

  /**
   * Criar registro de compensação
   */
  private createCompensationRecord(
    resourceId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    storeId: string,
    serviceValue: { amountCents: number; currency: string },
    model: CompensationModel,
    compensationAmount: { amountCents: number; currency: string },
    calculationDetails: ResourceCompensation['calculationDetails']
  ): ResourceCompensation {
    const compensationId = `compensation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const compensation: ResourceCompensation = {
      compensationId: compensationId,
      resourceId: resourceId,
      serviceOrderId: serviceOrderId,
      serviceBookingId: serviceBookingId,
      storeId: storeId,
      serviceValue: serviceValue,
      compensationAmount: compensationAmount,
      compensationModel: model,
      calculationDetails: calculationDetails,
      status: 'calculated',
      createdAt: now,
      updatedAt: now,
      immutable: true,
    };

    this.resourceCompensations.set(compensationId, compensation);

    marketplaceLogger.init('Compensação calculada', {
      compensationId: compensationId,
      resourceId: resourceId,
      serviceOrderId: serviceOrderId,
      amountCents: compensationAmount.amountCents,
      model,
    });

    return compensation;
  }

  /**
   * Processar repasse interno após conclusão de serviço
   * Integra com PaymentPlan e Ledger
   */
  async processResourceCompensation(
    serviceOrderId: string,
    serviceBookingId: string,
    completedResources: string[] // IDs dos recursos que executaram o serviço
  ): Promise<ResourceCompensation[]> {
    // Buscar ServiceOrder
    const serviceOrder = Array.from(this.serviceOrders.values())
      .find(so => so.orderId === serviceOrderId);
    if (!serviceOrder) {
      throw new Error('ServiceOrder não encontrado');
    }

    // Buscar Order associado
    const order = this.orders.get(serviceOrder.orderId);
    if (!order) {
      throw new Error('Order não encontrado');
    }

    // Buscar PaymentPlan
    const checkout = Array.from(this.checkouts.values())
      .find(c => this.checkoutOrderIds.get(c.checkoutId) === order.orderId);
    if (!checkout) {
      throw new Error('CheckoutIntent não encontrado');
    }

    const paymentPlan = Array.from(this.paymentPlans.values())
      .find(pp => pp.checkoutId === checkout.checkoutId);
    if (!paymentPlan || paymentPlan.status !== 'executed') {
      throw new Error('PaymentPlan não encontrado ou não executado');
    }

    // Valor do serviço (do ServiceOrder)
    const serviceValue = {
      amountCents: serviceOrder.price.amountCents,
      currency: serviceOrder.price.currency,
    };

    // Calcular compensação para cada recurso
    const compensations: ResourceCompensation[] = [];

    for (const resourceId of completedResources) {
      const compensation = this.calculateResourceCompensation(
        resourceId,
        serviceOrderId,
        serviceBookingId,
        serviceValue
      );

      // Se compensação > 0, registrar no ledger
      if (compensation.compensationAmount.amountCents > 0) {
        try {
          // Registrar repasse interno no ledger
          const ledgerEntryId = await this.recordResourceCompensationLedger(
            compensation,
            order.storeId,
            resourceId
          );

          compensation.ledgerEntryId = ledgerEntryId;
          compensation.status = 'pending'; // Aguardando confirmação de pagamento
          compensation.updatedAt = new Date().toISOString();
          this.resourceCompensations.set(compensation.compensationId, compensation);
        } catch (error: any) {
          marketplaceLogger.error('Erro ao registrar compensação no ledger', error);
          // Continuar mesmo se falhar (compensação fica como calculated)
        }
      }

      compensations.push(compensation);
    }

    return compensations;
  }

  /**
   * Registrar repasse interno no ledger (tipo: resource_compensation)
   */
  private async recordResourceCompensationLedger(
    compensation: ResourceCompensation,
    companyStoreId: string,
    resourceId: string
  ): Promise<string> {
    // Integração com UnifyBank (usar bankPortsRegistry)
    // Por enquanto, retornar ID simulado
    // TODO: Implementar integração real com ledger quando disponível
    const ledgerEntryId = `ledger-resource-compensation-${compensation.compensationId}`;

    marketplaceLogger.init('Repasse interno registrado no ledger', {
      compensationId: compensation.compensationId,
      resourceId: resourceId,
      amountCents: compensation.compensationAmount.amountCents,
      ledgerEntryId: ledgerEntryId,
    });

    return ledgerEntryId;
  }

  /**
   * Marcar compensação como paga
   */
  markCompensationAsPaid(compensationId: string): ResourceCompensation | null {
    const compensation = this.resourceCompensations.get(compensationId);
    if (!compensation) {
      return null;
    }

    compensation.status = 'paid';
    compensation.paidAt = new Date().toISOString();
    compensation.updatedAt = new Date().toISOString();

    this.resourceCompensations.set(compensationId, compensation);

    marketplaceLogger.init('Compensação marcada como paga', {
      compensationId: compensationId,
      resourceId: compensation.resourceId,
    });

    return compensation;
  }

  /**
   * Buscar compensações de um recurso
   */
  getResourceCompensations(
    resourceId: string,
    options?: {
      starts_at?: string;
      ends_at?: string;
      status?: ResourceCompensation['status'];
    }
  ): ResourceCompensation[] {
    let compensations = Array.from(this.resourceCompensations.values())
      .filter(c => c.resourceId === resourceId);

    const startsAt = options?.starts_at;
    if (startsAt !== undefined && startsAt !== null) {
      compensations = compensations.filter(c => c.createdAt >= startsAt);
    }

    const endsAt = options?.ends_at;
    if (endsAt !== undefined && endsAt !== null) {
      compensations = compensations.filter(c => c.createdAt <= endsAt);
    }

    if (options?.status) {
      compensations = compensations.filter(c => c.status === options.status);
    }

    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar compensações de uma empresa (todos os recursos)
   */
  getCompanyCompensations(
    storeId: string,
    options?: {
      starts_at?: string;
      ends_at?: string;
      status?: ResourceCompensation['status'];
    }
  ): ResourceCompensation[] {
    const resources = this.getServiceResourcesByStore(storeId);
    const resourceIds = resources.map(r => r.resourceId);

    let compensations = Array.from(this.resourceCompensations.values())
      .filter(c => resourceIds.includes(c.resourceId));

    const startsAt = options?.starts_at;
    if (startsAt !== undefined && startsAt !== null) {
      compensations = compensations.filter(c => c.createdAt >= startsAt);
    }

    const endsAt = options?.ends_at;
    if (endsAt !== undefined && endsAt !== null) {
      compensations = compensations.filter(c => c.createdAt <= endsAt);
    }

    if (options?.status) {
      compensations = compensations.filter(c => c.status === options.status);
    }

    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Gerar histórico de compensações por recurso
   */
  generateResourceCompensationHistory(
    resourceId: string,
    startDate: string,
    endDate: string
  ): ResourceCompensationHistory {
    const compensations = this.getResourceCompensations(resourceId, {
      starts_at: startDate,
      ends_at: endDate,
    });

    const totalCompensation = compensations.reduce(
      (sum, c) => sum + c.compensationAmount.amountCents,
      0
    );

    const byModel: Record<CompensationModel, { count: number; totalCents: number }> = {
      none: { count: 0, totalCents: 0 },
      fixed_percent: { count: 0, totalCents: 0 },
      fixed_value: { count: 0, totalCents: 0 },
      salary: { count: 0, totalCents: 0 },
      mixed: { count: 0, totalCents: 0 },
    };

    for (const comp of compensations) {
      const model = comp.compensationModel;
      byModel[model].count += 1;
      byModel[model].totalCents += comp.compensationAmount.amountCents;
    }

    const history: ResourceCompensationHistory = {
      resourceId: resourceId,
      period: { start: startDate, end: endDate },
      compensations,
      totalServices: compensations.length,
      totalCompensation: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      averagePerService: {
        amountCents: compensations.length > 0 ? Math.round(totalCompensation / compensations.length) : 0,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      byModel: byModel,
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    return history;
  }

  /**
   * Gerar relatório contábil de compensações por empresa
   */
  generateCompanyCompensationReport(
    storeId: string,
    startDate: string,
    endDate: string
  ): CompanyCompensationReport {
    const compensations = this.getCompanyCompensations(storeId, {
      starts_at: startDate,
      ends_at: endDate,
    });

    const resources = this.getServiceResourcesByStore(storeId);
    const totalCompensation = compensations.reduce(
      (sum, c) => sum + c.compensationAmount.amountCents,
      0
    );

    // Por recurso
    const byResourceMap = new Map<string, {
      resourceId: string;
      resourceName: string;
      compensationModel: CompensationModel;
      servicesCount: number;
      totalCompensation: { amountCents: number; currency: string };
    }>();

    for (const comp of compensations) {
      const resource = resources.find(r => r.resourceId === comp.resourceId);
      if (!resource) continue;

      const existing = byResourceMap.get(comp.resourceId);
      if (existing) {
        existing.servicesCount += 1;
        existing.totalCompensation.amountCents += comp.compensationAmount.amountCents;
      } else {
        byResourceMap.set(comp.resourceId, {
          resourceId: comp.resourceId,
          resourceName: resource.name,
          compensationModel: comp.compensationModel,
          servicesCount: 1,
          totalCompensation: {
            amountCents: comp.compensationAmount.amountCents,
            currency: comp.compensationAmount.currency,
          },
        });
      }
    }

    // Por modelo
    const byModel: Record<CompensationModel, {
      resourcesCount: number;
      servicesCount: number;
      totalCompensation: { amountCents: number; currency: string };
    }> = {
      none: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      fixed_percent: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      fixed_value: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      salary: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      mixed: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
    };

    const modelResources = new Set<string>();
    for (const comp of compensations) {
      const model = comp.compensationModel;
      byModel[model].servicesCount += 1;
      byModel[model].totalCompensation.amountCents += comp.compensationAmount.amountCents;
      modelResources.add(`${model}-${comp.resourceId}`);
    }

    for (const key of modelResources) {
      const [model] = key.split('-');
      byModel[model as CompensationModel].resourcesCount += 1;
    }

    const report: CompanyCompensationReport = {
      companyId: storeId, // Simplificação: storeId = companyId
      storeId: storeId,
      period: { start: startDate, end: endDate },
      totalCompensationsPaid: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      totalResources: resources.length,
      totalServices: compensations.length,
      byResource: Array.from(byResourceMap.values()),
      byModel: byModel,
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    return report;
  }

  // ============================================================
  // VOUCHERS LOCAIS & OFERTAS RELÂMPAGO (PROMPT 25)
  // ============================================================

  /**
   * Voucher Offers (in-memory)
   * Ofertas de voucher (ofertas relâmpago)
   */
  private voucherOffers: Map<string, VoucherOffer> = new Map(); // offerId -> offer

  /**
   * Voucher Claims (in-memory)
   * Resgates de vouchers
   */
  private voucherClaims: Map<string, VoucherClaim> = new Map(); // claim_id -> claim

  /**
   * Voucher Redemption Events (in-memory)
   * Eventos de voucher (append-only)
   */
  private voucherRedemptionEvents: Map<string, VoucherRedemptionEvent> = new Map(); // eventId -> event

  /**
   * Voucher Participation Score (in-memory)
   * Score interno de participação em vouchers (para boost local)
   */
  private voucherParticipationScores: Map<string, {
    storeId: string;
    participation_count: number; // Número de ofertas criadas
    cancellationRate: number; // Taxa de cancelamento/pausa
    no_show_rate: number; // Taxa de no-show
    last_boost_reset: string; // Última vez que o boost foi resetado
  }> = new Map(); // store_id -> score

  /**
   * User Voucher Abuse Metrics (in-memory)
   * Métricas de abuso de vouchers por usuário
   */
  private userVoucherAbuseMetrics: Map<string, {
    user_id: string;
    expired_claims_count: number;
    no_show_count: number;
    last_penalty_reset: string;
    claim_blocked_until?: string; // Data até quando o usuário está bloqueado
  }> = new Map(); // user_id -> metrics

  /**
   * Criar oferta de voucher
   */
  createVoucherOffer(
    issuerActorId: string,
    storeId: string,
    offer: Omit<VoucherOffer, 'offerId' | 'issuerActorId' | 'storeId' | 'quantityClaimed' | 'status' | 'createdAt' | 'updatedAt'>
  ): VoucherOffer {
    // Validações obrigatórias
    if (!offer.startAt || !offer.endAt) {
      throw new Error('Janela startAt e endAt são obrigatórias');
    }

    if (offer.quantityTotal <= 0) {
      throw new Error('quantityTotal deve ser maior que 0');
    }

    if (offer.type === 'service' && !offer.linkedServiceTemplateId && !offer.linkedServiceOfferingId) {
      throw new Error('Oferta de serviço deve vincular a um ServiceTemplateCanonical ou ServiceOffering');
    }

    if (offer.type === 'product' && !offer.linkedProductId) {
      throw new Error('Oferta de produto deve vincular a um StoreProduct');
    }

    if (offer.visibilityScope === 'local_neighborhood' || offer.visibilityScope === 'city') {
      // Verificar se store tem location definida
      const stores = this.getStores();
      const store = stores.stores.find(s => s.storeId === storeId);
      if (!store) {
        throw new Error('Loja não encontrada');
      }
      const hasLocation = store.branches.some(b => b.location?.city);
      if (!hasLocation) {
        throw new Error('Escopo local exige store_id com neighborhood/city definida');
      }
    }

    const offerId = `voucher-offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const voucherOffer: VoucherOffer = {
      offerId: offerId,
      issuerActorId: issuerActorId,
      storeId: storeId,
      ...offer,
      quantityClaimed: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      immutable: false,
    };

    this.voucherOffers.set(offerId, voucherOffer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      actorId: issuerActorId,
      type: 'offer_created',
      metadata: {
        offerTitle: offer.title,
      },
    });

    marketplaceLogger.init('Oferta de voucher criada', {
      offerId: offerId,
      storeId: storeId,
      type: offer.type,
    });

    return voucherOffer;
  }

  /**
   * Ativar oferta de voucher
   */
  activateVoucherOffer(offerId: string): VoucherOffer | null {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      return null;
    }

    if (offer.status !== 'draft' && offer.status !== 'paused') {
      throw new Error('Oferta só pode ser ativada se estiver em draft ou paused');
    }

    // Verificar se ainda está dentro da janela
    const now = new Date();
    const endAt = new Date(offer.endAt);
    if (now > endAt) {
      offer.status = 'expired';
      offer.updatedAt = new Date().toISOString();
      this.voucherOffers.set(offerId, offer);
      return offer;
    }

    offer.status = 'active';
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      actorId: offer.issuerActorId,
      type: 'offer_activated',
      metadata: {
        offerTitle: offer.title,
        quantityRemaining: offer.quantityTotal - offer.quantityClaimed,
      },
    });

    marketplaceLogger.init('Oferta de voucher ativada', {
      offerId: offerId,
      storeId: offer.storeId,
    });

    return offer;
  }

  /**
   * Pausar oferta de voucher
   */
  pauseVoucherOffer(offerId: string): VoucherOffer | null {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      return null;
    }

    if (offer.status !== 'active') {
      throw new Error('Oferta só pode ser pausada se estiver ativa');
    }

    offer.status = 'paused';
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      actorId: offer.issuerActorId,
      type: 'offer_paused',
      metadata: {
        offerTitle: offer.title,
        reason: 'Pausada pela empresa',
      },
    });

    // Atualizar métricas de participação (cancelamento alto reduz boost)
    this.updateVoucherParticipationScore(offer.storeId, 'pause');

    marketplaceLogger.init('Oferta de voucher pausada', {
      offerId: offerId,
      storeId: offer.storeId,
    });

    return offer;
  }

  /**
   * Buscar oferta de voucher
   */
  getVoucherOffer(offerId: string): VoucherOffer | null {
    return this.voucherOffers.get(offerId) || null;
  }

  /**
   * Listar ofertas de voucher (com filtros)
   */
  listVoucherOffers(filters: {
    city?: string;
    neighborhood?: string;
    scope?: VoucherVisibilityScope;
    type?: VoucherType;
    active_only?: boolean;
    storeId?: string;
  }): VoucherOffer[] {
    let offers = Array.from(this.voucherOffers.values());

    // Filtrar por status
    if (filters.active_only) {
      offers = offers.filter(o => o.status === 'active');
    }

    // Filtrar por tipo
    if (filters.type) {
      offers = offers.filter(o => o.type === filters.type);
    }

    // Filtrar por loja
    if (filters.storeId) {
      offers = offers.filter(o => o.storeId === filters.storeId);
    }

    // Filtrar por escopo e localização
    if (filters.city || filters.neighborhood) {
      const stores = this.getStores();
      offers = offers.filter(offer => {
        const store = stores.stores.find(s => s.storeId === offer.storeId);
        if (!store) return false;

        // Verificar escopo
        if (offer.visibilityScope === 'local_neighborhood') {
          if (filters.neighborhood) {
            return store.branches.some(b => b.location?.neighborhood === filters.neighborhood);
          }
          return false; // Escopo neighborhood requer neighborhood no filtro
        }

        if (offer.visibilityScope === 'city') {
          if (filters.city) {
            return store.branches.some(b => b.location?.city === filters.city);
          }
          return false; // Escopo city requer city no filtro
        }

        return true; // restricted_group não filtra por localização
      });
    }

    // Filtrar por escopo
    if (filters.scope) {
      offers = offers.filter(o => o.visibilityScope === filters.scope);
    }

    // Verificar se ainda está dentro da janela
    const now = new Date();
    offers = offers.filter(offer => {
      const startAt = new Date(offer.startAt);
      const endAt = new Date(offer.endAt);
      return now >= startAt && now <= endAt;
    });

    // Verificar se não está esgotada
    offers = offers.filter(offer => {
      return offer.quantityClaimed < offer.quantityTotal;
    });

    return offers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Resgatar voucher (claim)
   */
  async claimVoucherOffer(tenantId: string, offerId: string, userId: string, audit?: {
    ip_hash?: string;
    device_hash?: string;
    neighborhood?: string;
    city?: string;
  }): Promise<VoucherClaim> {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      throw new Error('Oferta não encontrada');
    }

    if (offer.status !== 'active') {
      throw new Error('Oferta não está ativa');
    }

    const now = new Date();
    const startAt = new Date(offer.startAt);
    const endAt = new Date(offer.endAt);
    if (now < startAt || now > endAt) {
      throw new Error('Oferta fora da janela de resgate');
    }

    if (offer.quantityClaimed >= offer.quantityTotal) {
      offer.status = 'depleted';
      offer.updatedAt = new Date().toISOString();
      this.voucherOffers.set(offerId, offer);
      throw new Error('Oferta esgotada');
    }

    const userClaims = Array.from(this.voucherClaims.values())
      .filter(c => c.offerId === offerId && c.claimerUserId === userId && c.status === 'claimed');
    if (userClaims.length >= offer.quantityPerUser) {
      throw new Error(`Limite de ${offer.quantityPerUser} resgate(s) por usuário atingido`);
    }

    const identity = await economicIdentityService.getEconomicIdentity(tenantId, userId);
    if (offer.eligibility.minTrustLevel) {
      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[offer.eligibility.minTrustLevel] || 0;
      const userLevel = identity ? trustLevels[identity.trustLevel] || 0 : 0;
      if (userLevel < requiredLevel) {
        throw new Error(`Trust level mínimo requerido: ${offer.eligibility.minTrustLevel}`);
      }
    }

    // Verificar se usuário está bloqueado
    const abuseMetrics = this.userVoucherAbuseMetrics.get(userId);
    if (abuseMetrics?.claim_blocked_until) {
      const blockedUntil = new Date(abuseMetrics.claim_blocked_until);
      if (now < blockedUntil) {
        throw new Error(`Usuário bloqueado de resgatar vouchers até ${blockedUntil.toISOString()}`);
      }
    }

    // Lock determinístico: verificar se já existe claim ativo para este usuário nesta oferta
    const existingClaim = Array.from(this.voucherClaims.values())
      .find(c => c.offerId === offerId && c.claimerUserId === userId && c.status === 'claimed');
    if (existingClaim) {
      throw new Error('Usuário já possui um resgate ativo para esta oferta');
    }

    // Gerar código de resgate único
    const redemptionCode = this.generateRedemptionCode();

    // Calcular expiresAt
    const redemptionDeadline = offer.redemptionDeadlineAt
      ? new Date(offer.redemptionDeadlineAt)
      : new Date(endAt.getTime() + 7 * 24 * 60 * 60 * 1000); // Padrão: 7 dias após endAt

    const claimId = `voucher-claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const claim: VoucherClaim = {
      claimId: claimId,
      offerId: offerId,
      claimerUserId: userId,
      status: 'claimed',
      claimedAt: now.toISOString(),
      redemptionCode: redemptionCode,
      expiresAt: redemptionDeadline.toISOString(),
      storeCheckinRequired: offer.pickupConstraints?.requiresCheckin || false,
      audit: {
        ipHash: audit?.ip_hash,
        deviceHash: audit?.device_hash,
        claimedFromNeighborhood: audit?.neighborhood,
        claimedFromCity: audit?.city,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      immutable: true,
    };

    this.voucherClaims.set(claimId, claim);

    // Atualizar quantidade resgatada
    offer.quantityClaimed += 1;
    if (offer.quantityClaimed >= offer.quantityTotal) {
      offer.status = 'depleted';
    }
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      claimId: claimId,
      actorId: userId,
      type: 'claim_created',
      metadata: {
        offerTitle: offer.title,
        claimerUserId: userId,
        redemptionCode: redemptionCode,
        quantityRemaining: offer.quantityTotal - offer.quantityClaimed,
      },
    });

    marketplaceLogger.init('Voucher resgatado', {
      claimId: claimId,
      offerId: offerId,
      user_id: userId,
    });

    return claim;
  }

  /**
   * Gerar código de resgate único
   */
  private generateRedemptionCode(): string {
    // Código curto, não adivinhável (ex: "ABC123")
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removido I, O, 0, 1 para evitar confusão
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Buscar claim de voucher
   */
  getVoucherClaim(claimId: string): VoucherClaim | null {
    return this.voucherClaims.get(claimId) || null;
  }

  /**
   * Validar e resgatar voucher (redeem)
   */
  async redeemVoucherClaim(
    claimId: string,
    storeOperatorActorId: string,
    presentedCode: string
  ): Promise<{
    claim: VoucherClaim;
    order_id?: string;
    service_booking_id?: string;
  }> {
    const claim = this.voucherClaims.get(claimId);
    if (!claim) {
      throw new Error('Claim não encontrado');
    }

    if (claim.status !== 'claimed') {
      throw new Error(`Claim não pode ser resgatado (status: ${claim.status})`);
    }

    // Verificar código
    if (claim.redemptionCode !== presentedCode.toUpperCase()) {
      throw new Error('Código de resgate inválido');
    }

    // Verificar se não expirou
    const now = new Date();
    const expiresAt = new Date(claim.expiresAt);
    if (now > expiresAt) {
      claim.status = 'expired';
      claim.updatedAt = now.toISOString();
      this.voucherClaims.set(claimId, claim);
      throw new Error('Claim expirado');
    }

    const offer = this.voucherOffers.get(claim.offerId);
    if (!offer) {
      throw new Error('Oferta não encontrada');
    }

    // Verificar check-in (se exigido)
    if (claim.storeCheckinRequired && !claim.checkedInAt) {
      throw new Error('Check-in obrigatório antes do resgate');
    }

    // Resgatar voucher
    claim.status = 'redeemed';
    claim.redeemedAt = now.toISOString();
    claim.updatedAt = now.toISOString();
    this.voucherClaims.set(claimId, claim);

    let orderId: string | undefined;
    let serviceBookingId: string | undefined;

    // Criar Order ou ServiceBooking baseado no tipo
    if (offer.type === 'product' && offer.linkedProductId) {
      // Criar Order com desconto total ou parcial
      const order = this.createOrder(offer.storeId);
      
      // Adicionar produto ao pedido
      const orderWithItem = await this.addOrderItem(order.orderId, offer.linkedProductId, 1);

      // Aplicar desconto (se houver)
      if (offer.discountValue) {
        // TODO: Aplicar desconto no Order (por enquanto, criar com valor 0)
        // O desconto pode ser aplicado no PaymentPlan posteriormente
      }

      orderId = orderWithItem.orderId;
      claim.linkedOrderId = orderId;
    } else if (offer.type === 'service' && (offer.linkedServiceTemplateId || offer.linkedServiceOfferingId)) {
      // Criar ServiceBooking
      const offeringId = offer.linkedServiceOfferingId || '';
      const offering = this.serviceOfferings.get(offeringId);
      if (!offering) {
        throw new Error('ServiceOffering não encontrado');
      }

      const booking = this.createServiceBooking({
        offeringId: offeringId,
        user_id: claim.claimerUserId,
        date: new Date().toISOString().split('T')[0], // Hoje
        time: new Date().toTimeString().split(' ')[0].substring(0, 5), // Agora
        quantity: 1,
      });

      serviceBookingId = booking.booking_id;
      claim.linkedServiceBookingId = serviceBookingId;
    }

    this.voucherClaims.set(claimId, claim);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: claim.offerId,
      claimId: claimId,
      actorId: storeOperatorActorId,
      type: 'redeemed',
      metadata: {
        offerTitle: offer.title,
        claimerUserId: claim.claimerUserId,
        redemptionCode: claim.redemptionCode,
      },
    });

    marketplaceLogger.init('Voucher resgatado na loja', {
      claimId: claimId,
      offerId: claim.offerId,
      user_id: claim.claimerUserId,
    });

    return {
      claim,
      order_id: orderId,
      service_booking_id: serviceBookingId,
    };
  }

  /**
   * Marcar no-show
   */
  markNoShow(claimId: string): VoucherClaim | null {
    const claim = this.voucherClaims.get(claimId);
    if (!claim) {
      return null;
    }

    if (claim.status !== 'claimed') {
      throw new Error('Apenas claims com status "claimed" podem ser marcados como no-show');
    }

    claim.status = 'no_show';
    claim.updatedAt = new Date().toISOString();
    this.voucherClaims.set(claimId, claim);

    // Atualizar métricas de abuso do usuário
    this.updateUserVoucherAbuseMetrics(claim.claimerUserId, 'no_show');

    // Atualizar métricas de participação da empresa
    const offer = this.voucherOffers.get(claim.offerId);
    if (offer) {
      this.updateVoucherParticipationScore(offer.storeId, 'no_show');
    }

    // Registrar evento
    this.recordVoucherEvent({
      offerId: claim.offerId,
      claimId: claimId,
      actorId: offer?.issuerActorId || '',
      type: 'no_show_marked',
      metadata: {
        offerTitle: offer?.title,
        claimerUserId: claim.claimerUserId,
        reason: 'No-show marcado pela empresa',
      },
    });

    marketplaceLogger.init('No-show marcado', {
      claimId: claimId,
      user_id: claim.claimerUserId,
    });

    return claim;
  }

  /**
   * Expirar claims expirados (job manual)
   */
  expireVoucherClaims(): {
    expired_count: number;
    expired_claims: string[];
  } {
    const now = new Date();
    const expiredClaims: string[] = [];

    for (const [claimId, claim] of this.voucherClaims.entries()) {
      if (claim.status === 'claimed') {
        const expiresAt = new Date(claim.expiresAt);
        if (now > expiresAt) {
          claim.status = 'expired';
          claim.updatedAt = now.toISOString();
          this.voucherClaims.set(claimId, claim);

          // Atualizar métricas de abuso
          this.updateUserVoucherAbuseMetrics(claim.claimerUserId, 'expired');

          // Registrar evento
          const offer = this.voucherOffers.get(claim.offerId);
          this.recordVoucherEvent({
            offerId: claim.offerId,
            claimId: claimId,
            actorId: claim.claimerUserId,
            type: 'claim_expired',
            metadata: {
              offerTitle: offer?.title,
              claimerUserId: claim.claimerUserId,
              reason: 'Prazo de resgate expirado',
            },
          });

          expiredClaims.push(claimId);
        }
      }
    }

    marketplaceLogger.init('Claims expirados processados', {
      expired_count: expiredClaims.length,
    });

    return {
      expired_count: expiredClaims.length,
      expired_claims: expiredClaims,
    };
  }

  /**
   * Registrar evento de voucher
   */
  private recordVoucherEvent(event: Omit<VoucherRedemptionEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    const eventId = `voucher-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const voucherEvent: VoucherRedemptionEvent = {
      eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.voucherRedemptionEvents.set(eventId, voucherEvent);
  }

  /**
   * Atualizar métricas de abuso do usuário
   */
  private updateUserVoucherAbuseMetrics(userId: string, type: 'expired' | 'no_show'): void {
    let metrics = this.userVoucherAbuseMetrics.get(userId);
    if (!metrics) {
      metrics = {
        user_id: userId,
        expired_claims_count: 0,
        no_show_count: 0,
        last_penalty_reset: new Date().toISOString(),
      };
    }

    if (type === 'expired') {
      metrics.expired_claims_count += 1;
    } else if (type === 'no_show') {
      metrics.no_show_count += 1;
    }

    // Bloquear usuário se reincidente (determinístico)
    const totalAbuse = metrics.expired_claims_count + metrics.no_show_count;
    if (totalAbuse >= 5) {
      // Bloquear por 30 dias
      const blockedUntil = new Date();
      blockedUntil.setDate(blockedUntil.getDate() + 30);
      metrics.claim_blocked_until = blockedUntil.toISOString();
    }

    this.userVoucherAbuseMetrics.set(userId, metrics);
  }

  /**
   * Atualizar score de participação em vouchers (para boost local)
   */
  private updateVoucherParticipationScore(storeId: string, action: 'pause' | 'no_show'): void {
    let score = this.voucherParticipationScores.get(storeId);
    if (!score) {
      score = {
        storeId: storeId,
        participation_count: 0,
        cancellationRate: 0,
        no_show_rate: 0,
        last_boost_reset: new Date().toISOString(),
      };
    }

    if (action === 'pause') {
      // Aumentar taxa de cancelamento
      score.cancellationRate = Math.min(1.0, score.cancellationRate + 0.1);
    } else if (action === 'no_show') {
      // Aumentar taxa de no-show
      score.no_show_rate = Math.min(1.0, score.no_show_rate + 0.05);
    }

    this.voucherParticipationScores.set(storeId, score);
  }

  /**
   * Buscar claims de um usuário
   */
  getUserVoucherClaims(userId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.claimerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar claims de uma oferta
   */
  getOfferVoucherClaims(offerId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.offerId === offerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ============================================================
  // CAPACIDADE REGIONAL & GARGALOS (LEITURA ESTRUTURAL) (PROMPT 16)
  // ============================================================

  /**
   * Regional Capacity Snapshots (in-memory)
   * Snapshots imutáveis de capacidade regional
   */
  private regionalCapacitySnapshots: Map<string, RegionalCapacitySnapshot> = new Map(); // snapshot_id -> snapshot

  /**
   * Regional Capacity Metrics (in-memory)
   * Métricas de capacidade regional por categoria
   */
  private regionalCapacityMetrics: Map<string, RegionalCapacityMetric> = new Map(); // region_id-category -> metric

  /**
   * Calcular métricas de capacidade regional para uma categoria
   */
  calculateRegionalCapacityMetric(
    regionId: string,
    serviceCategory: string,
    period?: {
      start: string;
      end: string;
    }
  ): RegionalCapacityMetric {
    const now = new Date();
    const periodStart = period?.start ? new Date(period.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Padrão: últimos 30 dias
    const periodEnd = period?.end ? new Date(period.end) : now;

    // Buscar stores na região
    const stores = this.getStores();
    const regionStores = stores.stores.filter(store => {
      if (regionId.includes('-')) {
        // Bairro (ex: "curitiba-batel")
        const [city, neighborhood] = regionId.split('-');
        return store.branches.some(b => b.location?.city === city && b.location?.neighborhood === neighborhood);
      } else {
        // Cidade (ex: "curitiba")
        return store.branches.some(b => b.location?.city === regionId);
      }
    });

    // Buscar recursos na região
    const allResources: ServiceResource[] = [];
    for (const store of regionStores) {
      const storeResources = this.getServiceResourcesByStore(store.storeId);
      allResources.push(...storeResources);
    }

    // Calcular métricas
    const totalResources = allResources.length;
    const activeResources = allResources.filter(r => r.status === 'active').length;
    const overloadedResources = allResources.filter(r => r.status === 'overloaded').length;

    // Calcular utilização média
    let totalUtilization = 0;
    let peakUtilization = 0;
    for (const resource of allResources) {
      const capacity = resource.currentCapacity;
      if (capacity.totalSlotsAvailable > 0) {
        const utilization = (capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress) / capacity.totalSlotsAvailable;
        totalUtilization += utilization;
        peakUtilization = Math.max(peakUtilization, utilization);
      }
    }
    const avgUtilizationRate = totalResources > 0 ? totalUtilization / totalResources : 0;

    // Buscar eventos de sobrecarga no período
    const capacityEvents = Array.from(this.capacityEvents.values())
      .filter(e => {
        if (e.resourceId) {
          const resource = allResources.find(r => r.resourceId === e.resourceId);
          return !!resource;
        }
        return regionStores.some(s => s.storeId === e.storeId);
      })
      .filter(e => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= periodStart && eventDate <= periodEnd;
      })
      .filter(e => e.eventType === 'resource_overloaded');

    const overloadEventsCount = capacityEvents.length;

    // Buscar ServiceRequests na região e categoria
    const serviceRequests = Array.from(this.serviceRequests.values())
      .filter(r => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      });

    const totalRequests = serviceRequests.length;
    const expiredRequests = serviceRequests.filter(r => {
      const expiredAt = r.expiredAt ? new Date(r.expiredAt) : null;
      return expiredAt && expiredAt < now;
    }).length;
    const requestExpirationRate = totalRequests > 0 ? expiredRequests / totalRequests : 0;

    // Buscar dispatches
    const dispatches = Array.from(this.serviceDispatches.values())
      .filter(d => {
        const request = serviceRequests.find(r => r.requestId === d.requestId);
        return !!request;
      });

    const totalDispatches = dispatches.length;
    const rejectedDispatches = dispatches.filter(d => d.status === 'declined' || d.status === 'expired').length;
    const dispatchRejectionRate = totalDispatches > 0 ? rejectedDispatches / totalDispatches : 0;

    // Calcular tempos médios
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let totalConfirmationTime = 0;
    let confirmationTimeCount = 0;

    for (const dispatch of dispatches) {
      if (dispatch.createdAt && dispatch.acceptedAt) {
        const responseTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
        totalResponseTime += responseTime;
        responseTimeCount++;
      }

      const request = serviceRequests.find(r => r.requestId === dispatch.requestId);
      if (request && request.acceptedAt) {
        const executionTime = (new Date(request.acceptedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
        totalExecutionTime += executionTime;
        executionTimeCount++;
      }

      if (dispatch.acceptedAt && dispatch.createdAt) {
        const confirmationTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
        totalConfirmationTime += confirmationTime;
        confirmationTimeCount++;
      }
    }

    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    const avgConfirmationTime = confirmationTimeCount > 0 ? totalConfirmationTime / confirmationTimeCount : 0;

    // Calcular taxa de conversão request → execução
    const executedRequests = serviceRequests.filter(r => r.status === 'completed').length;
    const requestToExecutionRate = totalRequests > 0 ? executedRequests / totalRequests : 0;

    // Calcular taxa de violação de SLA
    const slaMetrics = Array.from(this.serviceGovernanceMetrics.values())
      .filter(m => {
        const resource = allResources.find(r => r.actorId === m.providerActorId);
        return !!resource;
      });

    const totalSLA = slaMetrics.length;
    const violatedSLA = slaMetrics.filter(m => m.status === 'sla_violation').length;
    const slaViolationRate = totalSLA > 0 ? violatedSLA / totalSLA : 0;

    // Calcular risco de SLA
    const slaRiskLevel: SLARiskLevel = this.calculateSLARiskLevel(
      avgResponseTime,
      avgExecutionTime,
      slaViolationRate,
      requestExpirationRate
    );

    // Classificar status e identificar gargalo
    const { status, bottleneckCause, bottleneckDetails } = this.classifyRegionalCapacity(
      avgUtilizationRate,
      requestExpirationRate,
      dispatchRejectionRate,
      avgConfirmationTime,
      requestToExecutionRate,
      overloadedResources,
      totalResources
    );

    const metric: RegionalCapacityMetric = {
      regionId: regionId,
      serviceCategory: serviceCategory,
      totalResources: totalResources,
      activeResources: activeResources,
      overloadedResources: overloadedResources,
      avgUtilizationRate: avgUtilizationRate,
      peakUtilizationRate: peakUtilization,
      overloadEventsCount: overloadEventsCount,
      requestExpirationRate: requestExpirationRate,
      dispatchRejectionRate: dispatchRejectionRate,
      avgResponseTimeMinutes: avgResponseTime,
      avgExecutionTimeMinutes: avgExecutionTime,
      avgConfirmationTimeMinutes: avgConfirmationTime,
      slaRiskLevel: slaRiskLevel,
      slaViolationRate: slaViolationRate,
      requestToExecutionRate: requestToExecutionRate,
      status,
      bottleneckCause: bottleneckCause,
      bottleneckDetails: bottleneckDetails,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    const metricKey = `${regionId}-${serviceCategory}`;
    this.regionalCapacityMetrics.set(metricKey, metric);

    return metric;
  }

  /**
   * Calcular nível de risco de SLA
   */
  private calculateSLARiskLevel(
    avgResponseTime: number,
    avgExecutionTime: number,
    slaViolationRate: number,
    requestExpirationRate: number
  ): SLARiskLevel {
    // Critérios determinísticos
    if (slaViolationRate > 0.3 || requestExpirationRate > 0.5) {
      return 'high';
    }

    if (avgResponseTime > 60 || avgExecutionTime > 120) {
      return 'high';
    }

    if (slaViolationRate > 0.15 || requestExpirationRate > 0.3) {
      return 'medium';
    }

    if (avgResponseTime > 30 || avgExecutionTime > 90) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Classificar capacidade regional e identificar gargalo
   */
  private classifyRegionalCapacity(
    avgUtilizationRate: number,
    requestExpirationRate: number,
    dispatchRejectionRate: number,
    avgConfirmationTime: number,
    requestToExecutionRate: number,
    overloadedResources: number,
    totalResources: number
  ): {
    status: RegionalCapacityStatus;
    bottleneckCause?: BottleneckCause;
    bottleneckDetails?: string;
  } {
    // Critérios determinísticos (sem inferência, apenas fatos)

    // Critical: Muitos recursos sobrecarregados + alta taxa de expiração
    if (totalResources > 0 && overloadedResources / totalResources > 0.3 && requestExpirationRate > 0.4) {
      return {
        status: 'critical',
        bottleneckCause: 'lack_of_professionals',
        bottleneckDetails: `Alta taxa de recursos sobrecarregados (${Math.round((overloadedResources / totalResources) * 100)}%) e alta taxa de expiração de requests (${Math.round(requestExpirationRate * 100)}%)`,
      };
    }

    // Critical: Baixa taxa de conversão + alta rejeição de dispatches
    if (requestToExecutionRate < 0.3 && dispatchRejectionRate > 0.5) {
      return {
        status: 'critical',
        bottleneckCause: 'excess_demand',
        bottleneckDetails: `Baixa taxa de conversão (${Math.round(requestToExecutionRate * 100)}%) e alta rejeição de dispatches (${Math.round(dispatchRejectionRate * 100)}%)`,
      };
    }

    // Warning: Alta utilização + tempo longo de confirmação
    if (avgUtilizationRate > 0.8 && avgConfirmationTime > 60) {
      return {
        status: 'warning',
        bottleneckCause: 'schedule_bottleneck',
        bottleneckDetails: `Alta utilização (${Math.round(avgUtilizationRate * 100)}%) e tempo médio de confirmação alto (${Math.round(avgConfirmationTime)} minutos)`,
      };
    }

    // Warning: Alta taxa de expiração
    if (requestExpirationRate > 0.3) {
      return {
        status: 'warning',
        bottleneckCause: 'lack_of_professionals',
        bottleneckDetails: `Alta taxa de expiração de requests (${Math.round(requestExpirationRate * 100)}%)`,
      };
    }

    // Warning: Muitos recursos sobrecarregados
    if (totalResources > 0 && overloadedResources / totalResources > 0.2) {
      return {
        status: 'warning',
        bottleneckCause: 'capacity_distribution_issue',
        bottleneckDetails: `Proporção significativa de recursos sobrecarregados (${Math.round((overloadedResources / totalResources) * 100)}%)`,
      };
    }

    // Healthy: Tudo dentro do normal
    return {
      status: 'healthy',
    };
  }

  /**
   * Gerar snapshot regional de capacidade
   */
  generateRegionalCapacitySnapshot(
    regionId: string,
    period: {
      start: string;
      end: string;
    },
    periodType: 'weekly' | 'monthly' = 'monthly'
  ): RegionalCapacitySnapshot {
    // Verificar se já existe snapshot para este período
    const existingSnapshot = Array.from(this.regionalCapacitySnapshots.values())
      .find(s => s.regionId === regionId && s.period.start === period.start && s.period.end === period.end);

    if (existingSnapshot) {
      throw new Error('Snapshot já existe para este período (imutável)');
    }

    // Buscar categorias de serviço
    const categories = this.getCategories();
    const categoryIds = categories.categories.map(c => c.id);

    // Calcular métricas por categoria
    const byCategory: RegionalCapacityMetric[] = [];
    for (const categoryId of categoryIds) {
      const metric = this.calculateRegionalCapacityMetric(regionId, categoryId, period);
      byCategory.push(metric);
    }

    // Calcular métricas agregadas
    const totalResources = byCategory.reduce((sum, m) => sum + m.totalResources, 0);
    const totalActiveResources = byCategory.reduce((sum, m) => sum + m.activeResources, 0);
    const totalOverloadedResources = byCategory.reduce((sum, m) => sum + m.overloadedResources, 0);

    // Identificar gargalos
    const identifiedBottlenecks = byCategory
      .filter(m => m.status !== 'healthy' && m.bottleneckCause)
      .map(m => ({
        category: m.serviceCategory,
        cause: m.bottleneckCause!,
        severity: m.status === 'critical' ? 'high' as const : m.status === 'warning' ? 'medium' as const : 'low' as const,
        details: m.bottleneckDetails || '',
      }));

    // Calcular status geral
    const criticalCount = byCategory.filter(m => m.status === 'critical').length;
    const warningCount = byCategory.filter(m => m.status === 'warning').length;
    const overallStatus: RegionalCapacityStatus = criticalCount > 0 ? 'critical' : warningCount > byCategory.length * 0.3 ? 'warning' : 'healthy';

    // Calcular risco geral de SLA
    const highRiskCount = byCategory.filter(m => m.slaRiskLevel === 'high').length;
    const mediumRiskCount = byCategory.filter(m => m.slaRiskLevel === 'medium').length;
    const overallSLARisk: SLARiskLevel = highRiskCount > 0 ? 'high' : mediumRiskCount > byCategory.length * 0.3 ? 'medium' : 'low';

    // Por tipo de empresa (simplificado)
    const byCompanyType: Array<{
      companyType: string;
      totalResources: number;
      activeResources: number;
      avgUtilizationRate: number;
      status: RegionalCapacityStatus;
    }> = []; // TODO: Implementar agregação por tipo de empresa se necessário

    const snapshotId = `snapshot-${regionId}-${period.start}-${period.end}`;
    const snapshot: RegionalCapacitySnapshot = {
      snapshotId: snapshotId,
      regionId: regionId,
      period,
      periodType: periodType,
      totalResources: totalResources,
      totalActiveResources: totalActiveResources,
      totalOverloadedResources: totalOverloadedResources,
      byCategory: byCategory,
      byCompanyType: byCompanyType,
      identifiedBottlenecks: identifiedBottlenecks,
      overallStatus: overallStatus,
      overallSlaRisk: overallSLARisk,
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.regionalCapacitySnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de capacidade regional gerado', {
      snapshotId: snapshotId,
      regionId: regionId,
      periodType: periodType,
      overallStatus: overallStatus,
    });

    return snapshot;
  }

  /**
   * Buscar snapshot de capacidade regional
   */
  getRegionalCapacitySnapshot(snapshotId: string): RegionalCapacitySnapshot | null {
    return this.regionalCapacitySnapshots.get(snapshotId) || null;
  }

  /**
   * Listar snapshots de capacidade regional
   */
  listRegionalCapacitySnapshots(filters?: {
    regionId?: string;
    periodType?: 'weekly' | 'monthly';
    starts_at?: string;
    ends_at?: string;
  }): RegionalCapacitySnapshot[] {
    let snapshots = Array.from(this.regionalCapacitySnapshots.values());

    if (filters?.regionId) {
      snapshots = snapshots.filter(s => s.regionId === filters.regionId);
    }

    if (filters?.periodType) {
      snapshots = snapshots.filter(s => s.periodType === filters.periodType);
    }

    if (filters?.starts_at) {
      snapshots = snapshots.filter(s => s.period.start >= filters.starts_at!);
    }

    if (filters?.ends_at) {
      snapshots = snapshots.filter(s => s.period.end <= filters.ends_at!);
    }

    return snapshots.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  /**
   * Buscar métrica de capacidade regional atual (não snapshot)
   */
  getRegionalCapacityMetric(regionId: string, serviceCategory: string): RegionalCapacityMetric | null {
    const metricKey = `${regionId}-${serviceCategory}`;
    return this.regionalCapacityMetrics.get(metricKey) || null;
  }

  /**
   * Listar métricas de capacidade regional
   */
  listRegionalCapacityMetrics(filters?: {
    regionId?: string;
    serviceCategory?: string;
    status?: RegionalCapacityStatus;
  }): RegionalCapacityMetric[] {
    let metrics = Array.from(this.regionalCapacityMetrics.values());

    if (filters?.regionId) {
      metrics = metrics.filter(m => m.regionId === filters.regionId);
    }

    if (filters?.serviceCategory) {
      metrics = metrics.filter(m => m.serviceCategory === filters.serviceCategory);
    }

    if (filters?.status) {
      metrics = metrics.filter(m => m.status === filters.status);
    }

    return metrics.sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
  }

  // ============================================================
  // EXPANSÃO GUIADA DE PRESTADORES (SERVIÇOS) (PROMPT 17)
  // ============================================================

  /**
   * Regional Expansion Signals (in-memory)
   * Sinais de expansão gerados a partir de snapshots regionais
   */
  private regionalExpansionSignals: Map<string, RegionalExpansionSignal> = new Map(); // signal_id -> signal

  /**
   * Expansion Unlocks (in-memory)
   * Desbloqueios de funcionalidades baseados em sinais
   */
  private expansionUnlocks: Map<string, ExpansionUnlock> = new Map(); // unlockId -> unlock

  /**
   * Gerar sinais de expansão a partir de snapshot regional
   */
  generateExpansionSignalsFromSnapshot(snapshotId: string): RegionalExpansionSignal[] {
    const snapshot = this.regionalCapacitySnapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot não encontrado');
    }

    const signals: RegionalExpansionSignal[] = [];

    // Processar apenas categorias com status warning ou critical
    const criticalCategories = snapshot.byCategory.filter(
      m => m.status === 'warning' || m.status === 'critical'
    );

    // Processar apenas categorias com risco de SLA medium ou high
    const highRiskCategories = criticalCategories.filter(
      m => m.slaRiskLevel === 'medium' || m.slaRiskLevel === 'high'
    );

    for (const metric of highRiskCategories) {
      // Determinar tipo de sinal baseado no gargalo
      let signalType: ExpansionSignalType;
      let unlockedFeatures: ExpansionUnlockFeature[] = [];

      switch (metric.bottleneckCause) {
        case 'lack_of_professionals':
          signalType = 'need_more_providers';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive', 'strategic_vouchers'];
          break;

        case 'excess_demand':
          signalType = 'need_more_capacity';
          unlockedFeatures = ['b2b_capacity_market', 'economic_incentive', 'strategic_vouchers'];
          break;

        case 'capacity_distribution_issue':
          signalType = 'need_more_capacity';
          unlockedFeatures = ['b2b_capacity_market', 'service_catalog_suggestion'];
          break;

        case 'schedule_bottleneck':
          signalType = 'need_extended_hours';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive'];
          break;

        case 'time_bottleneck':
          signalType = 'need_extended_hours';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive'];
          break;

        default:
          signalType = 'need_more_providers';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive'];
      }

      const signalId = `expansion-signal-${snapshot.regionId}-${metric.serviceCategory}-${Date.now()}`;

      const signal: RegionalExpansionSignal = {
        signalId: signalId,
        regionId: snapshot.regionId,
        serviceCategory: metric.serviceCategory,
        signalType: signalType,
        bottleneckCause: metric.bottleneckCause || 'lack_of_professionals',
        triggeringMetrics: {
          status: metric.status,
          slaRiskLevel: metric.slaRiskLevel,
          requestExpirationRate: metric.requestExpirationRate,
          dispatchRejectionRate: metric.dispatchRejectionRate,
          avgUtilizationRate: metric.avgUtilizationRate,
          overloadedResourcesRatio: metric.totalResources > 0
            ? metric.overloadedResources / metric.totalResources
            : 0,
        },
        sourceSnapshotId: snapshotId,
        unlockedFeatures: unlockedFeatures,
        status: 'active',
        createdAt: new Date().toISOString(),
        immutable: true,
      };

      this.regionalExpansionSignals.set(signalId, signal);

      // Criar desbloqueios para cada funcionalidade
      for (const feature of unlockedFeatures) {
        this.createExpansionUnlock(signalId, feature, snapshot.regionId, metric.serviceCategory);
      }

      signals.push(signal);
    }

    marketplaceLogger.init('Sinais de expansão gerados', {
      snapshotId: snapshotId,
      signals_count: signals.length,
    });

    return signals;
  }

  /**
   * Criar desbloqueio de expansão
   */
  private createExpansionUnlock(
    signalId: string,
    feature: ExpansionUnlockFeature,
    regionId: string,
    serviceCategory: string
  ): ExpansionUnlock {
    const unlockId = `unlock-${signalId}-${feature}-${Date.now()}`;

    // Descrição baseada no tipo de funcionalidade
    const featureDescriptions: Record<ExpansionUnlockFeature, string> = {
      facilitated_onboarding: 'Onboarding facilitado para esta categoria de serviço',
      economic_incentive: 'Incentivo econômico disponível para novos prestadores',
      service_catalog_suggestion: 'Sugestão de ativação de novos serviços no catálogo',
      b2b_capacity_market: 'Mercado de capacidade B2B habilitado para esta região',
      strategic_vouchers: 'Vouchers estratégicos liberados para atrair prestadores',
    };

    const unlock: ExpansionUnlock = {
      unlockId: unlockId,
      signalId: signalId,
      regionId: regionId,
      serviceCategory: serviceCategory,
      feature,
      details: {
        description: featureDescriptions[feature],
        eligibilityCriteria: this.getEligibilityCriteria(feature),
        availableUntil: this.getAvailabilityDeadline(feature),
      },
      status: 'available',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      immutable: false,
    };

    this.expansionUnlocks.set(unlockId, unlock);

    return unlock;
  }

  /**
   * Obter critérios de elegibilidade para uma funcionalidade
   */
  private getEligibilityCriteria(feature: ExpansionUnlockFeature): string[] {
    switch (feature) {
      case 'facilitated_onboarding':
        return ['Empresa na região afetada', 'Categoria de serviço compatível', 'Trust level >= L2'];
      case 'economic_incentive':
        return ['Novo prestador na região', 'Categoria de serviço compatível', 'Trust level >= L2'];
      case 'service_catalog_suggestion':
        return ['Empresa ativa na região', 'Categoria de serviço compatível'];
      case 'b2b_capacity_market':
        return ['Empresa com capacidade disponível', 'Região compatível'];
      case 'strategic_vouchers':
        return ['Empresa na região afetada', 'Categoria de serviço compatível'];
      default:
        return [];
    }
  }

  /**
   * Obter prazo de disponibilidade para uma funcionalidade
   */
  private getAvailabilityDeadline(feature: ExpansionUnlockFeature): string {
    const now = new Date();
    // Desbloqueios ficam disponíveis por 90 dias
    const deadline = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return deadline.toISOString();
  }

  /**
   * Buscar sinais de expansão ativos
   */
  getActiveExpansionSignals(filters?: {
    regionId?: string;
    serviceCategory?: string;
    signalType?: ExpansionSignalType;
  }): RegionalExpansionSignal[] {
    let signals = Array.from(this.regionalExpansionSignals.values())
      .filter(s => s.status === 'active');

    if (filters?.regionId) {
      signals = signals.filter(s => s.regionId === filters.regionId);
    }

    if (filters?.serviceCategory) {
      signals = signals.filter(s => s.serviceCategory === filters.serviceCategory);
    }

    if (filters?.signalType) {
      signals = signals.filter(s => s.signalType === filters.signalType);
    }

    return signals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar desbloqueios disponíveis
   */
  getAvailableExpansionUnlocks(filters?: {
    regionId?: string;
    serviceCategory?: string;
    feature?: ExpansionUnlockFeature;
  }): ExpansionUnlock[] {
    const now = new Date();
    let unlocks = Array.from(this.expansionUnlocks.values())
      .filter(u => {
        if (u.status !== 'available') return false;
        if (u.details.availableUntil) {
          const deadline = new Date(u.details.availableUntil);
          if (now > deadline) {
            // Marcar como expirado
            u.status = 'expired';
            u.updatedAt = new Date().toISOString();
            this.expansionUnlocks.set(u.unlockId, u);
            return false;
          }
        }
        return true;
      });

    if (filters?.regionId) {
      unlocks = unlocks.filter(u => u.regionId === filters.regionId);
    }

    if (filters?.serviceCategory) {
      unlocks = unlocks.filter(u => u.serviceCategory === filters.serviceCategory);
    }

    if (filters?.feature) {
      unlocks = unlocks.filter(u => u.feature === filters.feature);
    }

    return unlocks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Marcar desbloqueio como consumido
   */
  consumeExpansionUnlock(unlockId: string): ExpansionUnlock | null {
    const unlock = this.expansionUnlocks.get(unlockId);
    if (!unlock) {
      return null;
    }

    if (unlock.status !== 'available') {
      throw new Error('Desbloqueio não está disponível');
    }

    unlock.status = 'consumed';
    unlock.consumedAt = new Date().toISOString();
    unlock.updatedAt = new Date().toISOString();

    this.expansionUnlocks.set(unlockId, unlock);

    marketplaceLogger.init('Desbloqueio de expansão consumido', {
      unlockId: unlockId,
      feature: unlock.feature,
      regionId: unlock.regionId,
    });

    return unlock;
  }

  /**
   * Verificar se uma funcionalidade está desbloqueada para uma região/categoria
   */
  isFeatureUnlocked(
    regionId: string,
    serviceCategory: string,
    feature: ExpansionUnlockFeature
  ): boolean {
    const unlocks = this.getAvailableExpansionUnlocks({
      regionId: regionId,
      serviceCategory: serviceCategory,
      feature,
    });

    return unlocks.length > 0;
  }

  /**
   * Resolver sinal de expansão (quando gargalo é resolvido)
   */
  resolveExpansionSignal(signalId: string): RegionalExpansionSignal | null {
    const signal = this.regionalExpansionSignals.get(signalId);
    if (!signal) {
      return null;
    }

    // Sinais são imutáveis, então não podemos atualizar diretamente
    // Por enquanto, vamos apenas retornar o sinal (na prática, um novo snapshot pode gerar um novo sinal ou não)

    marketplaceLogger.init('Sinal de expansão resolvido', {
      signalId: signalId,
      regionId: signal.regionId,
    });

    return signal;
  }

  /**
   * Verificar se há sinais de expansão para uma região
   */
  hasExpansionSignals(regionId: string): boolean {
    const signals = this.getActiveExpansionSignals({ regionId: regionId });
    return signals.length > 0;
  }

  /**
   * Obter resumo de expansão para uma região
   */
  getRegionalExpansionSummary(regionId: string): {
    active_signals_count: number;
    available_unlocks_count: number;
    categories_affected: string[];
    features_unlocked: ExpansionUnlockFeature[];
  } {
    const signals = this.getActiveExpansionSignals({ regionId: regionId });
    const unlocks = this.getAvailableExpansionUnlocks({ regionId: regionId });

    const categoriesAffected = [...new Set(signals.map(s => s.serviceCategory))];
    const featuresUnlocked = [...new Set(unlocks.map(u => u.feature))];

    return {
      active_signals_count: signals.length,
      available_unlocks_count: unlocks.length,
      categories_affected: categoriesAffected,
      features_unlocked: featuresUnlocked,
    };
  }

  // ============================================================
  // PRECIFICAÇÃO ASSISTIDA (PRIVADA, NÃO PRESCRITIVA) (PROMPT 15)
  // ============================================================

  /**
   * Pricing Assistance Reports (in-memory)
   * Relatórios de precificação assistida (privados, imutáveis)
   */
  private pricingAssistanceReports: Map<string, PricingAssistanceReport> = new Map(); // report_id -> report

  /**
   * Operational Cost Profiles (in-memory)
   * Perfis de custo operacional (podem ser atualizados)
   */
  private operationalCostProfiles: Map<string, OperationalCostProfile> = new Map(); // store_id -> profile

  /**
   * Criar ou atualizar perfil de custo operacional
   */
  setOperationalCostProfile(
    storeId: string,
    companyId: string,
    profile: {
      fixedCostsMonthly?: {
        rent?: { amountCents: number; currency: string };
        salaries?: { amountCents: number; currency: string };
        pro_labore?: { amountCents: number; currency: string };
        systems?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      variableCostsPerService?: {
        materials?: { amountCents: number; currency: string };
        commission?: { amountCents: number; currency: string };
        transportation?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      costs_per_hour?: {
        fixed_cost_per_hour?: { amountCents: number; currency: string };
        variable_cost_per_hour?: { amountCents: number; currency: string };
      };
    }
  ): OperationalCostProfile {
    // Calcular totais
    const fixedTotal = (profile.fixedCostsMonthly?.rent?.amountCents || 0) +
      (profile.fixedCostsMonthly?.salaries?.amountCents || 0) +
      (profile.fixedCostsMonthly?.pro_labore?.amountCents || 0) +
      (profile.fixedCostsMonthly?.systems?.amountCents || 0) +
      (profile.fixedCostsMonthly?.other?.amountCents || 0);

    const variableAverage = (profile.variableCostsPerService?.materials?.amountCents || 0) +
      (profile.variableCostsPerService?.commission?.amountCents || 0) +
      (profile.variableCostsPerService?.transportation?.amountCents || 0) +
      (profile.variableCostsPerService?.other?.amountCents || 0);

    const costProfile: OperationalCostProfile = {
      storeId: storeId,
      companyId: companyId,
      fixedCostsMonthly: {
        rent: profile.fixedCostsMonthly?.rent,
        salaries: profile.fixedCostsMonthly?.salaries,
        proLabore: profile.fixedCostsMonthly?.pro_labore,
        systems: profile.fixedCostsMonthly?.systems,
        other: profile.fixedCostsMonthly?.other,
        totalCents: { amountCents: fixedTotal, currency: 'BRL' },
      },
      variableCostsPerService: {
        materials: profile.variableCostsPerService?.materials,
        commission: profile.variableCostsPerService?.commission,
        transportation: profile.variableCostsPerService?.transportation,
        other: profile.variableCostsPerService?.other,
        averagePerService: { amountCents: variableAverage, currency: 'BRL' },
      },
      costsPerHour: profile.costs_per_hour ? {
        fixed_cost_per_hour: profile.costs_per_hour.fixed_cost_per_hour || { amountCents: 0, currency: 'BRL' },
        variable_cost_per_hour: profile.costs_per_hour.variable_cost_per_hour || { amountCents: 0, currency: 'BRL' },
        totalCost_per_hour: {
          amountCents: (profile.costs_per_hour.fixed_cost_per_hour?.amountCents || 0) + (profile.costs_per_hour.variable_cost_per_hour?.amountCents || 0),
          currency: 'BRL',
        },
      } : undefined,
      data_source: {
        declared: true,
        historical: false,
        last_updated: new Date().toISOString(),
      },
      calculatedAt: new Date().toISOString(),
      immutable: false,
    };

    this.operationalCostProfiles.set(storeId, costProfile);

    marketplaceLogger.init('Perfil de custo operacional atualizado', {
      storeId: storeId,
      companyId: companyId,
    });

    return costProfile;
  }

  /**
   * Obter perfil de custo operacional
   */
  getOperationalCostProfile(storeId: string): OperationalCostProfile | null {
    return this.operationalCostProfiles.get(storeId) || null;
  }

  /**
   * Calcular métricas de operação real
   */
  calculateRealOperationMetrics(
    storeId: string,
    companyId: string,
    period: {
      start: string;
      end: string;
    }
  ): RealOperationMetrics {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    // Buscar ServiceOrders executados no período
    const serviceOrders = Array.from(this.serviceOrders.values())
      .filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= periodStart && orderDate <= periodEnd && o.status === 'completed';
      })
      .filter(o => {
        // Filtrar por store (através do provider)
        const offering = this.serviceOfferings.get(o.offeringId);
        if (!offering) return false;
        return offering.storeId === storeId;
      });

    // Calcular receita total e ticket médio
    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.price.amountCents;
    }
    const averageTicket = serviceOrders.length > 0 ? totalRevenue / serviceOrders.length : 0;

    // Calcular tempos médios
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const order of serviceOrders) {
      const request = Array.from(this.serviceRequests.values())
        .find(r => r.requestId === order.requestId);

      if (request) {
        if (request.completedAt && request.createdAt) {
          const executionTime = (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
          totalExecutionTime += executionTime;
          executionTimeCount++;
        }

        const dispatch = Array.from(this.serviceDispatches.values())
          .find(d => d.requestId === request.requestId && d.status === 'accepted');

        if (dispatch && dispatch.createdAt && dispatch.acceptedAt) {
          const responseTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }
    }

    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    // Calcular taxa de cancelamento
    const allRequests = Array.from(this.serviceRequests.values())
      .filter(r => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      })
      .filter(r => {
        const offering = Array.from(this.serviceOfferings.values())
          .find(o => {
            const order = serviceOrders.find(so => so.requestId === r.requestId);
            return order && o.offering_id === order.offeringId;
          });
        return !!offering;
      });

    const totalRequests = allRequests.length;
    const cancelledRequests = allRequests.filter(r => r.status === 'cancelled' || r.status === 'expired').length;
    const cancellationRate = totalRequests > 0 ? cancelledRequests / totalRequests : 0;

    // Análise de lucratividade (será calculada no relatório completo)
    const servicesAtLoss = 0; // Será calculado no relatório completo
    const servicesAtLossPercentage = 0;
    const totalLossAmount = 0;

    return {
      storeId: storeId,
      companyId: companyId,
      period,
      averageTicket: { amountCents: averageTicket, currency: 'BRL' },
      totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
      totalServices: serviceOrders.length,
      averageExecutionTimeMinutes: avgExecutionTime,
      averageResponseTimeMinutes: avgResponseTime,
      cancellationRate: cancellationRate,
      cancelledServicesCount: cancelledRequests,
      totalRequestsCount: totalRequests,
      servicesAtLoss: servicesAtLoss,
      servicesAtLossPercentage: servicesAtLossPercentage,
      totalLossAmount: { amountCents: totalLossAmount, currency: 'BRL' },
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  /**
   * Calcular análise de ponto de equilíbrio
   */
  calculateBreakEvenAnalysis(
    storeId: string,
    costProfile: OperationalCostProfile,
    operationMetrics: RealOperationMetrics
  ): BreakEvenAnalysis {
    const fixedCosts = costProfile.fixedCostsMonthly.totalCents.amountCents;
    const variableCostPerService = costProfile.variableCostsPerService.averagePerService.amountCents;
    const averageTicket = operationMetrics.averageTicket.amountCents;

    // Ponto de equilíbrio: receita = custos fixos + (custo variável * quantidade)
    // Receita = preço médio * quantidade
    // preço médio * quantidade = custos fixos + (custo variável * quantidade)
    // quantidade * (preço médio - custo variável) = custos fixos
    // quantidade = custos fixos / (preço médio - custo variável)

    const marginPerService = averageTicket - variableCostPerService;
    const breakEvenServices = marginPerService > 0 ? Math.ceil(fixedCosts / marginPerService) : 0;
    const breakEvenRevenue = breakEvenServices * averageTicket;

    const currentRevenue = operationMetrics.totalRevenue.amountCents;
    const marginToBreakEven = currentRevenue - breakEvenRevenue;
    const isAboveBreakEven = marginToBreakEven >= 0;

    return {
      breakEvenMonthlyServices: breakEvenServices,
      breakEvenMonthlyRevenue: { amountCents: breakEvenRevenue, currency: 'BRL' },
      currentMonthlyServices: operationMetrics.totalServices,
      currentMonthlyRevenue: { amountCents: currentRevenue, currency: 'BRL' },
      marginToBreakEven: marginToBreakEven,
      isAboveBreakEven: isAboveBreakEven,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  /**
   * Calcular análise de margem por serviço
   */
  calculateServiceMarginAnalysis(
    storeId: string,
    serviceOfferingId: string,
    costProfile: OperationalCostProfile,
    period: {
      start: string;
      end: string;
    }
  ): ServiceMarginAnalysis | null {
    const offering = this.serviceOfferings.get(serviceOfferingId);
    if (!offering || offering.storeId !== storeId) {
      return null;
    }

    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    // Buscar ServiceOrders deste serviço no período
    const serviceOrders = Array.from(this.serviceOrders.values())
      .filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= periodStart && orderDate <= periodEnd && o.status === 'completed';
      })
      .filter(o => o.offeringId === serviceOfferingId);

    if (serviceOrders.length === 0) {
      return null;
    }

    // Calcular preço médio
    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.price.amountCents;
    }
    const averagePrice = totalRevenue / serviceOrders.length;

    // Calcular custo médio (variável + proporcional fixo)
    const variableCost = costProfile.variableCostsPerService.averagePerService.amountCents;
    const fixedCostPerService = costProfile.fixedCostsMonthly.totalCents.amountCents / Math.max(serviceOrders.length, 1);
    const averageCost = variableCost + fixedCostPerService;

    // Calcular margem
    const marginPerService = averagePrice - averageCost;
    const marginPercentage = averagePrice > 0 ? (marginPerService / averagePrice) * 100 : 0;
    const isProfitable = marginPerService > 0;

    const totalCost = averageCost * serviceOrders.length;

    const template = this.getServiceTemplates().templates.find(t => t.templateId === offering.templateId);
    const serviceName = template?.name ?? 'Serviço';

    return {
      serviceOfferingId: serviceOfferingId,
      serviceName,
      averagePrice: { amountCents: averagePrice, currency: 'BRL' },
      averageCost: { amountCents: averageCost, currency: 'BRL' },
      marginPerService: { amountCents: marginPerService, currency: 'BRL' },
      marginPercentage: marginPercentage,
      isProfitable: isProfitable,
      servicesExecutedCount: serviceOrders.length,
      totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
      totalCost: { amountCents: totalCost, currency: 'BRL' },
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  /**
   * Calcular risco operacional
   */
  private calculateOperationalRisk(
    breakEven: BreakEvenAnalysis,
    operationMetrics: RealOperationMetrics,
    serviceMargins: ServiceMarginAnalysis[]
  ): {
    risk: OperationalRiskLevel;
    factors: string[];
  } {
    const factors: string[] = [];

    // Verificar se está abaixo do break-even
    if (!breakEven.isAboveBreakEven) {
      factors.push('Operando abaixo do ponto de equilíbrio');
    }

    // Verificar taxa de cancelamento alta
    if (operationMetrics.cancellationRate > 0.3) {
      factors.push(`Taxa de cancelamento alta (${Math.round(operationMetrics.cancellationRate * 100)}%)`);
    }

    // Verificar serviços no prejuízo
    const unprofitableServices = serviceMargins.filter(m => !m.isProfitable).length;
    if (unprofitableServices > 0) {
      factors.push(`${unprofitableServices} serviço(s) executado(s) no prejuízo`);
    }

    // Verificar margem média baixa
    const avgMargin = serviceMargins.length > 0
      ? serviceMargins.reduce((sum, m) => sum + m.marginPercentage, 0) / serviceMargins.length
      : 0;
    if (avgMargin < 10) {
      factors.push(`Margem média baixa (${Math.round(avgMargin)}%)`);
    }

    // Determinar nível de risco
    let risk: OperationalRiskLevel = 'low';
    if (factors.length >= 3 || !breakEven.isAboveBreakEven) {
      risk = 'high';
    } else if (factors.length >= 2 || operationMetrics.cancellationRate > 0.2) {
      risk = 'medium';
    }

    return { risk, factors };
  }

  /**
   * Gerar relatório de precificação assistida
   */
  generatePricingAssistanceReport(
    storeId: string,
    companyId: string,
    actorId: string,
    period: {
      start: string;
      end: string;
    }
  ): PricingAssistanceReport {
    // Verificar se já existe relatório para este período
    const existingReport = Array.from(this.pricingAssistanceReports.values())
      .find(r => r.storeId === storeId && r.period.start === period.start && r.period.end === period.end);

    if (existingReport) {
      throw new Error('Relatório já existe para este período (imutável)');
    }

    // Obter perfil de custo
    const costProfile = this.operationalCostProfiles.get(storeId);
    if (!costProfile) {
      throw new Error('Perfil de custo operacional não encontrado. Configure os custos primeiro.');
    }

    // Calcular métricas de operação real
    const operationMetrics = this.calculateRealOperationMetrics(storeId, companyId, period);

    // Calcular análise de ponto de equilíbrio
    const breakEvenAnalysis = this.calculateBreakEvenAnalysis(storeId, costProfile, operationMetrics);

    // Calcular análise de margem por serviço
    const serviceOfferings = Array.from(this.serviceOfferings.values())
      .filter(o => o.storeId === storeId);

    const serviceMargins: ServiceMarginAnalysis[] = [];
    for (const offering of serviceOfferings) {
      const margin = this.calculateServiceMarginAnalysis(storeId, offering.offering_id, costProfile, period);
      if (margin) {
        serviceMargins.push(margin);
      }
    }

    // Calcular margem média mensal
    const totalRevenue = serviceMargins.reduce((sum, m) => sum + m.totalRevenue.amountCents, 0);
    const totalCost = serviceMargins.reduce((sum, m) => sum + m.totalCost.amountCents, 0);
    const margin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    // Calcular risco operacional
    const { risk, factors } = this.calculateOperationalRisk(breakEvenAnalysis, operationMetrics, serviceMargins);

    // Gerar alertas silenciosos (não prescritivos)
    const alerts: Array<{
      type: 'operating_at_loss' | 'below_break_even' | 'high_cancellationRate' | 'low_margin_services';
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }> = [];

    if (!breakEvenAnalysis.isAboveBreakEven) {
      alerts.push({
        type: 'below_break_even',
        message: `Receita atual (R$ ${(breakEvenAnalysis.currentMonthlyRevenue.amountCents / 100).toFixed(2)}) está abaixo do ponto de equilíbrio (R$ ${(breakEvenAnalysis.breakEvenMonthlyRevenue.amountCents / 100).toFixed(2)})`,
        severity: 'critical',
      });
    }

    if (operationMetrics.cancellationRate > 0.3) {
      alerts.push({
        type: 'high_cancellationRate',
        message: `Taxa de cancelamento de ${Math.round(operationMetrics.cancellationRate * 100)}%`,
        severity: 'warning',
      });
    }

    const unprofitableServices = serviceMargins.filter(m => !m.isProfitable);
    if (unprofitableServices.length > 0) {
      alerts.push({
        type: 'low_margin_services',
        message: `${unprofitableServices.length} serviço(s) com margem negativa`,
        severity: 'warning',
      });
    }

    if (margin < 0) {
      alerts.push({
        type: 'operating_at_loss',
        message: 'Operação com margem negativa no período',
        severity: 'critical',
      });
    }

    const reportId = `pricing-report-${storeId}-${period.start}-${period.end}`;
    const report: PricingAssistanceReport = {
      reportId: reportId,
      storeId: storeId,
      companyId: companyId,
      actorId: actorId,
      period,
      costProfile: costProfile,
      operationMetrics: operationMetrics,
      breakEvenAnalysis: breakEvenAnalysis,
      serviceMargins: serviceMargins,
      averageMonthlyMargin: {
        totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
        totalCost: { amountCents: totalCost, currency: 'BRL' },
        margin: { amountCents: margin, currency: 'BRL' },
        marginPercentage: marginPercentage,
      },
      operationalRisk: risk,
      riskFactors: factors,
      alerts,
      governance: {
        noPriceSuggestion: true,
        noCatalogModification: true,
        noMatchingInterference: true,
        privateOnly: true,
      },
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.pricingAssistanceReports.set(reportId, report);

    marketplaceLogger.init('Relatório de precificação assistida gerado', {
      reportId: reportId,
      storeId: storeId,
      companyId: companyId,
    });

    return report;
  }

  /**
   * Buscar relatório de precificação assistida
   */
  getPricingAssistanceReport(reportId: string, actorId: string): PricingAssistanceReport | null {
    const report = this.pricingAssistanceReports.get(reportId);
    if (!report) {
      return null;
    }

    // Verificar se o actor tem permissão (apenas dono/gestor)
    if (report.actorId !== actorId) {
      throw new Error('Acesso negado: apenas o dono/gestor pode ver este relatório');
    }

    return report;
  }

  /**
   * Listar relatórios de precificação assistida
   */
  listPricingAssistanceReports(filters: {
    storeId: string;
    actorId: string;
    starts_at?: string;
    ends_at?: string;
  }): PricingAssistanceReport[] {
    let reports = Array.from(this.pricingAssistanceReports.values())
      .filter(r => r.storeId === filters.storeId && r.actorId === filters.actorId);

    if (filters.starts_at) {
      reports = reports.filter(r => r.period.start >= filters.starts_at!);
    }

    if (filters.ends_at) {
      reports = reports.filter(r => r.period.end <= filters.ends_at!);
    }

    return reports.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }
}

// Instância singleton do service
export const marketplaceService = new MarketplaceService();

// Inicializar dados de exemplo (para desenvolvimento)
// Controlado via flag ENABLE_MARKETPLACE_SEED
const enableMarketplaceSeed = process.env.ENABLE_MARKETPLACE_SEED?.toLowerCase() === 'true';

// Proteção adicional: em produção, seed só executa se explicitamente habilitado
if (process.env.NODE_ENV === 'production' && !enableMarketplaceSeed) {
  // Em produção, seed não deve executar sem flag explícita
  // Validação já feita em env-validation.ts
}

if (enableMarketplaceSeed) {
  // Fail fast se inicialização falhar
  try {
    marketplaceService.initializeServiceData();
    marketplaceService.initializeCompanyPlans();
    marketplaceService.initializeBusinessTemplates();
    marketplaceService.initializeProductTemplates();
    marketplaceService.initializeServiceTemplatesCanonical();
    marketplaceLogger.init('Dados de exemplo inicializados');
  } catch (err) {
    marketplaceLogger.error('Erro ao inicializar dados de exemplo', err);
    throw err; // Fail fast - não permitir boot com dados corrompidos
  }
}





