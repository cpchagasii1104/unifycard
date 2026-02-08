// backend/src/modules/marketplace/marketplace.service.ts
// Módulo Marketplace - Service Canônico
// Esqueleto mínimo sem lógica de negócio

import { marketplaceLogger } from './marketplace.logger';
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
  OperationalCostProfile,
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
  getStores(scope?: string, valueCents: string): {
    domain: string;
    version: string;
    scope_applied?: {
      scope: string;
      valueCents: string;
      filter_field: string;
    };
    stores: Array<{
      store_id: string;
      name: string;
      template_id: string;
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
          store_id: 'store-001',
          name: 'Supermercado Central',
          template_id: 'supermarket',
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
          store_id: 'store-002',
          name: 'Farmácia Saúde',
          template_id: 'pharmacy',
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
          store_id: 'store-003',
          name: 'Materiais Construção Ltda',
          template_id: 'construction',
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
          store_id: 'store-004',
          name: 'Loja Variedades',
          template_id: 'general_store',
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
          store_id: 'store-005',
          name: 'Anúncios Classificados',
          template_id: 'marketplace_listing',
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

    // Se scope e value foram fornecidos, aplicar filtro declarativo
    if (scope && value) {
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
                return branch.city.toLowerCase() === value.toLowerCase();
              }
              return false;
            }),
          })).filter(store => store.branches.length > 0); // Remover lojas sem branches após filtro
          
          return {
            domain: 'marketplace',
            version: 'v0',
            scope_applied: {
              scope,
              value,
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
    store_id: string;
    name: string;
    template_id: string;
    categories: Array<{
      id: string;
      name: string;
    }>;
  } | null {
    // Buscar a loja
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.store_id === storeId);
    
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
        if (cat.templates.includes(store.template_id)) {
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
      store_id: store.store_id,
      name: store.name,
      template_id: store.template_id,
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
      category_id: string;
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
          category_id: 'food-beverages-packaged',
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
          category_id: 'food-beverages-packaged',
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
          category_id: 'food-beverages-beverages',
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
          category_id: 'food-beverages-fresh',
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
          category_id: 'health-beauty-medicines',
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
          category_id: 'health-beauty-personal-care',
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
          category_id: 'health-beauty-vitamins',
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
          category_id: 'home-construction-materials',
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
          category_id: 'home-construction-tools',
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
          category_id: 'home-construction-home-decor',
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
          category_id: 'electronics-mobile',
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
          category_id: 'electronics-computers',
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
          category_id: 'clothing-accessories-men',
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
          category_id: 'clothing-accessories-women',
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
          category_id: 'sports-leisure-soccer',
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
          category_id: 'sports-leisure-footwear',
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
          category_id: 'books-media-books',
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
          category_id: 'automotive-parts',
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
   * Retorna produtos canônicos ativados para uma loja específica
   * READ-ONLY, in-memory, sem preço ou estoque ainda
   * Separa Produto Canônico de Oferta da Loja
   */
  getStoreProducts(storeId: string, categoryId?: string): {
    domain: string;
    version: string;
    store_id: string;
      products: Array<{
      product_id: string;
      name: string;
      description: string;
      category_id: string;
      attributes: Record<string, any>;
      images: string[];
      isEnabled: boolean;
      price: {
        amountCents: number;
        currency: string;
      } | null;
      stock: {
        quantity: number;
        unit: string;
      } | null;
      // Produtos industriais (dropship)
      industry_id?: string;
      hub_id?: string;
      is_industrial?: boolean;
    }>;
  } | null {
    // Verificar se a loja existe
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.store_id === storeId);
    
    if (!store) {
      return null;
    }

    // Buscar produtos canônicos
    const canonicalProducts = this.getCanonicalProducts();
    
    // Dados de ativação de produtos por loja (in-memory)
    // Estrutura: store_id -> product_id -> { isEnabled, price, stock }
    const storeProductActivations: Record<string, Record<string, {
      isEnabled: boolean;
      price: { amountCents: number; currency: string } | null;
      stock: { quantity: number; unit: string } | null;
    }>> = {
      'store-001': {
        'product-001': { // Arroz
          isEnabled: true,
          price: { amountCents: 24.90, currency: 'BRL' },
          stock: { quantity: 50, unit: 'pacote' },
        },
        'product-002': { // Feijão
          isEnabled: true,
          price: { amountCents: 8.50, currency: 'BRL' },
          stock: { quantity: 30, unit: 'pacote' },
        },
        'product-003': { // Água
          isEnabled: true,
          price: { amountCents: 2.50, currency: 'BRL' },
          stock: { quantity: 0, unit: 'garrafa' }, // Indisponível
        },
        'product-004': { // Leite
          isEnabled: true,
          price: { amountCents: 5.90, currency: 'BRL' },
          stock: { quantity: 20, unit: 'caixa' },
        },
      },
      'store-002': {
        'product-005': { // Paracetamol
          isEnabled: true,
          price: { amountCents: 12.90, currency: 'BRL' },
          stock: { quantity: 15, unit: 'caixa' },
        },
        'product-006': { // Shampoo
          isEnabled: true,
          price: { amountCents: 18.50, currency: 'BRL' },
          stock: { quantity: 25, unit: 'frasco' },
        },
        'product-007': { // Vitamina C
          isEnabled: true,
          price: { amountCents: 35.90, currency: 'BRL' },
          stock: { quantity: 0, unit: 'frasco' }, // Indisponível
        },
      },
      'store-003': {
        'product-008': { // Cimento
          isEnabled: true,
          price: { amountCents: 28.90, currency: 'BRL' },
          stock: { quantity: 100, unit: 'saco' },
        },
        'product-009': { // Martelo
          isEnabled: true,
          price: { amountCents: 45.00, currency: 'BRL' },
          stock: { quantity: 8, unit: 'unidade' },
        },
        'product-010': { // Tinta
          isEnabled: true,
          price: null, // Preço não definido ainda
          stock: { quantity: 5, unit: 'balde' },
        },
      },
    };

    // Obter produtos ativados para esta loja
    const storeActivations = storeProductActivations[storeId] || {};
    
    // Filtrar produtos canônicos que estão ativados
    let filteredProducts = canonicalProducts.products.filter(product => 
      storeActivations[product.id]?.isEnabled === true
    );

    // Aplicar filtro por categoria se fornecido
    if (categoryId) {
      filteredProducts = filteredProducts.filter(product => 
        product.category_id === categoryId
      );
    }

    // Mapear para formato de StoreProduct com price e stock
    const storeProducts = filteredProducts.map(product => {
      const activation = storeActivations[product.id];
      return {
        product_id: product.id,
        name: product.name,
        description: product.description,
        category_id: product.category_id,
        attributes: product.attributes,
        images: product.images,
        isEnabled: activation?.isEnabled || false,
        price: activation?.price || null,
        stock: activation?.stock || null,
        industry_id: (activation as any)?.industry_id,
        hub_id: (activation as any)?.hub_id,
        is_industrial: !!(activation as any)?.industry_id, // Flag para identificação rápida
      };
    });

    return {
      domain: 'marketplace',
      version: 'v0',
      store_id: storeId,
      products: storeProducts,
    };
  }

  /**
   * Pedidos do Marketplace (in-memory, temporários)
   * Armazena pedidos em memória sem persistência
   */
  private orders: Map<string, {
    order_id: string;
    store_id: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    customer_id?: string;
    items: Array<{
      product_id: string;
      name: string;
      price: {
        amountCents: number;
        currency: string;
      };
      quantity: number;
      subtotal: number;
    }>;
    totalCents: number;
  }> = new Map();

  /**
   * Clientes da Loja (in-memory)
   */
  private storeCustomers: Map<string, {
    customer_id: string;
    store_id: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  }> = new Map();

  /**
   * Criar novo pedido vazio (online)
   */
  createOrder(storeId: string): {
    order_id: string;
    store_id: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    items: never[];
    totalCents: number;
  } {
    // Verificar se a loja existe
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.store_id === storeId);
    
    if (!store) {
      throw new Error('Loja não encontrada');
    }

    // Gerar ID único para o pedido
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const order = {
      order_id: orderId,
      store_id: storeId,
      channel: 'online' as const,
      origin: 'marketplace' as const,
      items: [],
      totalCents: 0,
    };
    
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * Criar pedido físico (PDV)
   * Não exige checkout público, não exige attribution
   */
  createPhysicalOrder(input: {
    store_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
    }>;
    customer_id?: string;
  }): {
    order_id: string;
    store_id: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    customer_id?: string;
    items: Array<{
      product_id: string;
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
    // Verificar se a loja existe
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.store_id === input.store_id);
    
    if (!store) {
      throw new Error('Loja não encontrada');
    }

    // Gerar ID único para o pedido
    const orderId = `pdv-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Buscar produtos da loja
    const storeProducts = this.getStoreProducts(input.store_id);
    
    if (!storeProducts) {
      throw new Error('Loja não encontrada');
    }

    // Validar e processar itens
    const items: Array<{
      product_id: string;
      name: string;
      price: {
        amountCents: number;
        currency: string;
      };
      quantity: number;
      subtotal: number;
    }> = [];

    for (const inputItem of input.items) {
      const product = storeProducts.products.find(p => p.product_id === inputItem.product_id);
      
      if (!product) {
        throw new Error(`Produto ${inputItem.product_id} não encontrado nesta loja`);
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
      const isIndustrial = product.is_industrial || product.industry_id;
      
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

      const subtotal = product.price.amount * inputItem.quantity;
      
      items.push({
        product_id: product.product_id,
        name: product.name,
        price: product.price,
        quantity: inputItem.quantity,
        subtotal,
      });
    }

    const totalCents = items.reduce((sum, item) => sum + item.subtotal, 0);

    const order = {
      order_id: orderId,
      store_id: input.store_id,
      channel: 'physical' as const,
      origin: 'store_pdv' as const,
      customer_id: input.customer_id,
      items,
      totalCents,
    };
    
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * Criar ou buscar cliente da loja
   */
  createStoreCustomer(input: {
    store_id: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
  }): {
    customer_id: string;
    store_id: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } {
    // Verificar se já existe cliente com mesmo phone ou linked_user_id
    let existingCustomer = Array.from(this.storeCustomers.values()).find(
      c => c.store_id === input.store_id && (
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
      store_id: input.store_id,
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
    store_id: string;
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
  addOrderItem(orderId: string, productId: string, quantity: number): Order {
    const order = this.orders.get(orderId);
    
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Validações
    if (quantity < 1) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    // Buscar produto da loja
    const storeProducts = this.getStoreProducts(order.store_id);
    
    if (!storeProducts) {
      throw new Error('Loja não encontrada');
    }

    const product = storeProducts.products.find(p => p.product_id === productId);
    
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
    const isIndustrial = product.is_industrial || product.industry_id;
    
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

    // Verificar se produto já está no pedido
    const existingItemIndex = order.items.findIndex(item => item.product_id === productId);
    
    if (existingItemIndex >= 0) {
      // Atualizar quantidade do item existente
      const existingItem = order.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      // Validar estoque apenas para produtos retail
      if (!isIndustrial && product.stock && product.stock.quantity < newQuantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock.quantity}, solicitado: ${newQuantity}`);
      }
      
      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.price.amount * existingItem.quantity;
    } else {
      // Adicionar novo item
      const subtotal = product.price.amount * quantity;
      
      order.items.push({
        product_id: productId,
        name: product.name,
        price: product.price,
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
   * CheckoutIntent do Marketplace
   * Preparação para pagamento multi-loja, split e B2B
   * DECLARATIVO - NÃO executa pagamento, NÃO move dinheiro
   */
  private checkouts: Map<string, CheckoutIntent> = new Map();

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

    // Agrupar itens por store_id
    // Como o Order atual tem apenas uma loja, todos os itens pertencem à mesma loja
    // Mas a estrutura permite múltiplas lojas no futuro
    const storeGroups = new Map<string, Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>>();

    order.items.forEach(item => {
      const storeId = order.store_id;
      if (!storeGroups.has(storeId)) {
        storeGroups.set(storeId, []);
      }
      
      const unitPrice = item.price.amount;
      storeGroups.get(storeId)!.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: item.subtotal,
      });
    });

    // Criar estrutura de orders agrupadas por loja
    const checkoutOrders = Array.from(storeGroups.entries()).map(([storeId, items]) => {
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      return {
        store_id: storeId,
        items,
        subtotal,
      };
    });

    // Calcular total geral
    const totalCents = checkoutOrders.reduce((sum, order) => sum + order.subtotal, 0);

    const checkout = {
      checkout_id: checkoutId,
      orders: checkoutOrders,
      totalCents,
      payment_options: {
        allow_balance: true,
        allow_card: true,
        allow_invoice: true, // B2B faturamento
      },
      status: 'open' as const,
      attribution_id: attributionId as string | undefined, // Será preenchido se vier de share
    };

    this.checkouts.set(checkoutId, checkout);
    
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
   * Payment Orchestrator - PaymentPlan
   * Calcula splits e atribuições sem executar pagamento
   * DECLARATIVO - NÃO executa pagamento, NÃO move dinheiro
   */
  private paymentPlans: Map<string, PaymentPlan> = new Map();

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
          actor_id: order.store_id,
          action: 'invoice',
          amountCents: order.subtotal,
        });
      }
    }

    // Validar método de pagamento permitido
    if (method === 'balance' && !checkout.payment_options.allow_balance) {
      throw new Error('Método de pagamento "balance" não permitido');
    }
    if (method === 'card' && !checkout.payment_options.allow_card) {
      throw new Error('Método de pagamento "card" não permitido');
    }
    if (method === 'invoice' && !checkout.payment_options.allow_invoice) {
      throw new Error('Método de pagamento "invoice" não permitido');
    }

    // Gerar ID único para o payment plan
    const paymentPlanId = `payment-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 🔴 CORREÇÃO INSTITUCIONAL: Removido cálculo inline de splits
    // Splits são calculados EXCLUSIVAMENTE via bank-split-engine.service.ts
    // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seções 12.1 e 12.3)
    // e FEATURE_MARKETPLACE_MULTI_VENDOR.md (invariantes institucionais)
    
    // Verificar se checkout tem attribution_id (vem de share)
    const attributionId = (checkout as any).attribution_id;
    let attribution = null;
    if (attributionId) {
      attribution = this.getAttribution(attributionId);
    }

    // PaymentPlan agora é apenas declarativo (sem splits calculados)
    // Splits serão calculados em executePaymentPlan via engine canônico
    const paymentPlan = {
      payment_plan_id: paymentPlanId,
      checkout_id: checkoutId,
      method,
      totalCents: checkout.totalCents,
      splits: [], // Splits serão calculados via engine canônico em executePaymentPlan
      status: 'calculated' as const,
      attribution_id: attributionId || undefined, // Preservar attribution para uso posterior
    };

    this.paymentPlans.set(paymentPlanId, paymentPlan);

    // Se for serviço, criar payment hold
    // Verificar se checkout contém serviços (ServiceOrder)
    let isServiceCheckout = false;
    let serviceRequestId: string | null = null;
    
    for (const checkoutOrder of checkout.orders) {
      // Buscar order pelo ID (checkoutOrder.order_id é o order_id)
      const order = this.orders.get(checkoutOrder.order_id);
      if (order) {
        // Verificar se order tem ServiceOrder relacionado
        const serviceOrder = Array.from(this.serviceOrders.values())
          .find(so => so.order_id === order.order_id);
        
        if (serviceOrder) {
          isServiceCheckout = true;
          // Buscar request relacionado (via booking)
          const booking = this.serviceBookings.get(serviceOrder.booking_id);
          if (booking) {
            // Buscar request via dispatch ou pre-reservation
            const dispatch = Array.from(this.serviceDispatches.values())
              .find(d => {
                const preReservations = this.getPreReservationsByDispatch(d.dispatch_id);
                return preReservations.some(pr => 
                  pr.offering_id === serviceOrder.offering_id &&
                  pr.date === booking.date &&
                  pr.time === booking.time
                );
              });
            if (dispatch) {
              serviceRequestId = dispatch.request_id;
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
        hold_id: hold.hold_id,
        request_id: serviceRequestId,
        payment_plan_id: paymentPlanId,
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
  ): Promise<{
    payment_plan_id: string;
    checkout_id: string;
    method: 'balance' | 'card' | 'invoice';
    totalCents: number;
    splits: Array<{
      type: 'seller' | 'platform' | 'affiliate' | 'regional_fund';
      target_id: string;
      amountCents: number;
      currency: string;
    }>;
    status: 'calculated' | 'executed';
    ledgerEntries?: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
    invoiceId?: string;
  }> {
    const paymentPlan = this.paymentPlans.get(paymentPlanId);
    
    if (!paymentPlan) {
      throw new Error('Payment plan não encontrado');
    }

    if (paymentPlan.status === 'executed') {
      throw new Error('Payment plan já foi executado');
    }

    // Não bloquear 'card' aqui - será tratado abaixo

    // Importar dependências do UnifyBank
    const { bankPortsRegistry } = await import('@core/bank/ports-registry');
    const { v4: uuidv4 } = await import('uuid');
    const bankAccount = bankPortsRegistry.getBankAccount();
    const bankTransaction = bankPortsRegistry.getBankTransaction();

    // Gerar eventId único para idempotência
    const eventId = `marketplace-payment-${paymentPlanId}-${Date.now()}`;

    if (paymentPlan.method === 'balance') {
      // Executar pagamento com saldo
      // 1. Obter conta do comprador
      const buyerAccount = await bankAccount.getOrCreateAccount(tenantId, {
        ownerId: userId,
        ownerType: 'user',
        currency: 'BRL',
      });

      // 2. Validar saldo
      const buyerBalance = await bankAccount.getBalance(tenantId, buyerAccount.accountId);
      if (buyerBalance.balance < paymentPlan.totalCents) {
        throw new Error(`Saldo insuficiente. Disponível: ${buyerBalance.balance}, Necessário: ${paymentPlan.totalCents}`);
      }

      // 🔴 CORREÇÃO INSTITUCIONAL: Usar engine canônico de split
      // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seções 12.1 e 12.3)
      // e FEATURE_MARKETPLACE_MULTI_VENDOR.md (invariantes institucionais)
      
      // 3. Obter checkout para acessar orders
      const checkout = this.checkouts.get(paymentPlan.checkout_id);
      if (!checkout) {
        throw new Error('Checkout não encontrado');
      }

      // 🔴 CORREÇÃO INSTITUCIONAL: Usar API canônica do Core
      // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seção 12.3)
      // PROIBIDO: criar splits diretamente em bank_splits ou ledger diretamente
      // OBRIGATÓRIO: usar bankTransactionService.createTransactionWithSplit()
      
      // 4. Resolver actor do comprador para autoria
      const { actorRepository } = await import('@modules/social/actor.repository');
      const buyerActor = await actorRepository.findOrCreateUserActor(tenantId, userId);

      // Construir autoria (ownership: comprador é dono da conta origem)
      const { buildFinancialAuthorshipFromRequest } = await import('@modules/bank/financial-authorship.helper');
      const { authorizationService } = await import('@core/authorization/authorization.service');
      
      // Verificar permissão e criar snapshot
      const authResult = await authorizationService.canActAs(
        tenantId,
        userId,
        buyerActor.actor_id,
        'marketplace_execute_payments'
      );
      
      const authorship = buildFinancialAuthorshipFromRequest({
        performedByUserId: userId,
        actingForActorId: buyerActor.actor_id,
        actingForAccountId: buyerAccount.accountId,
        authoritySource: 'ownership', // Comprador é dono da conta origem
        permissionSnapshot: {
          permissionKey: 'marketplace_execute_payments',
          allowed: authResult.allowed,
          reason: authResult.reason,
          actorId: buyerActor.actor_id,
          userId: userId,
          decidedAt: new Date().toISOString(),
        },
      });

      // 5. Para cada store_id no checkout, criar transação via Core canônico
      // Cada store gera uma transação separada com splits automáticos via createTransactionWithSplit
      const { bankTransactionService } = await import('@modules/bank/bank-transaction.service');
      const allLedgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];
      const consolidatedSplits = new Map<string, {
        splitType: string;
        targetAccountId: string;
        amountCents: number;
        percentage?: number;
        metadata?: Record<string, any>;
      }>();

      for (const checkoutOrder of checkout.orders) {
        const storeSubtotal = checkoutOrder.subtotal;
        const storeId = checkoutOrder.store_id;
        const orderId = checkoutOrder.order_id;

        // Resolver conta do vendedor (store)
        const storeAccount = await bankAccount.getOrCreateAccount(tenantId, {
          ownerId: storeId,
          ownerType: 'company',
          currency: 'BRL',
        });

        // Buscar informações da loja para metadata (cidade, estado, etc.)
        const storesData = this.getStores();
        const store = storesData.stores.find(s => s.store_id === storeId);
        let cityId: string | undefined;
        let state: string | undefined;
        if (store && store.branches && store.branches.length > 0) {
          const branch = store.branches[0];
          cityId = branch.location?.city;
          state = branch.location?.state;
        }

          // Criar transação via Core canônico (cria transação, calcula splits, persiste splits e ledger)
          // NOTA: Usando 'service_booking' como contexto (não há contexto específico para marketplace)
          // O engine canônico resolve splits baseado em policies hierárquicas via metadata
          const transactionResult = await bankTransactionService.createTransactionWithSplit(tenantId, {
            eventId: `${eventId}-store-${storeId}`,
            fromAccountId: buyerAccount.accountId,
            amountCents: storeSubtotal,
            currency: 'BRL',
            context: 'service_booking', // Contexto válido (splits são resolvidos via policies/metadata)
            revenueShareAccountId: storeAccount.accountId, // Conta do vendedor
            fromUserId: userId, // Para referral e group allocation
            description: `Marketplace payment: ${paymentPlan.checkout_id} - Store ${storeId}`,
            metadata: {
              type: 'marketplace_payment',
              payment_plan_id: paymentPlanId,
              checkout_id: paymentPlan.checkout_id,
              store_id: storeId,
              order_id: orderId,
              cityId,
              state,
            },
            authorship,
          });

        // Consolidar splits por tipo e conta destino (para retorno compatível)
        for (const split of transactionResult.splits) {
          const key = `${split.splitType}_${split.targetAccountId}`;
          if (consolidatedSplits.has(key)) {
            consolidatedSplits.get(key)!.amount += split.amount;
          } else {
            consolidatedSplits.set(key, {
              splitType: split.splitType,
              targetAccountId: split.targetAccountId,
              amountCents: split.amount,
              percentage: split.percentage || undefined,
              metadata: {
                store_id: storeId,
                checkout_id: paymentPlan.checkout_id,
                order_id: orderId,
              },
            });
          }
        }

        // Consolidar ledger entries
        allLedgerEntries.push(...transactionResult.ledgerEntries);
      }

      // 6. Marcar payment plan como executado
      paymentPlan.status = 'executed';
      // Atualizar splits calculados via Core canônico
      paymentPlan.splits = Array.from(consolidatedSplits.values()).map(split => ({
        type: split.splitType === 'revenue_share' ? 'seller' : 
              split.splitType === 'fee' ? 'platform' :
              split.splitType === 'regional_fund' ? 'regional_fund' :
              split.splitType === 'referral' ? 'affiliate' : 'affiliate',
        target_id: split.metadata?.store_id || split.targetAccountId,
        amountCents: split.amount,
        currency: 'BRL',
      }));
      this.paymentPlans.set(paymentPlanId, paymentPlan);

      // 7. Marcar checkout como pago (adicionar campo 'paid' ao checkout)
      const checkoutFinal = this.checkouts.get(paymentPlan.checkout_id);
      if (checkoutFinal) {
        // Adicionar campo 'paid' ao checkout (extensão do contrato)
        (checkoutFinal as any).paid = true;
        (checkoutFinal as any).paidAt = new Date().toISOString();
        this.checkouts.set(paymentPlan.checkout_id, checkoutFinal);
      }

      return {
        ...paymentPlan,
        ledgerEntries: allLedgerEntries,
      };
    } else if (paymentPlan.method === 'invoice') {
      // Criar registro de fatura (B2B)
      // NÃO debitar agora, apenas criar registro
      const invoiceId = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Criar transação com status 'pending'
      const invoiceTransaction = await bankTransaction.createSimpleTransaction(tenantId, {
        eventId: `${eventId}-invoice`,
        fromAccountId: null, // Não debitar agora
        toAccountId: null, // Será creditado quando fatura for paga
        amountCents: paymentPlan.totalCents,
        currency: 'BRL',
        transactionType: 'transfer', // Tipo válido para fatura pendente
        description: `Marketplace invoice: ${paymentPlan.checkout_id}`,
        metadata: {
          type: 'marketplace_invoice',
          payment_plan_id: paymentPlanId,
          checkout_id: paymentPlan.checkout_id,
          invoice_id: invoiceId,
          due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
        },
      });

      // Marcar payment plan como executado com campos B2B
      const issuedAt = new Date().toISOString();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
      paymentPlan.status = 'executed';
      paymentPlan.issuedAt = issuedAt;
      paymentPlan.due_at = dueDate;
      paymentPlan.paidAt = undefined; // Será preenchido quando fatura for paga
      this.paymentPlans.set(paymentPlanId, paymentPlan);

      // Marcar checkout como faturado
      const checkout = this.checkouts.get(paymentPlan.checkout_id);
      if (checkout) {
        (checkout as any).invoiced = true;
        (checkout as any).invoice_id = invoiceId;
        (checkout as any).invoicedAt = issuedAt;
        this.checkouts.set(paymentPlan.checkout_id, checkout);
      }

      return {
        ...paymentPlan,
        invoiceId,
        ledgerEntries: invoiceTransaction.ledgerEntries,
      };
    } else if (paymentPlan.method === 'card') {
      // Executar pagamento com cartão (externo)
      // 1. Criar cobrança externa via adapter
      const { mockExternalPaymentProvider } = await import('./external-payment-provider.mock');
      const externalProvider = mockExternalPaymentProvider;

      if (!externalProvider.isAvailable()) {
        throw new Error('Provedor de pagamento externo não está disponível');
      }

      let externalChargeResult;
      try {
        externalChargeResult = await externalProvider.createCharge({
          amountCents: paymentPlan.totalCents,
          currency: 'BRL',
          metadata: {
            payment_plan_id: paymentPlanId,
            checkout_id: paymentPlan.checkout_id,
            method: 'card',
          },
        });
      } catch (error: any) {
        // Falha externa NÃO gera ledger
        throw new Error(`Pagamento externo falhou: ${error.message}`);
      }

      // 🔴 CORREÇÃO INSTITUCIONAL: Usar API canônica do Core
      // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seção 12.3)
      // PROIBIDO: criar transações/ledger diretamente
      // OBRIGATÓRIO: usar bankTransactionService.createSimpleTransaction() e createTransactionWithSplit()
      
      // 2. Se sucesso, registrar entrada de dinheiro na conta da plataforma via Core canônico
      const { bankTransactionService } = await import('@modules/bank/bank-transaction.service');
      
      // Obter conta da plataforma (onde o dinheiro externo entra)
      const platformAccount = await bankAccount.getSystemAccount(tenantId, 'fee', 'BRL');
      if (!platformAccount) {
        throw new Error('Conta da plataforma não encontrada');
      }

      // Resolver actor do comprador para autoria
      const { actorRepository } = await import('@modules/social/actor.repository');
      const buyerActor = await actorRepository.findOrCreateUserActor(tenantId, userId);

      // Construir autoria (ownership: comprador é dono da conta origem)
      const { buildFinancialAuthorshipFromRequest } = await import('@modules/bank/financial-authorship.helper');
      const { authorizationService } = await import('@core/authorization/authorization.service');
      
      // Verificar permissão e criar snapshot
      const authResult = await authorizationService.canActAs(
        tenantId,
        userId,
        buyerActor.actor_id,
        'marketplace_execute_payments'
      );
      
      const authorship = buildFinancialAuthorshipFromRequest({
        performedByUserId: userId,
        actingForActorId: buyerActor.actor_id,
        actingForAccountId: platformAccount.accountId,
        authoritySource: 'ownership',
        permissionSnapshot: {
          permissionKey: 'marketplace_execute_payments',
          allowed: authResult.allowed,
          reason: authResult.reason,
          actorId: buyerActor.actor_id,
          userId: userId,
          decidedAt: new Date().toISOString(),
        },
      });

      // Criar transação de external inflow via Core canônico (sem split, apenas registro)
      const externalInflowTransaction = await bankTransactionService.createSimpleTransaction(tenantId, {
        eventId: `${eventId}-external-inflow`,
        fromAccountId: undefined, // External inflow não tem origem interna
        toAccountId: platformAccount.accountId,
        amountCents: paymentPlan.totalCents,
        currency: 'BRL',
        transactionType: 'deposit', // Tipo válido para external inflow
        description: `Marketplace external payment (card): ${paymentPlan.checkout_id}`,
        metadata: {
          type: 'marketplace_external_payment',
          payment_plan_id: paymentPlanId,
          checkout_id: paymentPlan.checkout_id,
          external_payment_id: externalChargeResult.external_payment_id,
          method: 'card',
        },
        authorship,
      });

      const allLedgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];
      allLedgerEntries.push(...externalInflowTransaction.ledgerEntries);

        // 3. Obter checkout para acessar orders
        const checkout = this.checkouts.get(paymentPlan.checkout_id);
        if (!checkout) {
          throw new Error('Checkout não encontrado');
        }

        // 4. Para cada store_id no checkout, criar transação via Core canônico
        // Dinheiro entrou na plataforma, agora distribuir via createTransactionWithSplit
        // Cada store gera uma transação separada com splits automáticos
        const consolidatedSplits = new Map<string, {
          splitType: string;
          targetAccountId: string;
          amountCents: number;
          percentage?: number;
          metadata?: Record<string, any>;
        }>();

        for (const checkoutOrder of checkout.orders) {
          const storeSubtotal = checkoutOrder.subtotal;
          const storeId = checkoutOrder.store_id;
          const orderId = checkoutOrder.order_id;

          // Resolver conta do vendedor (store)
          const storeAccount = await bankAccount.getOrCreateAccount(tenantId, {
            ownerId: storeId,
            ownerType: 'company',
            currency: 'BRL',
          });

          // Buscar informações da loja para metadata (cidade, estado, etc.)
          const storesData = this.getStores();
          const store = storesData.stores.find(s => s.store_id === storeId);
          let cityId: string | undefined;
          let state: string | undefined;
          if (store && store.branches && store.branches.length > 0) {
            const branch = store.branches[0];
            cityId = branch.location?.city;
            state = branch.location?.state;
          }

          // Criar transação via Core canônico (origem: plataforma, destino: store com splits)
          // Isso cria débito na plataforma e créditos nos destinos (seller, fee, regional_fund, etc.)
          // NOTA: Usando 'service_booking' como contexto (não há contexto específico para marketplace)
          // O engine canônico resolve splits baseado em policies hierárquicas via metadata
          const transactionResult = await bankTransactionService.createTransactionWithSplit(tenantId, {
            eventId: `${eventId}-store-${storeId}`,
            fromAccountId: platformAccount.accountId, // Origem: conta da plataforma
            amountCents: storeSubtotal,
            currency: 'BRL',
            context: 'service_booking', // Contexto válido (splits são resolvidos via policies/metadata)
            revenueShareAccountId: storeAccount.accountId, // Conta do vendedor
            fromUserId: userId, // Para referral e group allocation
            description: `Marketplace payment (card): ${paymentPlan.checkout_id} - Store ${storeId}`,
            metadata: {
              type: 'marketplace_payment',
              payment_plan_id: paymentPlanId,
              checkout_id: paymentPlan.checkout_id,
              store_id: storeId,
              order_id: orderId,
              cityId,
              state,
              external_payment_id: externalChargeResult.external_payment_id,
              method: 'card',
            },
            authorship,
          });

          // Consolidar splits por tipo e conta destino (para retorno compatível)
          for (const split of transactionResult.splits) {
            const key = `${split.splitType}_${split.targetAccountId}`;
            if (consolidatedSplits.has(key)) {
              consolidatedSplits.get(key)!.amount += split.amount;
            } else {
              consolidatedSplits.set(key, {
                splitType: split.splitType,
                targetAccountId: split.targetAccountId,
                amountCents: split.amount,
                percentage: split.percentage || undefined,
                metadata: {
                  store_id: storeId,
                  checkout_id: paymentPlan.checkout_id,
                  order_id: orderId,
                  external_payment_id: externalChargeResult.external_payment_id,
                },
              });
            }
          }

          // Consolidar ledger entries (incluir todas as entradas da transação)
          allLedgerEntries.push(...transactionResult.ledgerEntries);
        }

      // 5. Marcar payment plan como executado
      paymentPlan.status = 'executed';
      // Atualizar splits calculados via Core canônico
      paymentPlan.splits = Array.from(consolidatedSplits.values()).map(split => ({
        type: split.splitType === 'revenue_share' ? 'seller' : 
              split.splitType === 'fee' ? 'platform' :
              split.splitType === 'regional_fund' ? 'regional_fund' :
              split.splitType === 'referral' ? 'affiliate' : 'affiliate',
        target_id: split.metadata?.store_id || split.targetAccountId,
        amountCents: split.amount,
        currency: 'BRL',
      }));
      this.paymentPlans.set(paymentPlanId, paymentPlan);

      // 6. Marcar checkout como pago
      const checkoutFinal = this.checkouts.get(paymentPlan.checkout_id);
      if (checkoutFinal) {
        (checkoutFinal as any).paid = true;
        (checkoutFinal as any).paidAt = new Date().toISOString();
        (checkoutFinal as any).external_payment_id = externalChargeResult.external_payment_id;
        this.checkouts.set(paymentPlan.checkout_id, checkoutFinal);
      }

      return {
        ...paymentPlan,
        ledgerEntries: allLedgerEntries,
      };
    } else {
      throw new Error(`Método de pagamento não suportado: ${paymentPlan.method}`);
    }
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
      default_vehicle: 'bike' | 'moto' | 'car' | 'van';
      cost_payer: 'seller' | 'buyer' | 'platform';
      base_cost: number;
      eta_minutes: number;
    }> = {
      'store-001': {
        type: 'own',
        vehicles: ['bike', 'moto'],
        default_vehicle: 'bike',
        cost_payer: 'buyer',
        base_cost: 5.00,
        eta_minutes: 30,
      },
      'store-002': {
        type: 'third_party',
        vehicles: ['car', 'van'],
        default_vehicle: 'car',
        cost_payer: 'seller',
        base_cost: 8.50,
        eta_minutes: 45,
      },
      'store-003': {
        type: 'own',
        vehicles: ['moto', 'car'],
        default_vehicle: 'moto',
        cost_payer: 'platform',
        base_cost: 0.00, // Frete grátis
        eta_minutes: 25,
      },
    };

    const deliveries: Array<{
      delivery_id: string;
      checkout_id: string;
      store_id: string;
      type: 'own' | 'third_party';
      vehicle: 'bike' | 'moto' | 'car' | 'van';
      eta_minutes: number;
      cost: {
        amountCents: number;
        currency: string;
        payer: 'seller' | 'buyer' | 'platform';
      };
      status: 'created' | 'assigned' | 'in_transit' | 'delivered';
    }> = [];

    // Criar um delivery por store_id
    for (const order of checkout.orders) {
      const storeId = order.store_id;
      const preferences = storeDeliveryPreferences[storeId] || {
        type: 'third_party' as const,
        vehicles: ['car'] as const,
        default_vehicle: 'car' as const,
        cost_payer: 'buyer' as const,
        base_cost: 10.00,
        eta_minutes: 60,
      };

      const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${storeId}`;

      const delivery = {
        delivery_id: deliveryId,
        checkout_id: checkoutId,
        store_id: storeId,
        type: preferences.type,
        vehicle: preferences.default_vehicle,
        eta_minutes: preferences.eta_minutes,
        cost: {
          amountCents: preferences.base_cost,
          currency: 'BRL',
          payer: preferences.cost_payer,
        },
        status: 'created' as const,
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
      store_id: string;
      name: string;
      template_id: string;
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
      filteredStores = filteredStores.filter(store => store.template_id === template_id);
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
        isCategoryCompatible(category_id, store.template_id)
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
        store_id: store.store_id,
        name: store.name,
        template_id: store.template_id,
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
   * Buscar deliveries por checkout_id
   */
  getDeliveriesByCheckout(checkoutId: string): Array<{
    delivery_id: string;
    checkout_id: string;
    store_id: string;
    type: 'own' | 'third_party';
    vehicle: 'bike' | 'moto' | 'car' | 'van';
    eta_minutes: number;
    cost: {
      amountCents: number;
      currency: string;
      payer: 'seller' | 'buyer' | 'platform';
    };
    status: 'created' | 'assigned' | 'in_transit' | 'delivered';
  }> {
    return Array.from(this.deliveries.values()).filter(d => d.checkout_id === checkoutId);
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
      template_id: string;
      name: string;
      description: string;
      category_id: string;
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
          template_id: 'gym-session',
          name: 'Aula de Academia',
          description: 'Aula individual ou em grupo na academia',
          category_id: 'fitness',
          type: 'session',
          default_duration_minutes: 60,
          pricing_model: 'per_session',
        },
        {
          template_id: 'consultation',
          name: 'Consulta',
          description: 'Consulta profissional (médica, jurídica, etc.)',
          category_id: 'professional',
          type: 'session',
          default_duration_minutes: 30,
          pricing_model: 'per_session',
        },
        {
          template_id: 'property-rental',
          name: 'Aluguel de Imóvel',
          description: 'Aluguel de imóvel residencial ou comercial',
          category_id: 'real-estate',
          type: 'rental',
          pricing_model: 'per_period',
        },
        {
          template_id: 'maintenance',
          name: 'Manutenção',
          description: 'Serviço de manutenção técnica',
          category_id: 'technical',
          type: 'session',
          default_duration_minutes: 120,
          pricing_model: 'per_session',
        },
        {
          template_id: 'haircut',
          name: 'Corte de Cabelo',
          description: 'Corte de cabelo no salão',
          category_id: 'beauty',
          type: 'session',
          default_duration_minutes: 45,
          pricing_model: 'per_session',
        },
        {
          template_id: 'cleaning',
          name: 'Limpeza',
          description: 'Serviço de limpeza residencial ou comercial',
          category_id: 'home-services',
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
    store_id: string;
    template_id: string;
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
    offering_id: string;
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
    store_id: string;
    offerings: Array<{
      offering_id: string;
      template_id: string;
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
      .filter(o => o.store_id === storeId && o.isActive)
      .map(o => {
        const template = this.getServiceTemplates().templates.find(t => t.template_id === o.template_id);
        return {
          offering_id: o.offering_id,
          template_id: o.template_id,
          name: template?.name || 'Serviço',
          description: template?.description || '',
          price: o.price,
          duration_minutes: o.duration_minutes || template?.default_duration_minutes,
          recurrence: o.recurrence,
          isActive: o.isActive,
        };
      });

    return {
      store_id: storeId,
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
    offering_id: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    quantity: number;
  }): {
    booking_id: string;
    offering_id: string;
    user_id: string;
    date: string;
    time: string;
    quantity: number;
    status: 'reserved' | 'confirmed' | 'cancelled';
    createdAt: string;
  } {
    // Validar que o serviço existe e está ativo
    const offering = this.serviceOfferings.get(input.offering_id);
    if (!offering || !offering.isActive) {
      throw new Error('Serviço não encontrado ou inativo');
    }

    // Validar disponibilidade
    const availability = this.getServiceAvailability(input.offering_id);
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
        b.offering_id === input.offering_id &&
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
      offering_id: input.offering_id,
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
    booking_id: string;
    order_id: string;
    offering_id: string;
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
    const offering = this.serviceOfferings.get(booking.offering_id);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    // Calcular preço total
    const totalPrice = offering.price.amount * booking.quantity;

    // Criar ServiceOrder
    const orderId = `service-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const serviceOrder = {
      order_id: orderId,
      booking_id: bookingId,
      offering_id: booking.offering_id,
      price: {
        amountCents: totalPrice,
        currency: offering.price.currency,
      },
      channel: 'online' as const,
      createdAt: new Date().toISOString(),
    };

    this.serviceOrders.set(orderId, serviceOrder);

    // Confirmar reserva
    booking.status = 'confirmed';
    this.serviceBookings.set(bookingId, booking);

    return {
      booking_id: bookingId,
      order_id: orderId,
      offering_id: booking.offering_id,
      price: serviceOrder.price,
    };
  }

  /**
   * Buscar reserva por ID
   */
  getServiceBooking(bookingId: string): {
    booking_id: string;
    offering_id: string;
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
    return Array.from(this.serviceOrders.values()).find(o => o.booking_id === bookingId) || null;
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
    order_id: string;
    store_id: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    items: Array<{
      product_id: string;
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
    const offering = this.serviceOfferings.get(serviceOrder.offering_id);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    const template = this.getServiceTemplates().templates.find(t => t.template_id === offering.template_id);
    const serviceName = template?.name || 'Serviço';

    // Buscar booking para obter quantidade
    const booking = this.serviceBookings.get(serviceOrder.booking_id);
    const quantity = booking?.quantity || 1;

    // Adicionar serviço como item ao pedido
    const subtotal = serviceOrder.price.amount * quantity;
    
    order.items.push({
      product_id: `service-${serviceOrder.offering_id}`, // ID especial para serviços
      name: serviceName,
      price: serviceOrder.price,
      quantity,
      subtotal,
    });

    // Recalcular total
    order.totalCents = order.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    this.orders.set(orderId, order);
    
    return {
      order_id: order.order_id,
      store_id: order.store_id,
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
      store_id: 'store-001',
      template_id: 'gym-session',
      price: { amountCents: 50.00, currency: 'BRL' },
      duration_minutes: 60,
      active: true,
    });

    const offering2Id = 'offering-002';
    this.serviceOfferings.set(offering2Id, {
      offering_id: offering2Id,
      store_id: 'store-001',
      template_id: 'consultation',
      price: { amountCents: 150.00, currency: 'BRL' },
      duration_minutes: 30,
      active: true,
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
      store_id: 'store-001',
      template_id: 'beauty-service',
      price: { amountCents: 30.00, currency: 'BRL' },
      duration_minutes: 60,
      active: true,
    });

    this.serviceOfferings.set(manicureOffering2Id, {
      offering_id: manicureOffering2Id,
      store_id: 'store-002',
      template_id: 'beauty-service',
      price: { amountCents: 35.00, currency: 'BRL' },
      duration_minutes: 60,
      active: true,
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
      store_id: 'store-001',
      template_id: 'cleaning-service',
      price: { amountCents: 150.00, currency: 'BRL' },
      duration_minutes: 120,
      active: true,
    });

    this.serviceOfferings.set(caixaAguaOfferingId, {
      offering_id: caixaAguaOfferingId,
      store_id: 'store-002',
      template_id: 'maintenance-service',
      price: { amountCents: 200.00, currency: 'BRL' },
      duration_minutes: 90,
      active: true,
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
  // SUBSCRIPTIONS (ASSINATURAS E RECORRÊNCIA)
  // ============================================================

  /**
   * Subscriptions (in-memory)
   * Armazena assinaturas ativas, pausadas e canceladas
   */
  private subscriptions: Map<string, Subscription> = new Map();

  /**
   * Subscription Cycles (in-memory)
   * Armazena ciclos de cobrança de cada assinatura
   */
  private subscriptionCycles: Map<string, SubscriptionCycle[]> = new Map();

  /**
   * Criar nova assinatura
   */
  createSubscription(input: {
    type: 'product' | 'service' | 'mixed';
    billing_cycle: 'weekly' | 'monthly' | 'yearly';
    starts_at: string;
    linked_entities: {
      products?: Array<{ product_id: string; store_id: string; quantity: number }>;
      service_offerings?: Array<{ offering_id: string; store_id: string; quantity: number }>;
    };
    customer_id: string;
    store_id: string;
    payment_method: 'balance' | 'card' | 'invoice';
    attribution_id?: string;
  }): Subscription {
    // Validar que a loja existe
    const storesData = this.getStores();
    const store = storesData.stores.find(s => s.store_id === input.store_id);
    if (!store) {
      throw new Error('Loja não encontrada');
    }

    // Validar produtos (se houver)
    if (input.linked_entities.products) {
      for (const productLink of input.linked_entities.products) {
        const storeProducts = this.getStoreProducts(productLink.store_id, undefined);
        const product = storeProducts?.products.find(p => p.product_id === productLink.product_id);
        if (!product || !product.isEnabled) {
          throw new Error(`Produto ${productLink.product_id} não encontrado ou inativo`);
        }
      }
    }

    // Validar serviços (se houver)
    if (input.linked_entities.service_offerings) {
      for (const serviceLink of input.linked_entities.service_offerings) {
        const offerings = this.getStoreServiceOfferings(serviceLink.store_id);
        const offering = offerings.offerings.find(o => o.offering_id === serviceLink.offering_id);
        if (!offering || !offering.isActive) {
          throw new Error(`Serviço ${serviceLink.offering_id} não encontrado ou inativo`);
        }
      }
    }

    const subscriptionId = `subscription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: Subscription = {
      subscription_id: subscriptionId,
      type: input.type,
      billing_cycle: input.billing_cycle,
      starts_at: input.starts_at,
      status: 'active',
      linked_entities: input.linked_entities,
      customer_id: input.customer_id,
      store_id: input.store_id,
      payment_method: input.payment_method,
      attribution_id: input.attribution_id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.subscriptionCycles.set(subscriptionId, []);

    marketplaceLogger.init('Subscription criada', { subscription_id: subscriptionId });

    return subscription;
  }

  /**
   * Buscar assinatura por ID
   */
  getSubscription(subscriptionId: string): Subscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Listar assinaturas de um cliente
   */
  getCustomerSubscriptions(customerId: string): Subscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.customer_id === customerId);
  }

  /**
   * Listar assinaturas de uma loja
   */
  getStoreSubscriptions(storeId: string): Subscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.store_id === storeId);
  }

  /**
   * Pausar assinatura (não retroativo)
   */
  pauseSubscription(subscriptionId: string): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    if (subscription.status !== 'active') {
      throw new Error(`Assinatura não pode ser pausada. Status atual: ${subscription.status}`);
    }

    subscription.status = 'paused';
    subscription.updatedAt = new Date().toISOString();

    marketplaceLogger.init('Subscription pausada', { subscription_id: subscriptionId });

    return subscription;
  }

  /**
   * Retomar assinatura pausada
   */
  resumeSubscription(subscriptionId: string): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    if (subscription.status !== 'paused') {
      throw new Error(`Assinatura não pode ser retomada. Status atual: ${subscription.status}`);
    }

    subscription.status = 'active';
    subscription.updatedAt = new Date().toISOString();

    marketplaceLogger.init('Subscription retomada', { subscription_id: subscriptionId });

    return subscription;
  }

  /**
   * Cancelar assinatura (não retroativo, apenas ciclos futuros)
   */
  cancelSubscription(subscriptionId: string): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    if (subscription.status === 'cancelled') {
      throw new Error('Assinatura já está cancelada');
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date().toISOString();
    subscription.updatedAt = new Date().toISOString();

    marketplaceLogger.init('Subscription cancelada', { subscription_id: subscriptionId });

    return subscription;
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
    payment_plan: PaymentPlan;
  }> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    if (subscription.status !== 'active') {
      throw new Error(`Assinatura não está ativa. Status: ${subscription.status}`);
    }

    // Calcular datas do ciclo baseado no billing_cycle
    const startDate = new Date(subscription.starts_at);
    const cycles = this.subscriptionCycles.get(subscriptionId) || [];
    const cycleNumber = cycles.length + 1;

    let cycleStartDate: Date;
    let cycleEndDate: Date;

    if (subscription.billing_cycle === 'weekly') {
      cycleStartDate = new Date(startDate);
      cycleStartDate.setDate(startDate.getDate() + (cycleNumber - 1) * 7);
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setDate(cycleStartDate.getDate() + 7);
    } else if (subscription.billing_cycle === 'monthly') {
      cycleStartDate = new Date(startDate);
      cycleStartDate.setMonth(startDate.getMonth() + (cycleNumber - 1));
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setMonth(cycleStartDate.getMonth() + 1);
    } else { // yearly
      cycleStartDate = new Date(startDate);
      cycleStartDate.setFullYear(startDate.getFullYear() + (cycleNumber - 1));
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setFullYear(cycleStartDate.getFullYear() + 1);
    }

    // Verificar se já existe ciclo para este período
    const existingCycle = cycles.find(c => 
      c.starts_at === cycleStartDate.toISOString().split('T')[0]
    );
    if (existingCycle) {
      throw new Error('Ciclo já foi gerado para este período');
    }

    // Criar Order para o ciclo
    const order = this.createOrder(subscription.store_id);

    // Adicionar produtos ao pedido (se houver)
    if (subscription.linked_entities.products) {
      for (const productLink of subscription.linked_entities.products) {
        for (let i = 0; i < productLink.quantity; i++) {
          this.addOrderItem(order.order_id, productLink.product_id, 1);
        }
      }
    }

    // Adicionar serviços ao pedido (se houver)
    // Para serviços recorrentes, criar bookings automáticos
    if (subscription.linked_entities.service_offerings) {
      for (const serviceLink of subscription.linked_entities.service_offerings) {
        // Criar booking automático para o ciclo
        const booking = this.createServiceBooking({
          offering_id: serviceLink.offering_id,
          user_id: userId,
          date: cycleStartDate.toISOString().split('T')[0],
          time: '09:00', // Horário padrão (pode ser configurável)
          quantity: serviceLink.quantity,
        });

        // Confirmar booking e criar ServiceOrder
        const serviceOrderResult = this.confirmServiceBooking(booking.booking_id);
        
        // Adicionar ServiceOrder ao Order (atualiza order in-place)
        this.addServiceOrderToOrder(order.order_id, serviceOrderResult.order_id);
        
        // Atualizar order após adicionar serviço
        const updatedOrder = this.getOrder(order.order_id);
        if (updatedOrder) {
          Object.assign(order, updatedOrder);
        }
      }
    }

    // Criar CheckoutIntent a partir do Order
    const checkout = this.createCheckoutFromOrder(order.order_id, subscription.attribution_id);

    // Confirmar checkout
    this.confirmCheckout(checkout.checkout_id);

    // Criar PaymentPlan (reutiliza lógica existente)
    const paymentPlan = this.createPaymentPlan(checkout.checkout_id, subscription.payment_method);

    // Se for B2B (invoice), adicionar campos de faturamento
    if (subscription.payment_method === 'invoice') {
      const invoiceIssuedAt = new Date().toISOString();
      const invoiceDueDate = new Date(cycleEndDate);
      invoiceDueDate.setDate(invoiceDueDate.getDate() + 30); // 30 dias após fim do ciclo

      (paymentPlan as any).issuedAt = invoiceIssuedAt;
      (paymentPlan as any).due_at = invoiceDueDate.toISOString().split('T')[0];
    }

    // Criar SubscriptionCycle
    const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cycle: SubscriptionCycle = {
      cycle_id: cycleId,
      subscription_id: subscriptionId,
      cycle_number: cycleNumber,
      starts_at: cycleStartDate.toISOString().split('T')[0],
      ends_at: cycleEndDate.toISOString().split('T')[0],
      status: 'billed',
      order_id: order.order_id,
      checkout_id: checkout.checkout_id,
      payment_plan_id: paymentPlan.payment_plan_id,
      invoice_issuedAt: subscription.payment_method === 'invoice' 
        ? new Date().toISOString() 
        : undefined,
      invoice_due_date: subscription.payment_method === 'invoice'
        ? new Date(cycleEndDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined,
      createdAt: new Date().toISOString(),
    };

    cycles.push(cycle);
    this.subscriptionCycles.set(subscriptionId, cycles);

    marketplaceLogger.init('Subscription cycle gerado', {
      subscription_id: subscriptionId,
      cycle_id: cycleId,
      cycle_number: cycleNumber,
    });

    return {
      cycle,
      order,
      checkout,
      payment_plan: paymentPlan,
    };
  }

  /**
   * Buscar ciclos de uma assinatura
   */
  getSubscriptionCycles(subscriptionId: string): SubscriptionCycle[] {
    return this.subscriptionCycles.get(subscriptionId) || [];
  }

  /**
   * Buscar ciclo por ID
   */
  getSubscriptionCycle(cycleId: string): SubscriptionCycle | null {
    for (const cycles of this.subscriptionCycles.values()) {
      const cycle = cycles.find(c => c.cycle_id === cycleId);
      if (cycle) {
        return cycle;
      }
    }
    return null;
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
    categories_supported: string[];
    default_margin_rules: {
      hubMarginBps: number;
      storeMarginBps: number;
      minimum_price?: number;
    };
    authorized_hubs?: string[];
  }): IndustryAccount {
    const industryId = `industry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const industry: IndustryAccount = {
      industry_id: industryId,
      name: input.name,
      cnpj: input.cnpj,
      categories_supported: input.categories_supported,
      default_margin_rules: input.default_margin_rules,
      authorized_hubs: input.authorized_hubs || [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.industryAccounts.set(industryId, industry);

    marketplaceLogger.init('Industry account criada', { industry_id: industryId });

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
    industry_id: string;
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
    supported_products: string[];
    fulfillment_type: 'pickup' | 'delivery' | 'mixed';
    margin_override?: {
      percentage?: number;
      fixed_amount?: number;
    };
    logistics_profile: {
      default_eta_minutes: number;
      supported_vehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
      cost_per_km?: number;
      base_cost?: number;
    };
  }): DistributionHub {
    // Validar que a indústria existe
    const industry = this.industryAccounts.get(input.industry_id);
    if (!industry) {
      throw new Error('Indústria não encontrada');
    }

    const hubId = `hub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const hub: DistributionHub = {
      hub_id: hubId,
      industry_id: input.industry_id,
      name: input.name,
      location: input.location,
      supported_products: input.supported_products,
      fulfillment_type: input.fulfillment_type,
      margin_override: input.margin_override,
      logistics_profile: input.logistics_profile,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.distributionHubs.set(hubId, hub);

    // Adicionar hub à lista de hubs autorizados da indústria
    if (!industry.authorized_hubs.includes(hubId)) {
      industry.authorized_hubs.push(hubId);
      industry.updatedAt = new Date().toISOString();
    }

    marketplaceLogger.init('Distribution hub criado', { hub_id: hubId, industry_id: input.industry_id });

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
      .filter(h => h.industry_id === industryId && h.isActive);
  }

  /**
   * Buscar hub mais próximo para um produto industrial em uma região
   * (simplificado: retorna primeiro hub ativo que suporta o produto)
   */
  findHubForProduct(productId: string, city: string, state: string): DistributionHub | null {
    const hubs = Array.from(this.distributionHubs.values())
      .filter(h => 
        h.isActive &&
        h.supported_products.includes(productId) &&
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
      product_id: string;
      industry_id: string;
      hub_id: string;
      store_id: string;
      quantity: number;
      unit_price: number;
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
      payment_plan_id: paymentPlanId,
      checkout_id: checkoutId,
      method,
      totalCents: checkout.totalCents,
      splits: [], // Splits serão calculados via engine canônico em executePaymentPlan
      status: 'calculated',
    };

    this.paymentPlans.set(paymentPlanId, paymentPlan);

    marketplaceLogger.init('PaymentPlan criado com dropship', {
      payment_plan_id: paymentPlanId,
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
    const defaultVehicle = hub.logistics_profile.supported_vehicles[0] || 'car';
    const baseCost = hub.logistics_profile.base_cost || 10.00;

    const delivery: DeliveryOrder = {
      delivery_id: deliveryId,
      checkout_id: checkoutId,
      store_id: storeId, // Loja continua como seller comercial
      type: hub.fulfillment_type === 'pickup' ? 'own' : 'third_party',
      vehicle: defaultVehicle,
      eta_minutes: hub.logistics_profile.default_eta_minutes,
      cost: {
        amountCents: baseCost,
        currency: 'BRL',
        payer: 'buyer', // Cliente paga o frete
      },
      status: 'created',
    };

    // Adicionar metadados de hub (não quebra contrato)
    (delivery as any).hub_id = hubId;
    (delivery as any).fulfillment_by = 'hub';

    this.deliveries.set(deliveryId, delivery);

    marketplaceLogger.init('Delivery criado via hub', {
      delivery_id: deliveryId,
      hub_id: hubId,
      store_id: storeId,
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
    order_id: string;
    actor_id: string;
    actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
    event_type: 'created' | 'fulfilled' | 'cancelled' | 'disputed' | 'delivered';
    timestamp: string;
    fulfillment_time_hours?: number;
  }>> = new Map(); // actor_id -> events[]

  /**
   * Criar contrato de SLA
   */
  createSLAContract(input: {
    actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
    actor_id: string;
    metrics: {
      fulfilled_at: { target_hours: number; max_hours: number };
      cancellation_rate: { target_percentage: number; max_percentage: number };
      dispute_rate: { target_percentage: number; max_percentage: number };
    };
    thresholds: {
      warning: {
        fulfillment_time_hours: number;
        cancellation_rate_percentage: number;
        dispute_rate_percentage: number;
      };
      violation: {
        fulfillment_time_hours: number;
        cancellation_rate_percentage: number;
        dispute_rate_percentage: number;
      };
    };
    penalties: {
      fulfillment_time_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
      cancellation_rate_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
      dispute_rate_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
    };
  }): SLAContract {
    const slaId = `sla-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sla: SLAContract = {
      sla_id: slaId,
      actor_type: input.actor_type,
      actor_id: input.actor_id,
      metrics: {
        fulfilled_at: { ...input.metrics.fulfilled_at, unit: 'hours' },
        cancellation_rate: { ...input.metrics.cancellation_rate, unit: 'percentage' },
        dispute_rate: { ...input.metrics.dispute_rate, unit: 'percentage' },
      },
      thresholds: input.thresholds,
      penalties: input.penalties,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.slaContracts.set(slaId, sla);

    marketplaceLogger.init('SLA contract criado', { sla_id: slaId, actor_id: input.actor_id });

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
      if (sla.actor_id === actorId && sla.actor_type === actorType && sla.isActive) {
        return sla;
      }
    }
    return null;
  }

  /**
   * Registrar evento de pedido (para tracking de SLA)
   */
  recordOrderEvent(input: {
    order_id: string;
    actor_id: string;
    actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
    event_type: 'created' | 'fulfilled' | 'cancelled' | 'disputed' | 'delivered';
    fulfillment_time_hours?: number;
  }): void {
    const events = this.orderEvents.get(input.actor_id) || [];
    
    events.push({
      ...input,
      timestamp: new Date().toISOString(),
    });

    this.orderEvents.set(input.actor_id, events);

    marketplaceLogger.init('Order event registrado', {
      actor_id: input.actor_id,
      event_type: input.event_type,
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
    const totalOrders = periodEvents.filter(e => e.event_type === 'created').length;
    const fulfilledOrders = periodEvents.filter(e => e.event_type === 'fulfilled' || e.event_type === 'delivered').length;
    const cancelledOrders = periodEvents.filter(e => e.event_type === 'cancelled').length;
    const disputedOrders = periodEvents.filter(e => e.event_type === 'disputed').length;

    const fulfillmentTimes = periodEvents
      .filter(e => e.fulfillment_time_hours !== undefined)
      .map(e => e.fulfillment_time_hours!);

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
      if (e.event_type !== 'delivered' || !e.fulfillment_time_hours) return false;
      const sla = this.getSLAContractByActor(actorId, actorType);
      if (!sla) return false;
      return e.fulfillment_time_hours <= sla.metrics.fulfilled_at.target_hours;
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
      if (averageFulfillmentTime > sla.metrics.fulfilled_at.target_hours) {
        const excessHours = averageFulfillmentTime - sla.metrics.fulfilled_at.target_hours;
        fulfillmentPenalty = Math.min(excessHours * 2, 30); // Máximo 30 pontos
      }

      // Penalidade por cancelamento
      if (cancellationRate > sla.metrics.cancellation_rate.target_percentage) {
        const excessRate = cancellationRate - sla.metrics.cancellation_rate.target_percentage;
        cancellationPenalty = Math.min(excessRate * 5, 30); // Máximo 30 pontos
      }

      // Penalidade por disputa
      if (disputeRate > sla.metrics.dispute_rate.target_percentage) {
        const excessRate = disputeRate - sla.metrics.dispute_rate.target_percentage;
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
          sla.thresholds.warning.fulfillment_time_hours,
          sla.thresholds.violation.fulfillment_time_hours
        )
      : 'compliant';

    const cancellationRateStatus = sla
      ? getSLAStatus(
          cancellationRate,
          sla.thresholds.warning.cancellation_rate_percentage,
          sla.thresholds.violation.cancellation_rate_percentage
        )
      : 'compliant';

    const disputeRateStatus = sla
      ? getSLAStatus(
          disputeRate,
          sla.thresholds.warning.dispute_rate_percentage,
          sla.thresholds.violation.dispute_rate_percentage
        )
      : 'compliant';

    const overallStatus: 'compliant' | 'warning' | 'violation' =
      fulfillmentTimeStatus === 'violation' || cancellationRateStatus === 'violation' || disputeRateStatus === 'violation'
        ? 'violation'
        : fulfillmentTimeStatus === 'warning' || cancellationRateStatus === 'warning' || disputeRateStatus === 'warning'
        ? 'warning'
        : 'compliant';

    const snapshot: ReputationSnapshot = {
      snapshot_id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actor_id: actorId,
      actor_type: actorType,
      period: { year, month },
      metrics: {
        total_orders,
        fulfilled_orders,
        cancelled_orders,
        disputed_orders,
        average_fulfillment_time_hours: averageFulfillmentTime,
        cancellation_rate_percentage: cancellationRate,
        dispute_rate_percentage: disputeRate,
        on_time_delivery_percentage: onTimeDeliveryPercentage,
      },
      score: {
        base_score: baseScore,
        fulfillment_penalty,
        cancellation_penalty,
        dispute_penalty,
        final_score: finalScore,
      },
      sla_status: {
        fulfilled_at: fulfillmentTimeStatus,
        cancellation_rate: cancellationRateStatus,
        dispute_rate: disputeRateStatus,
        overall: overallStatus,
      },
      createdAt: new Date().toISOString(),
    };

    existingSnapshots.push(snapshot);
    this.reputationSnapshots.set(actorId, existingSnapshots);

    marketplaceLogger.init('Reputation snapshot gerado', {
      snapshot_id: snapshot.snapshot_id,
      actor_id: actorId,
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
      const snapshot = snapshots.find(s => s.snapshot_id === snapshotId);
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

    const checkout = this.getCheckout(paymentPlan.checkout_id);
    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    // Buscar SLAs dos atores envolvidos
    const actorSlas = new Map<string, SLAContract>();

    for (const order of checkout.orders) {
      // Buscar SLA da loja
      const storeSLA = this.getSLAContractByActor(order.store_id, 'store');
      if (storeSLA) {
        actorSlas.set(`store-${order.store_id}`, storeSLA);
      }

      // Buscar snapshots recentes para verificar violações
      const storeSnapshots = this.getReputationSnapshots(order.store_id);
      const latestSnapshot = storeSnapshots[storeSnapshots.length - 1];

      if (latestSnapshot && latestSnapshot.sla_status.overall === 'violation') {
        const sla = actorSlas.get(`store-${order.store_id}`);
        if (sla) {
          // Aplicar penalidades
          const penaltySplits: Array<{
            type: 'seller' | 'platform' | 'affiliate' | 'regional_fund' | 'industry' | 'hub';
            target_id: string;
            amountCents: number;
            currency: string;
          }> = [];

          // 🔴 CORREÇÃO INSTITUCIONAL: Penalidades via NOVA transação (append-only)
          // Conforme CORE_SPLIT_PAGAMENTO_CANONICO.md (seção 12.1: splits são imutáveis)
          // PROIBIDO: modificar splits existentes (sellerSplit.amount -= penaltyAmount)
          // OBRIGATÓRIO: criar NOVA transação de penalidade via Core canônico
          
          // Buscar split do seller para calcular penalidade base
          // NOTA: Este split é apenas para cálculo, não será modificado
          const sellerSplit = paymentPlan.splits.find(s => s.type === 'seller' && s.target_id === order.store_id);
          if (sellerSplit && sellerSplit.amountCents > 0) {
            let penaltyAmount = 0;

            // Calcular penalidade total (baseado no split original, não modificado)
            if (latestSnapshot.sla_status.fulfilled_at === 'violation') {
              if (sla.penalties.fulfillment_time_violation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.fulfillment_time_violation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.fulfillment_time_violation.valueCents;
              }
            }

            if (latestSnapshot.sla_status.cancellation_rate === 'violation') {
              if (sla.penalties.cancellation_rate_violation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.cancellation_rate_violation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.cancellation_rate_violation.valueCents;
              }
            }

            if (latestSnapshot.sla_status.dispute_rate === 'violation') {
              if (sla.penalties.dispute_rate_violation.type === 'percentage') {
                penaltyAmount += (sellerSplit.amountCents * sla.penalties.dispute_rate_violation.valueCents) / 100;
              } else {
                penaltyAmount += sla.penalties.dispute_rate_violation.valueCents;
              }
            }

            // Limitar penalidade ao valor do split original
            penaltyAmount = Math.min(penaltyAmount, sellerSplit.amountCents);

            if (penaltyAmount > 0) {
              // Registrar penalidade para criação de nova transação via Core
              // NOTA: A transação será criada em executePaymentPlan ou método dedicado
              // Por enquanto, apenas registrar metadata para processamento posterior
              penaltySplits.push({
                type: sla.penalties.fulfillment_time_violation.redirect_to === 'regional_fund' ? 'regional_fund' : 'platform',
                target_id: sla.penalties.fulfillment_time_violation.redirect_to,
                amountCents: penaltyAmount,
                currency: 'BRL',
              });

              // Marcar payment plan com metadata de penalidade pendente
              (paymentPlan as any).pending_penalties = (paymentPlan as any).pending_penalties || [];
              (paymentPlan as any).pending_penalties.push({
                store_id: order.store_id,
                penalty_amount: penaltyAmount,
                redirect_to: sla.penalties.fulfillment_time_violation.redirect_to,
                sla_violations: {
                  fulfilled_at: latestSnapshot.sla_status.fulfilled_at === 'violation',
                  cancellation_rate: latestSnapshot.sla_status.cancellation_rate === 'violation',
                  dispute_rate: latestSnapshot.sla_status.dispute_rate === 'violation',
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
      payment_plan_id: paymentPlanId,
    });

    return paymentPlan;
  }

  /**
   * Criar caso de disputa
   */
  createDisputeCase(input: {
    order_id: string;
    checkout_id?: string;
    actor_involved: {
      actor_id: string;
      actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
      role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
    };
    type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
    description: string;
  }): DisputeCase {
    const disputeId = `dispute-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dispute: DisputeCase = {
      dispute_id: disputeId,
      order_id: input.order_id,
      checkout_id: input.checkout_id,
      actor_involved: input.actor_involved,
      type: input.type,
      status: 'open',
      description: input.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.disputeCases.set(disputeId, dispute);

    // Registrar evento de disputa
    this.recordOrderEvent({
      order_id: input.order_id,
      actor_id: input.actor_involved.actor_id,
      actor_type: input.actor_involved.actor_type === 'customer' ? 'store' : input.actor_involved.actor_type,
      event_type: 'disputed',
    });

    marketplaceLogger.init('Dispute case criado', { dispute_id: disputeId });

    return dispute;
  }

  /**
   * Resolver caso de disputa
   * Gera novo lançamento no ledger (não reescreve)
   */
  async resolveDisputeCase(
    disputeId: string,
    resolution: {
      resolution_type: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
      amountCents: number;
      currency?: string;
      resolved_by: string;
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

    // Atualizar status
    dispute.status = 'resolved';
    dispute.resolution = {
      ...resolution,
      resolvedAt: new Date().toISOString(),
    };
    dispute.updatedAt = new Date().toISOString();

    // Se houver reembolso, criar novo lançamento no ledger
    if (resolution.resolution_type === 'refund' || resolution.resolution_type === 'partial_refund') {
      if (resolution.amount && resolution.currency) {
        // Importar dependências do UnifyBank
        const { bankPortsRegistry } = await import('@core/bank/ports-registry');
        const { v4: uuidv4 } = await import('uuid');
        const bankLedgerRepository = bankPortsRegistry.getBankLedgerRepository();
        const bankAccount = bankPortsRegistry.getBankAccount();

        // Buscar checkout para obter tenant
        const checkout = dispute.checkout_id ? this.getCheckout(dispute.checkout_id) : null;
        // Por enquanto, usar tenant padrão (será melhorado)
        const tenantId = 'default-tenant';

        // Criar novo lançamento de reembolso
        const ledgerEntryId = uuidv4();
        // TODO: Implementar criação de lançamento de reembolso
        // Por enquanto, apenas registrar o ID
        dispute.resolution!.ledger_entry_id = ledgerEntryId;

        marketplaceLogger.init('Dispute resolution gerou novo lançamento', {
          dispute_id: disputeId,
          ledger_entry_id: ledgerEntryId,
        });
      }
    }

    this.disputeCases.set(disputeId, dispute);

    marketplaceLogger.init('Dispute case resolvido', { dispute_id: disputeId });

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
      .filter(d => d.order_id === orderId);
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
  createIncentiveRule(input: {
    region: { country: string; state: string; city: string };
    incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
    max_amount: number;
    max_per_actor: number;
    max_per_period: number;
    requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
  }): IncentiveRule {
    // Validar que região desbloqueou incentive via snapshot
    const unlockedIncentive = this.getUnlockedIncentive(input.region);
    if (!unlockedIncentive) {
      throw new Error('Região não desbloqueou incentivos via snapshot de impacto');
    }

    const ruleId = `incentive-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const rule: IncentiveRule = {
      rule_id: ruleId,
      region: input.region,
      incentive_type: input.incentive_type,
      max_amount: input.max_amount,
      max_per_actor: input.max_per_actor,
      max_per_period: input.max_per_period,
      currency: 'BRL',
      requires_trust_level: input.requires_trust_level,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.incentiveRules.set(ruleId, rule);

    marketplaceLogger.init('Regra de incentivo criada', {
      rule_id: ruleId,
      region: `${input.region.city}, ${input.region.state}`,
      incentive_type: input.incentive_type,
    });

    return rule;
  }

  /**
   * Conceder incentivo (reduz custo real)
   */
  grantIncentive(input: {
    rule_id: string;
    actor_id: string;
    actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
    amountCents: number;
    reference: {
      order_id?: string;
      delivery_id?: string;
      subscription_id?: string;
      onboarding_id?: string;
    };
  }): IncentiveGrant {
    const rule = this.incentiveRules.get(input.rule_id);
    if (!rule) {
      throw new Error('Regra de incentivo não encontrada');
    }

    if (rule.status !== 'active') {
      throw new Error('Regra de incentivo não está ativa');
    }

    // Validar trust level
    const identity = this.getEconomicIdentity(input.actor_id);
    if (!identity) {
      throw new Error('Identidade econômica não encontrada para o ator');
    }

    const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    const requiredLevel = trustLevels[rule.requires_trust_level] || 0;
    const actorLevel = trustLevels[identity.trust_level] || 0;

    if (actorLevel < requiredLevel) {
      throw new Error(
        `Trust level insuficiente. Requerido: ${rule.requires_trust_level}, Atual: ${identity.trust_level}`
      );
    }

    // Validar limites
    if (input.amount > rule.max_amount) {
      throw new Error(`Valor excede máximo permitido. Máximo: ${rule.max_amount}, Solicitado: ${input.amount}`);
    }

    // Validar limite por ator (período atual)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const actorGrants = this.incentiveGrants.filter(g => {
      if (g.actor_id !== input.actor_id || g.rule_id !== input.rule_id || g.status !== 'consumed') {
        return false;
      }
      const grantDate = new Date(g.grantedAt);
      return grantDate.getMonth() === currentMonth && grantDate.getFullYear() === currentYear;
    });

    const actorTotal = actorGrants.reduce((sum, g) => sum + g.amount, 0);
    if (actorTotal + input.amount > rule.max_per_actor) {
      throw new Error(
        `Limite por ator excedido. Limite: ${rule.max_per_actor}, Já usado: ${actorTotal}, Solicitado: ${input.amount}`
      );
    }

    // Validar limite por período (região)
    const regionGrants = this.incentiveGrants.filter(g => {
      if (
        g.region.country !== rule.region.country ||
        g.region.state !== rule.region.state ||
        g.region.city !== rule.region.city ||
        g.rule_id !== input.rule_id ||
        g.status !== 'consumed'
      ) {
        return false;
      }
      const grantDate = new Date(g.grantedAt);
      return grantDate.getMonth() === currentMonth && grantDate.getFullYear() === currentYear;
    });

    const regionTotal = regionGrants.reduce((sum, g) => sum + g.amount, 0);
    if (regionTotal + input.amount > rule.max_per_period) {
      throw new Error(
        `Limite por período excedido. Limite: ${rule.max_per_period}, Já usado: ${regionTotal}, Solicitado: ${input.amount}`
      );
    }

    // Validar fundo regional tem saldo suficiente
    const regionalFund = this.getRegionalFundByRegion(rule.region);
    if (!regionalFund) {
      throw new Error('Fundo regional não encontrado para a região');
    }

    if (regionalFund.balance < input.amount) {
      throw new Error(
        `Fundo regional sem saldo suficiente. Saldo: ${regionalFund.balance}, Solicitado: ${input.amount}`
      );
    }

    // Criar grant
    const grantId = `incentive-grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const grant: IncentiveGrant = {
      grant_id: grantId,
      rule_id: input.rule_id,
      actor_id: input.actor_id,
      actor_type: input.actor_type,
      region: rule.region,
      incentive_type: rule.incentive_type,
      amountCents: input.amount,
      currency: rule.currency,
      reference: input.reference,
      status: 'granted',
      grantedAt: new Date().toISOString(),
    };

    this.incentiveGrants.push(grant);

    // Registrar evento econômico (público, canônico)
    this.recordIncentiveGrantedEvent(grant, rule);

    marketplaceLogger.init('Incentivo concedido', {
      grant_id: grantId,
      rule_id: input.rule_id,
      actor_id: input.actor_id,
      amountCents: input.amount,
    });

    return grant;
  }

  /**
   * Consumir incentivo (debita fundo regional e marca como consumido)
   */
  consumeIncentive(grantId: string): void {
    const grant = this.incentiveGrants.find(g => g.grant_id === grantId);
    if (!grant) {
      throw new Error('Grant de incentivo não encontrado');
    }

    if (grant.status !== 'granted') {
      throw new Error(`Grant já foi ${grant.status}`);
    }

    const rule = this.incentiveRules.get(grant.rule_id);
    if (!rule) {
      throw new Error('Regra de incentivo não encontrada');
    }

    // Debitar fundo regional via alocação
    const regionalFund = this.getRegionalFundByRegion(grant.region);
    if (!regionalFund) {
      throw new Error('Fundo regional não encontrado');
    }

    try {
      const allocation = this.allocateRegionalFund({
        regional_fund_id: regionalFund.regional_fund_id,
        type: 'incentive',
        target_actor_id: grant.actor_id,
        target_actor_type: grant.actor_type,
        amountCents: grant.amount,
        reason: `Incentivo ${grant.incentive_type} para ${grant.actor_id}`,
        reference: {
          order_id: grant.reference.order_id,
          delivery_id: grant.reference.delivery_id,
          subscription_id: grant.reference.subscription_id,
        },
      });

      // Se alocação foi aprovada automaticamente, executar
      if (allocation.status === 'approved') {
        this.executeAllocation(allocation.allocation_id);
      }

      // Marcar grant como consumido
      grant.status = 'consumed';
      grant.consumedAt = new Date().toISOString();

      marketplaceLogger.init('Incentivo consumido', {
        grant_id: grantId,
        amountCents: grant.amount,
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
      actor_id: grant.actor_id,
      actor_type: grant.actor_type,
      reference_id: grant.grant_id,
      amountCents: grant.amount,
      currency: grant.currency,
      visibility: 'public', // Incentivo é público
    });
  }

  /**
   * Buscar incentivos disponíveis para um ator em uma região
   */
  getAvailableIncentives(
    actorId: string,
    region: { country: string; state: string; city: string }
  ): Array<{
    rule_id: string;
    incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
    max_amount: number;
    max_per_actor: number;
    requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
    available_amount: number; // Quanto ainda pode ser usado pelo ator
  }> {
    // Verificar se região desbloqueou incentive
    const unlockedIncentive = this.getUnlockedIncentive(region);
    if (!unlockedIncentive) {
      return [];
    }

    // Buscar identidade econômica do ator
    const identity = this.getEconomicIdentity(actorId);
    if (!identity) {
      return [];
    }

    // Buscar regras ativas da região
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

      // Verificar trust level
      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[rule.requires_trust_level] || 0;
      const actorLevel = trustLevels[identity.trust_level] || 0;

      return actorLevel >= requiredLevel;
    });

    // Calcular disponibilidade por regra
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return applicableRules.map(rule => {
      const actorGrants = this.incentiveGrants.filter(g => {
        if (g.actor_id !== actorId || g.rule_id !== rule.rule_id || g.status !== 'consumed') {
          return false;
        }
        const grantDate = new Date(g.grantedAt);
        return grantDate.getMonth() === currentMonth && grantDate.getFullYear() === currentYear;
      });

      const actorUsed = actorGrants.reduce((sum, g) => sum + g.amount, 0);
      const availableAmount = Math.max(0, rule.max_per_actor - actorUsed);

      return {
        rule_id: rule.rule_id,
        incentive_type: rule.incentive_type,
        max_amount: rule.max_amount,
        max_per_actor: rule.max_per_actor,
        requires_trust_level: rule.requires_trust_level,
        available_amount: Math.min(availableAmount, rule.max_amount),
      };
    });
  }

  // ============================================================
  // SISTEMA DE CONTRATOS COMERCIAIS B2B ENTRE ATORES
  // ============================================================

  /**
   * B2B Commercial Contracts (in-memory, imutáveis após assinatura)
   * Armazena contratos comerciais B2B
   */
  private b2bContracts: Map<string, B2BCommercialContract> = new Map(); // contract_id -> contract

  /**
   * B2B Contract Executions (in-memory, imutáveis)
   * Armazena execuções de contratos
   */
  private b2bContractExecutions: B2BContractExecution[] = [];

  /**
   * Criar contrato comercial B2B (rascunho)
   */
  createB2BContract(input: {
    supplier_id: string;
    supplier_type: 'store' | 'hub' | 'industry';
    buyer_id: string;
    buyer_type: 'store' | 'hub';
    region: { country: string; state: string; city: string };
    products: Array<{
      product_id: string;
      name: string;
      unit_price: number;
      currency: string;
      minimum_quantity: number;
      maximum_quantity?: number;
    }>;
    terms: {
      volume_commitment: number;
      delivery_schedule: 'weekly' | 'monthly' | 'quarterly';
      payment_terms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
      penaltyBps?: number;
    };
    starts_at: string;
    ends_at: string;
  }): B2BCommercialContract {
    // Validar trust levels (B2B requer trust >= L3)
    const supplierIdentity = this.getEconomicIdentity(input.supplier_id);
    const buyerIdentity = this.getEconomicIdentity(input.buyer_id);

    if (!supplierIdentity || !buyerIdentity) {
      throw new Error('Identidade econômica não encontrada para fornecedor ou comprador');
    }

    const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    const supplierLevel = trustLevels[supplierIdentity.trust_level] || 0;
    const buyerLevel = trustLevels[buyerIdentity.trust_level] || 0;

    if (supplierLevel < 3 || buyerLevel < 3) {
      throw new Error('Contratos B2B requerem trust level L3 ou superior para ambas as partes');
    }

    const contractId = `b2b-contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const contract: B2BCommercialContract = {
      contract_id: contractId,
      supplier_id: input.supplier_id,
      supplier_type: input.supplier_type,
      buyer_id: input.buyer_id,
      buyer_type: input.buyer_type,
      region: input.region,
      products: input.products,
      terms: input.terms,
      status: 'draft',
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      createdAt: new Date().toISOString(),
    };

    this.b2bContracts.set(contractId, contract);

    marketplaceLogger.init('Contrato B2B criado', {
      contract_id: contractId,
      supplier_id: input.supplier_id,
      buyer_id: input.buyer_id,
    });

    return contract;
  }

  /**
   * Assinar contrato B2B (ativa contrato)
   */
  signB2BContract(contractId: string): B2BCommercialContract {
    const contract = this.b2bContracts.get(contractId);
    if (!contract) {
      throw new Error('Contrato não encontrado');
    }

    if (contract.status !== 'draft') {
      throw new Error(`Contrato não pode ser assinado. Status atual: ${contract.status}`);
    }

    contract.status = 'active';
    contract.signedAt = new Date().toISOString();

    this.b2bContracts.set(contractId, contract);

    marketplaceLogger.init('Contrato B2B assinado', { contract_id: contractId });

    return contract;
  }

  /**
   * Executar contrato B2B (cria Order e PaymentPlan)
   */
  executeB2BContract(input: {
    contract_id: string;
    products: Array<{
      product_id: string;
      quantity: number;
    }>;
    delivered_at: string;
  }): B2BContractExecution {
    const contract = this.b2bContracts.get(input.contract_id);
    if (!contract) {
      throw new Error('Contrato não encontrado');
    }

    if (contract.status !== 'active') {
      throw new Error(`Contrato não está ativo. Status: ${contract.status}`);
    }

    // Validar produtos e quantidades
    const executionProducts: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }> = [];

    let totalAmount = 0;

    for (const execProduct of input.products) {
      const contractProduct = contract.products.find(p => p.product_id === execProduct.product_id);
      if (!contractProduct) {
        throw new Error(`Produto ${execProduct.product_id} não está no contrato`);
      }

      if (execProduct.quantity < contractProduct.minimum_quantity) {
        throw new Error(
          `Quantidade abaixo do mínimo. Mínimo: ${contractProduct.minimum_quantity}, Fornecida: ${execProduct.quantity}`
        );
      }

      if (contractProduct.maximum_quantity && execProduct.quantity > contractProduct.maximum_quantity) {
        throw new Error(
          `Quantidade acima do máximo. Máximo: ${contractProduct.maximum_quantity}, Fornecida: ${execProduct.quantity}`
        );
      }

      const subtotal = execProduct.quantity * contractProduct.unit_price;
      executionProducts.push({
        product_id: execProduct.product_id,
        quantity: execProduct.quantity,
        unit_price: contractProduct.unit_price,
        subtotal,
      });

      totalAmount += subtotal;
    }

    // Criar Order
    const order = this.createOrder({
      store_id: contract.supplier_id,
      channel: 'b2b',
      origin: 'marketplace',
    });

    // Adicionar produtos ao Order
    for (const execProduct of executionProducts) {
      this.addOrderItem(order.order_id, {
        product_id: execProduct.product_id,
        quantity: execProduct.quantity,
      });
    }

    // Criar CheckoutIntent
    const checkout = this.createCheckoutFromOrder(order.order_id);

    // Confirmar checkout
    this.confirmCheckout(checkout.checkout_id);

    // Criar PaymentPlan (invoice para B2B)
    const paymentPlan = this.createPaymentPlan(checkout.checkout_id, 'invoice');

    // Calcular data de vencimento baseado em payment_terms
    const paymentDueDate = this.calculatePaymentDueDate(
      contract.terms.payment_terms,
      new Date().toISOString()
    );

    // Criar execução
    const executionId = `b2b-execution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const execution: B2BContractExecution = {
      execution_id: executionId,
      contract_id: input.contract_id,
      order_id: order.order_id,
      payment_plan_id: paymentPlan.payment_plan_id,
      products: executionProducts,
      totalAmountCents: totalAmount,
      currency: contract.products[0]?.currency || 'BRL',
      delivered_at: input.delivered_at,
      payment_due_date: paymentDueDate,
      status: 'pending',
      executedAt: new Date().toISOString(),
    };

    this.b2bContractExecutions.push(execution);

    marketplaceLogger.init('Contrato B2B executado', {
      execution_id: executionId,
      contract_id: input.contract_id,
      order_id: order.order_id,
    });

    return execution;
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
    const execution = this.b2bContractExecutions.find(e => e.execution_id === executionId);
    if (!execution) {
      throw new Error('Execução não encontrada');
    }

    if (execution.status !== 'overdue') {
      throw new Error(`Execução não está em atraso. Status: ${execution.status}`);
    }

    const contract = this.b2bContracts.get(execution.contract_id);
    if (!contract) {
      throw new Error('Contrato não encontrado');
    }

    if (!contract.terms.penaltyBps) {
      throw new Error('Contrato não possui taxa de multa configurada');
    }

    // Calcular multa
    const penaltyAmount = (execution.totalAmountCents * contract.terms.penaltyBps) / 100;

    execution.penaltyAppliedCents = penaltyAmount;
    execution.status = 'penalized';

    marketplaceLogger.init('Multa aplicada ao contrato B2B', {
      execution_id: executionId,
      penalty_amount: penaltyAmount,
    });

    return execution;
  }

  /**
   * Marcar execução como entregue
   */
  markExecutionDelivered(executionId: string): void {
    const execution = this.b2bContractExecutions.find(e => e.execution_id === executionId);
    if (!execution) {
      throw new Error('Execução não encontrada');
    }

    if (execution.status !== 'pending') {
      throw new Error(`Execução não pode ser marcada como entregue. Status: ${execution.status}`);
    }

    execution.status = 'delivered';
    execution.deliveredAt = new Date().toISOString();

    marketplaceLogger.init('Execução de contrato B2B marcada como entregue', {
      execution_id: executionId,
    });
  }

  /**
   * Marcar execução como paga
   */
  markExecutionPaid(executionId: string): void {
    const execution = this.b2bContractExecutions.find(e => e.execution_id === executionId);
    if (!execution) {
      throw new Error('Execução não encontrada');
    }

    if (execution.status !== 'delivered' && execution.status !== 'penalized') {
      throw new Error(`Execução não pode ser marcada como paga. Status: ${execution.status}`);
    }

    execution.status = 'paid';
    execution.paidAt = new Date().toISOString();

    marketplaceLogger.init('Execução de contrato B2B marcada como paga', {
      execution_id: executionId,
    });
  }

  /**
   * Verificar execuções em atraso (chamado periodicamente)
   */
  checkOverdueExecutions(): void {
    const now = new Date();

    for (const execution of this.b2bContractExecutions) {
      if (execution.status === 'pending' || execution.status === 'delivered') {
        const dueDate = new Date(execution.payment_due_date);
        if (now > dueDate) {
          execution.status = 'overdue';
          marketplaceLogger.init('Execução de contrato B2B marcada como em atraso', {
            execution_id: execution.execution_id,
            payment_due_date: execution.payment_due_date,
          });
        }
      }
    }
  }

  /**
   * Buscar contratos de um ator
   */
  getB2BContractsByActor(actorId: string, role: 'supplier' | 'buyer'): B2BCommercialContract[] {
    return Array.from(this.b2bContracts.values()).filter(contract => {
      if (role === 'supplier') {
        return contract.supplier_id === actorId;
      } else {
        return contract.buyer_id === actorId;
      }
    });
  }

  /**
   * Buscar execuções de um contrato
   */
  getB2BContractExecutions(contractId: string): B2BContractExecution[] {
    return this.b2bContractExecutions.filter(e => e.contract_id === contractId);
  }

  // ============================================================
  // SISTEMA DE CONSCIÊNCIA DE CUSTO E SUSTENTABILIDADE ECONÔMICA
  // ============================================================

  /**
   * Operational Cost Profiles (in-memory, opt-in, privado)
   * Armazena perfis de custo operacional
   */
  private operationalCostProfiles: Map<string, OperationalCostProfile> = new Map(); // profile_id -> profile

  /**
   * Economic Sustainability Snapshots (in-memory, imutáveis)
   * Armazena snapshots de sustentabilidade econômica
   */
  private economicSustainabilitySnapshots: Map<string, EconomicSustainabilitySnapshot> = new Map(); // snapshot_id -> snapshot

  /**
   * Criar perfil de custo operacional (opt-in, privado)
   */
  createOperationalCostProfile(input: {
    actor_id: string;
    actor_type: 'store' | 'service_provider';
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
  }): OperationalCostProfile {
    const profileId = `cost-profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const profile: OperationalCostProfile = {
      profile_id: profileId,
      actor_id: input.actor_id,
      actor_type: input.actor_type,
      period: input.period,
      fixed_costs: input.fixed_costs,
      variable_costs: input.variable_costs,
      declared_volume_expectation: input.declared_volume_expectation,
      currency: input.variable_costs[0]?.currency || 'BRL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.operationalCostProfiles.set(profileId, profile);

    marketplaceLogger.init('Perfil de custo operacional criado', {
      profile_id: profileId,
      actor_id: input.actor_id,
      period: `${input.period.month}/${input.period.year}`,
    });

    return profile;
  }

  /**
   * Buscar perfil de custo operacional
   */
  getOperationalCostProfile(actorId: string, period: { year: number; month: number }): OperationalCostProfile | null {
    for (const profile of this.operationalCostProfiles.values()) {
      if (
        profile.actor_id === actorId &&
        profile.period.year === period.year &&
        profile.period.month === period.month
      ) {
        return profile;
      }
    }
    return null;
  }

  /**
   * Atualizar perfil de custo operacional (opt-in, privado)
   */
  updateOperationalCostProfile(profileId: string, input: {
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
  }): OperationalCostProfile {
    const profile = this.operationalCostProfiles.get(profileId);
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
    this.operationalCostProfiles.set(profileId, profile);

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
        s.actor_id === actorId &&
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
    const profile = this.getOperationalCostProfile(actorId, period);
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
      snapshot_id: snapshotId,
      actor_id: actorId,
      actor_type: profile.actor_type,
      period,
      total_fixed_cost: totalFixedCost,
      average_variable_cost: averageVariableCost,
      average_price: averagePrice,
      break_even_volume: breakEvenVolume,
      current_margin_percentage: currentMarginPercentage,
      sustainability_status: sustainabilityStatus,
      calculation_explanation: calculationExplanation,
      currency: profile.currency,
      createdAt: new Date().toISOString(),
    };

    this.economicSustainabilitySnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de sustentabilidade econômica gerado', {
      snapshot_id: snapshotId,
      actor_id: actorId,
      period: `${period.month}/${period.year}`,
    });

    return snapshot;
  }

  /**
   * Calcular total de custos fixos
   */
  private calculateTotalFixedCost(profile: OperationalCostProfile): number {
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
   * Calcular custo variável médio
   */
  private calculateAverageVariableCost(profile: OperationalCostProfile): number {
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
      if (order.store_id !== actorId) {
        return false;
      }

      // Orders não têm createdAt, usar aproximação via eventos
      const orderEvents = this.economicEvents.filter(
        e =>
          e.reference_id === order.order_id &&
          (e.type === 'order_created' || e.type === 'order_completed')
      );

      if (orderEvents.length === 0) {
        return false;
      }

      const eventDate = new Date(orderEvents[0].createdAt);
      return eventDate >= startDate && eventDate <= endDate;
    });

    if (periodOrders.length === 0) {
      // Se não houver vendas, usar preço médio dos produtos ativados
      const storesData = this.getStores();
      const store = storesData.stores.find(s => s.store_id === actorId);
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
        totalPrice += item.price.amount;
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
      .filter(s => s.actor_id === actorId)
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
    industry_id: string;
    product_id: string;
    min_quantity: number;
    max_quantity?: number;
    unit_price: { amountCents: number; currency: string };
    commit_deadline: string; // ISO 8601
    regions_allowed: Array<{ country: string; state: string; city: string }>;
  }): ProductionBatch {
    // Validar que industry existe
    const industry = this.industryAccounts.get(input.industry_id);
    if (!industry) {
      throw new Error('Indústria não encontrada');
    }

    // Validar que produto existe
    const canonicalProducts = this.getCanonicalProducts();
    const product = canonicalProducts.products.find(p => p.id === input.product_id);
    if (!product) {
      throw new Error('Produto canônico não encontrado');
    }

    // Validar que produto é industrial (se campo existir)
    if ((product as any).product_type && (product as any).product_type !== 'industrial') {
      throw new Error('Apenas produtos industriais podem ter lotes de produção');
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const batch: ProductionBatch = {
      batch_id: batchId,
      industry_id: input.industry_id,
      product_id: input.product_id,
      min_quantity: input.min_quantity,
      max_quantity: input.max_quantity,
      unit_price: input.unit_price,
      commit_deadline: input.commit_deadline,
      regions_allowed: input.regions_allowed,
      status: 'open',
      total_committed_quantity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.productionBatches.set(batchId, batch);

    marketplaceLogger.init('Lote de produção programado criado', {
      batch_id: batchId,
      industry_id: input.industry_id,
      product_id: input.product_id,
      min_quantity: input.min_quantity,
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
        if (batch.commit_deadline < now) {
          return false;
        }

        // Verificar se região está permitida
        return batch.regions_allowed.some(
          r =>
            r.country === region.country &&
            r.state === region.state &&
            r.city === region.city
        );
      })
      .sort((a, b) => {
        // Ordenar por deadline mais próximo primeiro
        return a.commit_deadline.localeCompare(b.commit_deadline);
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
    batch_id: string;
    actor_id: string;
    actor_type: 'user' | 'store' | 'hub';
    quantity: number;
  }): BatchCommitment {
    const batch = this.productionBatches.get(input.batch_id);
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Validar que lote está aberto
    if (batch.status !== 'open') {
      throw new Error('Lote não está aberto para compromissos');
    }

    // Validar que deadline não passou
    const now = new Date().toISOString();
    if (batch.commit_deadline < now) {
      throw new Error('Prazo para compromissos expirou');
    }

    // Validar quantidade máxima (se definida)
    const currentTotal = batch.total_committed_quantity;
    if (batch.max_quantity && currentTotal + input.quantity > batch.max_quantity) {
      throw new Error(
        `Quantidade máxima do lote seria excedida. Disponível: ${batch.max_quantity - currentTotal}`
      );
    }

    // Validar quantidade mínima
    if (input.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    const commitmentId = `commitment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const commitment: BatchCommitment = {
      commitment_id: commitmentId,
      batch_id: input.batch_id,
      actor_id: input.actor_id,
      actor_type: input.actor_type,
      quantity: input.quantity,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.batchCommitments.push(commitment);

    // Atualizar quantidade total comprometida do lote
    batch.total_committed_quantity += input.quantity;
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(input.batch_id, batch);

    marketplaceLogger.init('Compromisso de compra em lote criado', {
      commitment_id: commitmentId,
      batch_id: input.batch_id,
      actor_id: input.actor_id,
      quantity: input.quantity,
    });

    return commitment;
  }

  /**
   * Cancelar compromisso (antes do deadline)
   */
  cancelCommitment(commitmentId: string): BatchCommitment {
    const commitment = this.batchCommitments.find(c => c.commitment_id === commitmentId);
    if (!commitment) {
      throw new Error('Compromisso não encontrado');
    }

    // Validar que compromisso está ativo
    if (commitment.status !== 'active') {
      throw new Error('Compromisso não pode ser cancelado (já foi cancelado ou convertido)');
    }

    const batch = this.productionBatches.get(commitment.batch_id);
    if (!batch) {
      throw new Error('Lote não encontrado');
    }

    // Validar que deadline não passou (pode cancelar antes do deadline)
    const now = new Date().toISOString();
    if (batch.commit_deadline < now) {
      throw new Error('Prazo para cancelamento expirou (lote já foi avaliado)');
    }

    // Atualizar compromisso
    commitment.status = 'cancelled';
    commitment.cancelledAt = new Date().toISOString();

    // Atualizar quantidade total comprometida do lote
    batch.total_committed_quantity -= commitment.quantity;
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(commitment.batch_id, batch);

    marketplaceLogger.init('Compromisso de compra em lote cancelado', {
      commitment_id: commitmentId,
      batch_id: commitment.batch_id,
    });

    return commitment;
  }

  /**
   * Buscar compromissos de um lote
   */
  getBatchCommitments(batchId: string): BatchCommitment[] {
    return this.batchCommitments.filter(c => c.batch_id === batchId);
  }

  /**
   * Buscar compromissos de um ator
   */
  getActorCommitments(actorId: string): BatchCommitment[] {
    return this.batchCommitments.filter(c => c.actor_id === actorId && c.status === 'active');
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
    if (batch.commit_deadline >= now) {
      throw new Error('Deadline ainda não passou');
    }

    // Verificar se quantidade mínima foi atingida
    if (batch.total_committed_quantity < batch.min_quantity) {
      // Lote expira (não executa)
      batch.status = 'expired';
      batch.closedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      this.productionBatches.set(batchId, batch);

      marketplaceLogger.init('Lote de produção expirado (quantidade mínima não atingida)', {
        batch_id: batchId,
        min_quantity: batch.min_quantity,
        committed_quantity: batch.total_committed_quantity,
      });
    } else {
      // Lote fecha (será executado)
      batch.status = 'closed';
      batch.closedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      this.productionBatches.set(batchId, batch);

      marketplaceLogger.init('Lote de produção fechado (quantidade mínima atingida)', {
        batch_id: batchId,
        min_quantity: batch.min_quantity,
        committed_quantity: batch.total_committed_quantity,
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
      c => c.batch_id === batchId && c.status === 'active'
    );

    if (activeCommitments.length === 0) {
      throw new Error('Nenhum compromisso ativo encontrado para o lote');
    }

    const orders: Order[] = [];

    // Criar Order para cada compromisso
    for (const commitment of activeCommitments) {
      // Determinar store_id baseado no tipo de ator
      let storeId: string;
      if (commitment.actor_type === 'store') {
        storeId = commitment.actor_id;
      } else if (commitment.actor_type === 'hub') {
        // Hub pode atuar como store temporariamente
        storeId = commitment.actor_id;
      } else {
        // User precisa de uma loja intermediária (usar primeira loja disponível)
        const storesData = this.getStores();
        const firstStore = storesData.stores[0];
        if (!firstStore) {
          throw new Error('Nenhuma loja disponível para processar pedido de usuário');
        }
        storeId = firstStore.store_id;
      }

      // Criar Order
      const order = this.createOrder({
        store_id: storeId,
        items: [
          {
            product_id: batch.product_id,
            name: `Produto Industrial - Lote ${batch.batch_id}`,
            price: batch.unit_price,
            quantity: commitment.quantity,
            subtotal: batch.unit_price.amount * commitment.quantity,
          },
        ],
        channel: 'online',
        origin: 'marketplace',
      });

      // Marcar compromisso como convertido
      commitment.status = 'converted';
      commitment.order_id = order.order_id;

      orders.push(order);

      marketplaceLogger.init('Compromisso convertido em Order', {
        commitment_id: commitment.commitment_id,
        order_id: order.order_id,
        batch_id: batchId,
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
      batch_id: batchId,
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
      plan_id: 'basic',
      name: 'basic',
      display_name: 'Básico',
      description: 'Plano básico gratuito com funcionalidades essenciais',
      capabilities: {
        max_stores: 1,
        max_branches: 1,
        max_products: 50,
        max_services: 10,
        max_monthly_transactions: 1000,
        b2b_contracts_enabled: false,
        industry_enabled: false,
        hub_enabled: false,
        batch_production_enabled: false,
        pdv_enabled: true,
        advanced_analytics: false,
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Plano Profissional
    const professionalPlan: CompanyPlan = {
      plan_id: 'professional',
      name: 'professional',
      display_name: 'Profissional',
      description: 'Plano profissional com mais limites e capacidades',
      capabilities: {
        max_stores: 5,
        max_branches: 10,
        max_products: 500,
        max_services: 50,
        max_monthly_transactions: 10000,
        b2b_contracts_enabled: true,
        industry_enabled: false,
        hub_enabled: false,
        batch_production_enabled: false,
        pdv_enabled: true,
        advanced_analytics: true,
      },
      price: {
        amountCents: 99.00,
        currency: 'BRL',
        billing_cycle: 'monthly',
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Plano Industrial / Hub
    const industrialPlan: CompanyPlan = {
      plan_id: 'industrial',
      name: 'industrial',
      display_name: 'Industrial / Hub',
      description: 'Plano para indústrias e hubs com alto volume',
      capabilities: {
        max_stores: 20,
        max_branches: 50,
        max_products: 10000,
        max_services: 200,
        max_monthly_transactions: 1000000,
        b2b_contracts_enabled: true,
        industry_enabled: true,
        hub_enabled: true,
        batch_production_enabled: true,
        pdv_enabled: true,
        advanced_analytics: true,
      },
      price: {
        amountCents: 499.00,
        currency: 'BRL',
        billing_cycle: 'monthly',
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
    company_type: 'cnpj' | 'cpf' | 'mei';
    company_name: string;
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
      qsa_document?: string;
      last_contractual_change?: string;
      address_proof?: string;
    };
    // OBRIGATÓRIO: Conta bancária
    bank_account: {
      type: 'unifibank' | 'external';
      account_id?: string;
      external_bank_name?: string;
      external_account_number?: string;
      verified: boolean;
    };
    marketplace_enabled: boolean;
    services_enabled: boolean;
    products_enabled: boolean;
    pdv_enabled: boolean;
    // OBRIGATÓRIO: Payment Infrastructure
    payment_infrastructure: {
      accept_unificard: boolean;
      accept_external_gateway: boolean;
      external_gateway_provider?: string;
    };
    payment_terminal_requested: boolean;
    payment_terminal_type?: 'unified_card' | 'external';
    payment_terminal_provider?: string;
    plan_id?: string; // Default: 'basic'
  }): CompanyOnboarding {
    const onboardingId = `onboarding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const companyId = `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Validar plano (default: basic)
    const planId = input.plan_id || 'basic';
    const plan = this.getCompanyPlan(planId);
    if (!plan) {
      throw new Error(`Plano não encontrado: ${planId}`);
    }

    const onboarding: CompanyOnboarding = {
      onboarding_id: onboardingId,
      company_id: companyId,
      company_type: input.company_type,
      company_name: input.company_name,
      document: input.document,
      category: input.category,
      region: input.region,
      documents: input.documents,
      bank_account: input.bank_account,
      marketplace_enabled: input.marketplace_enabled,
      services_enabled: input.services_enabled,
      products_enabled: input.products_enabled,
      pdv_enabled: input.pdv_enabled,
      payment_infrastructure: input.payment_infrastructure,
      payment_terminal_requested: input.payment_terminal_requested,
      payment_terminal_type: input.payment_terminal_type,
      payment_terminal_provider: input.payment_terminal_provider,
      plan_id: planId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companyOnboardings.set(onboardingId, onboarding);

    marketplaceLogger.init('Processo de onboarding de empresa criado', {
      onboarding_id: onboardingId,
      company_id: companyId,
      company_name: input.company_name,
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
  async completeCompanyOnboarding(onboardingId: string): Promise<CompanyOnboarding> {
    const onboarding = this.companyOnboardings.get(onboardingId);
    if (!onboarding) {
      throw new Error('Onboarding não encontrado');
    }

    if (onboarding.status !== 'draft' && onboarding.status !== 'in_progress') {
      throw new Error('Onboarding já foi completado ou falhou');
    }

    // Validar campos obrigatórios
    if (onboarding.company_type === 'cnpj' && !onboarding.documents.cnpj) {
      throw new Error('CNPJ é obrigatório para empresas do tipo CNPJ');
    }

    if (!onboarding.documents.address_proof) {
      throw new Error('Comprovante de endereço é obrigatório');
    }

    if (!onboarding.bank_account) {
      throw new Error('Conta bancária é obrigatória');
    }

    if (!onboarding.bank_account.isVerified) {
      throw new Error('Conta bancária deve ser verificada antes de completar o onboarding');
    }

    if (!onboarding.payment_infrastructure) {
      throw new Error('Configuração de infraestrutura de pagamento é obrigatória');
    }

    onboarding.status = 'in_progress';
    onboarding.updatedAt = new Date().toISOString();
    this.companyOnboardings.set(onboardingId, onboarding);

    try {
      // 1. Garantir RegionalFund vinculado à região (criar se não existir)
      let regionalFund = this.getRegionalFundByRegion(onboarding.region);
      if (!regionalFund) {
        regionalFund = this.createRegionalFund({
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

      // 2. Criar EconomicIdentity automaticamente
      const economicIdentity = this.createEconomicIdentity({
        actor_id: onboarding.company_id,
        actor_type: this.mapCategoryToActorType(onboarding.category),
        verified_assets: {
          document_verified: true,
          bank_account_verified: onboarding.bank_account.isVerified,
          company_registered: onboarding.company_type !== 'cpf',
        },
      });
      onboarding.economic_identity_id = economicIdentity.economic_identity_id;

      // 2. Criar Store/Branch se aplicável
      if (onboarding.marketplace_enabled && (onboarding.category === 'product' || onboarding.category === 'hybrid')) {
        // Criar store no Marketplace
        const storesData = this.getStores();
        const newStoreId = `store-${onboarding.company_id}`;
        const newBranchId = `branch-${onboarding.company_id}-001`;

        // Adicionar store aos dados estáticos (simplificado - em produção seria via DB)
        // Por enquanto, apenas registrar IDs
        onboarding.store_id = newStoreId;
        onboarding.branch_id = newBranchId;

        // Registrar evento de nova loja
        try {
          if (typeof (this as any).recordNewStoreOpenedEvent === 'function') {
            (this as any).recordNewStoreOpenedEvent({
              store_id: newStoreId,
              region: onboarding.region,
            });
          }
        } catch (err) {
          // Ignorar se método não existir
        }

        // Importar catálogo canônico e ativar operações se template foi escolhido
        if (onboarding.business_template_id) {
          try {
            // Registrar uso do template
            this.recordBusinessTemplateUsage(onboarding.business_template_id, onboarding.company_id);

            // Buscar BusinessTemplate
            const businessTemplate = this.getBusinessTemplate(onboarding.business_template_id);
            if (businessTemplate) {
              // Importar catálogo canônico
              const importResult = this.importCanonicalCatalog(
                onboarding.company_id,
                newStoreId,
                onboarding.business_template_id,
                { import_all: true }
              );

              // Atualizar estado de ativação
              this.updateCompanyActivationState(onboarding.company_id, {
                catalog_ready: importResult.imported_products > 0 || importResult.imported_services > 0,
                services_ready: importResult.imported_services > 0,
                agenda_configured: businessTemplate.operational_config.requires_agenda,
                dispatch_enabled: businessTemplate.operational_config.supports_dispatch,
                quote_flow_enabled: businessTemplate.operational_config.supports_quote_flow,
                pdv_enabled: businessTemplate.operational_config.supports_pdv,
                b2b_enabled: businessTemplate.operational_config.supports_b2b,
              });

              marketplaceLogger.init('Catálogo canônico importado e operações ativadas durante onboarding', {
                company_id: onboarding.company_id,
                store_id: newStoreId,
                template_id: onboarding.business_template_id,
                imported_products: importResult.imported_products,
                imported_services: importResult.imported_services,
                operational_config: businessTemplate.operational_config,
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
          name: onboarding.company_name,
          cnpj: onboarding.document,
          categories_supported: [], // Será preenchido depois
          default_margin_rules: {
            platform_fee_percentage: 5,
            regional_fund_percentage: 2,
          },
        });
        onboarding.industry_account_id = industryAccount.industry_id;
      }

      // 4. Criar DistributionHub se aplicável
      if (onboarding.category === 'hub' || onboarding.category === 'hybrid') {
        const hub = this.createDistributionHub({
          industry_id: onboarding.industry_account_id || onboarding.company_id,
          location: onboarding.region,
          supported_products: [],
          fulfillment_type: 'own',
          margin_override: {
            platform_fee_percentage: 3,
            regional_fund_percentage: 1,
          },
        });
        onboarding.hub_id = hub.hub_id;
      }

      // 5. Criar PaymentTerminal se solicitado
      if (onboarding.payment_terminal_requested) {
        const terminal = this.createPaymentTerminal({
          company_id: onboarding.company_id,
          terminal_type: onboarding.payment_terminal_type || 'unified_card',
          provider: onboarding.payment_terminal_provider,
        });
        // Terminal criado e armazenado separadamente
        marketplaceLogger.init('Maquininha de pagamento criada durante onboarding', {
          terminal_id: terminal.terminal_id,
          company_id: onboarding.company_id,
        });
      }

      // 6. Marcar onboarding como completado
      onboarding.status = 'completed';
      onboarding.completedAt = new Date().toISOString();
      onboarding.updatedAt = new Date().toISOString();
      this.companyOnboardings.set(onboardingId, onboarding);

      marketplaceLogger.init('Onboarding de empresa completado', {
        onboarding_id: onboardingId,
        company_id: onboarding.company_id,
        economic_identity_id: onboarding.economic_identity_id,
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
    company_id: string;
    terminal_type: 'unified_card' | 'external';
    provider?: string;
  }): PaymentTerminal {
    const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Estrutura de taxas (determinística)
    const transactionFeeStructure = {
      base_rate: input.terminal_type === 'unified_card' ? 2.5 : 3.0, // % da transação
      regional_fund_percentage: 0.5, // 0.5% da taxa vai para Fundo Regional
      platform_percentage: 1.0, // 1.0% da taxa vai para Plataforma
      referral_percentage: 0.2, // 0.2% da taxa vai para Indicação (se houver)
    };

    const terminal: PaymentTerminal = {
      terminal_id: terminalId,
      company_id: input.company_id,
      terminal_type: input.terminal_type,
      provider: input.provider,
      status: 'requested',
      transaction_fee_structure: transactionFeeStructure,
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentTerminals.set(terminalId, terminal);

    marketplaceLogger.init('Maquininha de pagamento solicitada', {
      terminal_id: terminalId,
      company_id: input.company_id,
      terminal_type: input.terminal_type,
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
      terminal_id: terminalId,
    });

    return terminal;
  }

  /**
   * Ativar maquininha de pagamento
   */
  activatePaymentTerminal(terminalId: string): PaymentTerminal {
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

    // Registrar evento econômico: Fundo Regional financiou infraestrutura
    try {
      const regionalFund = this.getRegionalFundByRegion({
        country: 'BR',
        state: 'PR',
        city: 'Curitiba', // Default - em produção viria do onboarding
      });

      if (regionalFund) {
        // Registrar crédito no Fundo Regional (taxa administrativa)
        this.recordRegionalFundCredit({
          regional_fund_id: regionalFund.regional_fund_id,
          amountCents: 0, // Valor será calculado nas transações
          currency: 'BRL',
          source: 'payment_terminal_setup',
          reference_id: terminalId,
        });

        // Registrar evento econômico
        if (typeof (this as any).recordRegionalFundCreditEvent === 'function') {
          (this as any).recordRegionalFundCreditEvent({
            regional_fund_id: regionalFund.regional_fund_id,
            amountCents: 0,
            currency: 'BRL',
            source: 'payment_terminal_setup',
          });
        }
      }
    } catch (err) {
      // Ignorar se métodos não existirem
      marketplaceLogger.init('Evento de Fundo Regional não registrado (método não disponível)');
    }

    marketplaceLogger.init('Maquininha de pagamento ativada', {
      terminal_id: terminalId,
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
    return Array.from(this.paymentTerminals.values()).filter(t => t.company_id === companyId);
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
    const onboarding = Array.from(this.companyOnboardings.values()).find(o => o.company_id === companyId);
    if (!onboarding) {
      return { allowed: false, reason: 'Empresa não encontrada' };
    }

    // Buscar plano
    const plan = this.getCompanyPlan(onboarding.plan_id);
    if (!plan) {
      return { allowed: false, reason: 'Plano não encontrado' };
    }

    // Validar limites específicos
    switch (action) {
      case 'create_store':
        if (currentCount !== undefined && plan.capabilities.max_stores && currentCount >= plan.capabilities.max_stores) {
          return { allowed: false, reason: `Limite de lojas atingido (${plan.capabilities.max_stores})`, soft_block: true };
        }
        break;

      case 'create_branch':
        if (currentCount !== undefined && plan.capabilities.max_branches && currentCount >= plan.capabilities.max_branches) {
          return { allowed: false, reason: `Limite de filiais atingido (${plan.capabilities.max_branches})`, soft_block: true };
        }
        break;

      case 'create_product':
        if (currentCount !== undefined && plan.capabilities.max_products && currentCount >= plan.capabilities.max_products) {
          return { allowed: false, reason: `Limite de produtos atingido (${plan.capabilities.max_products})`, soft_block: true };
        }
        break;

      case 'create_service':
        if (currentCount !== undefined && plan.capabilities.max_services && currentCount >= plan.capabilities.max_services) {
          return { allowed: false, reason: `Limite de serviços atingido (${plan.capabilities.max_services})`, soft_block: true };
        }
        break;

      case 'create_b2b':
        if (!plan.capabilities.b2b_contracts_enabled) {
          return { allowed: false, reason: 'Contratos B2B não habilitados no plano atual' };
        }
        break;

      case 'create_industry':
        if (!plan.capabilities.industry_enabled) {
          return { allowed: false, reason: 'Produtos industriais não habilitados no plano atual' };
        }
        break;

      case 'create_hub':
        if (!plan.capabilities.hub_enabled) {
          return { allowed: false, reason: 'Hubs não habilitados no plano atual' };
        }
        break;

      case 'create_batch':
        if (!plan.capabilities.batch_production_enabled) {
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
    company_id: string;
    accept_unificard: boolean;
    accept_external_gateway: boolean;
    external_gateway_provider?: string;
  }): PaymentInfrastructureConfig {
    const configId = `payment-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Estrutura de taxas determinística
    const feeStructure = {
      transaction_rate: input.accept_unificard ? 2.5 : 3.0, // % sobre transação
      regional_fund_percentage: 0.5, // 0.5% da taxa vai para Fundo Regional
      platform_percentage: 1.0, // 1.0% da taxa vai para Plataforma
      infrastructure_percentage: 0.3, // 0.3% da taxa cobre infraestrutura (debitado do Fundo Regional)
      referral_percentage: 0.2, // 0.2% da taxa vai para Indicação/Grupo (se houver)
    };

    const config: PaymentInfrastructureConfig = {
      config_id: configId,
      company_id: input.company_id,
      accept_unificard: input.accept_unificard,
      accept_external_gateway: input.accept_external_gateway,
      external_gateway_provider: input.external_gateway_provider,
      fee_structure: feeStructure,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentInfrastructureConfigs.set(configId, config);

    marketplaceLogger.init('Configuração de infraestrutura de pagamento criada', {
      config_id: configId,
      company_id: input.company_id,
    });

    return config;
  }

  /**
   * Buscar configuração de infraestrutura de pagamento
   */
  getPaymentInfrastructureConfig(companyId: string): PaymentInfrastructureConfig | null {
    return Array.from(this.paymentInfrastructureConfigs.values()).find(c => c.company_id === companyId) || null;
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
      snapshot_id: snapshotId,
      region,
      period,
      revenues: {
        transaction: {
          total_amount: 0, // Será calculado
          platform_revenue: 0,
          regional_fund_revenue: 0,
          infrastructure_cost: 0,
        },
        b2b: {
          total_amount: 0,
          platform_revenue: 0,
          regional_fund_revenue: 0,
        },
        subscription: {
          total_amount: 0,
          platform_revenue: 0,
          regional_fund_revenue: 0,
        },
        terminal: {
          total_amount: 0,
          platform_revenue: 0,
          regional_fund_revenue: 0,
          infrastructure_cost: 0,
        },
        logistics: {
          total_amount: 0,
          platform_revenue: 0,
          regional_fund_revenue: 0,
        },
      },
      total_transacted: 0,
      total_fees: 0,
      total_platform_revenue: 0,
      total_regional_fund_revenue: 0,
      total_infrastructure_cost: 0,
      total_incentives: 0,
      currency: 'BRL',
      createdAt: new Date().toISOString(),
    };

    this.revenueSnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de receita mensal gerado', {
      snapshot_id: snapshotId,
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
  getRegionalFinancialFlow(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RegionalFinancialFlow {
    const snapshot = this.getRevenueSnapshot(region, period);
    if (!snapshot) {
      throw new Error('Snapshot de receita não encontrado para o período especificado');
    }

    // Buscar Fundo Regional
    const regionalFund = this.getRegionalFundByRegion(region);
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
  private serviceRequests: Map<string, ServiceRequest> = new Map(); // request_id -> request

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

  /**
   * Criar requisição de serviço
   * Com proteções anti-spam
   */
  createServiceRequest(input: {
    requester_actor_id: string;
    city: string;
    neighborhood?: string;
    intent: 'now' | 'scheduled' | 'bundle';
    service_items: Array<{ offering_id: string; quantity: number }>;
    schedule: {
      mode: 'now' | 'scheduled';
      max_wait_minutes?: number;
      date?: string;
      time_window_minutes?: number;
    };
    constraints: {
      provider_radius_mode: 'same_neighborhood' | 'same_city';
      min_trust_level_required: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
      allow_multiple_providers: boolean;
    };
  }): ServiceRequest {
    // Validar intent
    if (input.intent === 'scheduled' && !input.schedule.date) {
      throw new Error('Data é obrigatória para intent=scheduled');
    }

    if (input.intent === 'now' && !input.schedule.max_wait_minutes) {
      throw new Error('max_wait_minutes é obrigatório para intent=now');
    }

    // Validar service_items
    for (const item of input.service_items) {
      const offering = this.serviceOfferings.get(item.offering_id);
      if (!offering) {
        throw new Error(`Service offering não encontrado: ${item.offering_id}`);
      }

      if (!offering.isActive) {
        throw new Error(`Service offering não está ativo: ${item.offering_id}`);
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
    if (!this.checkAntiSpam(input.requester_actor_id, input.service_items)) {
      throw new Error('Múltiplas requests simultâneas iguais detectadas. Aguarde alguns minutos.');
    }

    const requestId = `service-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: ServiceRequest = {
      request_id: requestId,
      requester_actor_id: input.requester_actor_id,
      city: input.city,
      neighborhood: input.neighborhood,
      intent: input.intent,
      service_items: input.service_items,
      schedule: input.schedule,
      constraints: input.constraints,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    this.serviceRequests.set(requestId, request);

    // Registrar no histórico do usuário (anti-spam)
    const userHistory = this.userRequestHistory.get(input.requester_actor_id) || [];
    userHistory.push({
      request_id: requestId,
      service_items: input.service_items,
      createdAt: new Date().toISOString(),
    });
    this.userRequestHistory.set(input.requester_actor_id, userHistory);

    // Registrar evento econômico (restricted)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_request_created',
          region: { country: 'BR', state: 'PR', city: input.city },
          actor_id: input.requester_actor_id,
          actor_type: 'user',
          reference_id: requestId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Requisição de serviço criada', {
      request_id: requestId,
      intent: input.intent,
      items_count: input.service_items.length,
    });

    return request;
  }

  /**
   * Listar providers elegíveis (determinístico)
   */
  listEligibleServiceProviders(requestId: string): Array<{
    provider_actor_id: string;
    offering_id: string;
    eligibility_reason: string;
    reputation_score?: number;
  }> {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const candidates: Array<{
      provider_actor_id: string;
      offering_id: string;
      eligibility_reason: string;
      reputation_score?: number;
    }> = [];

    // Para cada service_item, buscar providers elegíveis
    for (const item of request.service_items) {
      const offering = this.serviceOfferings.get(item.offering_id);
      if (!offering) {
        continue;
      }

      // Buscar providers que têm este offering
      const providersWithOffering = Array.from(this.serviceOfferings.values())
        .filter(o => o.offering_id === item.offering_id && o.isActive)
        .map(o => o.store_id);

      for (const providerId of providersWithOffering) {
        // Validar elegibilidade determinística

        // 1. Provider online (usar ProviderPresence se disponível, senão usar status mock)
        const presence = this.providerPresences.get(providerId);
        const isOnline = presence ? presence.status === 'online' : (this.providerOnlineStatus.get(providerId) || false);
        if (!isOnline) {
          continue;
        }

        // 2. Availability bate com schedule
        const availability = this.serviceAvailabilities.get(item.offering_id);
        if (!availability || availability.length === 0) {
          continue;
        }

        let availabilityMatches = false;
        if (request.intent === 'now') {
          // Para "now", verificar se há slot disponível hoje
          const today = new Date();
          const weekday = today.getDay(); // 0 = domingo, 1 = segunda, etc.
          const todayAvailability = availability.find(a => a.weekday === weekday);
          if (todayAvailability && todayAvailability.capacity > 0) {
            availabilityMatches = true;
          }
        } else if (request.intent === 'scheduled' && request.schedule.date) {
          // Para "scheduled", verificar se há slot na data especificada
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

        // 3. Trust >= min_trust_level_required
        const identity = this.getEconomicIdentity(providerId);
        if (!identity) {
          continue;
        }

        const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
        const requiredLevel = trustLevels[request.constraints.min_trust_level_required] || 0;
        const providerLevel = trustLevels[identity.trust_level] || 0;

        if (providerLevel < requiredLevel) {
          continue;
        }

        // 4. Região compatível
        const storesData = this.getStores();
        const store = storesData.stores.find(s => s.store_id === providerId);
        if (!store) {
          continue;
        }

        let regionMatches = false;
        if (request.constraints.provider_radius_mode === 'same_neighborhood') {
          // Verificar se há branch no mesmo bairro
          const branchInNeighborhood = store.branches.some(
            b => b.location?.city === request.city && b.location?.neighborhood === request.neighborhood
          );
          if (branchInNeighborhood) {
            regionMatches = true;
          }
        } else if (request.constraints.provider_radius_mode === 'same_city') {
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
          d => d.actor_involved.actor_id === providerId && d.status === 'open'
        );
        if (disputes.length > 0) {
          continue;
        }

        // 6. Verificar capacidade produtiva (PROMPT 23)
        const offering = this.serviceOfferings.get(item.offering_id);
        if (offering) {
          const serviceTemplateId = offering.template_id;
          const targetDate = request.intent === 'now'
            ? new Date().toISOString().split('T')[0]
            : request.schedule.date
            ? request.schedule.date.split('T')[0]
            : null;
          const targetTime = request.intent === 'now'
            ? new Date().toTimeString().split(' ')[0].substring(0, 5)
            : request.schedule.time || '09:00';

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
                resource_id: resourceAvailability.missing_resources[0],
                store_id: providerId,
                company_id: providerId,
                event_type: 'service_rejected_capacity',
                details: {
                  service_request_id: requestId,
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

        // Provider é elegível
        const eligibilityReason = `Provider elegível: online, disponível, trust ${identity.trust_level}, região compatível, capacidade disponível`;

        // Buscar score de reputação (se existir snapshot)
        const snapshots = this.getReputationSnapshots(providerId);
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const reputationScore = latestSnapshot ? latestSnapshot.calculated_score : undefined;

        candidates.push({
          provider_actor_id: providerId,
          offering_id: item.offering_id,
          eligibility_reason: eligibilityReason,
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

      return a.provider_actor_id.localeCompare(b.provider_actor_id);
    });

    return candidates;
  }

  /**
   * Dispatch de requisição de serviço
   */
  dispatchServiceRequest(requestId: string): ServiceDispatch {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.status !== 'open') {
      throw new Error('Requisição não está aberta para dispatch');
    }

    // Anti-spam: verificar se já existe dispatch ativo
    const existingDispatch = Array.from(this.serviceDispatches.values()).find(
      d => d.request_id === requestId && (d.status === 'sent' || d.status === 'accepted')
    );

    if (existingDispatch) {
      const dispatchAge = Date.now() - new Date(existingDispatch.createdAt).getTime();
      const tenMinutes = 10 * 60 * 1000;
      if (dispatchAge < tenMinutes) {
        throw new Error('Já existe dispatch ativo para esta requisição (aguarde 10 minutos)');
      }
    }

    // Listar candidatos elegíveis
    const candidates = this.listEligibleServiceProviders(requestId);

    if (candidates.length === 0) {
      throw new Error('Nenhum provider elegível encontrado');
    }

    // Ordenar candidatos determinísticamente
    const sortedCandidates = this.sortCandidatesDeterministically(candidates, request);

    // Limitar a 20 candidatos (já ordenados)
    const limitedCandidates = sortedCandidates.slice(0, 20);

    const dispatchId = `service-dispatch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dispatch: ServiceDispatch = {
      dispatch_id: dispatchId,
      request_id: requestId,
      candidates: limitedCandidates.map(c => ({
        provider_actor_id: c.provider_actor_id,
        offering_id: c.offering_id,
        eligibility_reason: c.eligibility_reason,
      })),
      rules_applied: {
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
      this.recordDispatchSent(dispatchId, candidate.provider_actor_id, requestId);
    }

    marketplaceLogger.init('Pré-reservas criadas para dispatch', {
      dispatch_id: dispatchId,
      pre_reservations_count: preReservations.length,
    });

    // Atualizar status da requisição
    request.status = 'dispatched';
    request.dispatchedAt = new Date().toISOString();
    this.serviceRequests.set(requestId, request);

    marketplaceLogger.init('Dispatch de requisição de serviço criado', {
      dispatch_id: dispatchId,
      request_id: requestId,
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
    const candidate = dispatch.candidates.find(c => c.provider_actor_id === providerActorId);
    if (!candidate) {
      throw new Error('Provider não é candidato deste dispatch');
    }

    const request = this.serviceRequests.get(dispatch.request_id);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Buscar pré-reservas do dispatch para este provider
    const preReservations = this.getPreReservationsByDispatch(dispatchId)
      .filter(pr => pr.provider_actor_id === providerActorId && pr.status === 'active');

    // Confirmar pré-reservas (virar ServiceBookings)
    const bookingIds: string[] = [];
    for (const preReservation of preReservations) {
      try {
        const confirmed = this.confirmPreReservation(preReservation.pre_reservation_id);
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
    dispatch.accepted_by = providerActorId;
    dispatch.acceptedAt = new Date().toISOString();
    this.serviceDispatches.set(dispatchId, dispatch);

    // Marcar requisição como aceita
    request.status = 'accepted';
    request.acceptedAt = new Date().toISOString();
    this.serviceRequests.set(dispatch.request_id, request);

    // Se intent for quote_required, criar ServiceVisit ao invés de ServiceBooking
    if (request.intent === 'quote_required') {
      // Criar ServiceVisit
      const visit = this.createServiceVisit({
        request_id: request.request_id,
        dispatch_id: dispatchId,
        provider_actor_id: providerActorId,
        scheduled_at: request.schedule.date || new Date().toISOString().split('T')[0],
        scheduled_at: '09:00', // Default, pode ser ajustado
      });

      // Registrar evento econômico
      try {
        if (typeof (this as any).generateEconomicEvent === 'function') {
          (this as any).generateEconomicEvent({
            type: 'service_visit_scheduled',
            region: { country: 'BR', state: 'PR', city: request.city },
            actor_id: providerActorId,
            actor_type: 'service_provider',
            reference_id: visit.visit_id,
            visibility: { scope: 'local' },
          });
        }
      } catch (err) {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('Visita de orçamento agendada', {
        visit_id: visit.visit_id,
        request_id: request.request_id,
        provider_actor_id: providerActorId,
      });

      // Retornar Order vazio (não há pagamento ainda)
      const storesData = this.getStores();
      const firstStore = storesData.stores[0];
      if (!firstStore) {
        throw new Error('Nenhuma loja disponível para criar order');
      }

      const emptyOrder = this.createOrder({
        store_id: providerActorId,
        items: [],
        channel: 'online',
        origin: 'marketplace',
      });

      return emptyOrder;
    }

    // Usar bookings já criados a partir das pré-reservas confirmadas
    // (já foram criados em acceptServiceDispatch)

    // Se não houver bookings (caso raro), criar manualmente
    let finalBookingIds = bookingIds;

    if (finalBookingIds.length === 0) {
      // Fallback: criar bookings manualmente (compatibilidade)
      const manualBookingIds: string[] = [];

      if (request.intent === 'now') {
        // Intent=now: reserva no slot atual (próximo slot disponível do dia)
        for (const item of request.service_items) {
        const offering = this.serviceOfferings.get(item.offering_id);
        if (!offering) {
          continue;
        }

        const today = new Date();
        const weekday = today.getDay();
        const availability = this.serviceAvailabilities.get(item.offering_id);
        const todayAvailability = availability?.find(a => a.weekday === weekday);

        if (todayAvailability) {
          // Criar booking para hoje, próximo horário disponível
          const booking = this.createServiceBooking({
            offering_id: item.offering_id,
            user_id: request.requester_actor_id,
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
      for (const item of request.service_items) {
        const scheduledDate = new Date(request.schedule.date);
        const weekday = scheduledDate.getDay();
        const availability = this.serviceAvailabilities.get(item.offering_id);
        const scheduledAvailability = availability?.find(a => a.weekday === weekday);

        if (scheduledAvailability) {
          const booking = this.createServiceBooking({
            offering_id: item.offering_id,
            user_id: request.requester_actor_id,
            date: request.schedule.date.split('T')[0],
            time: scheduledAvailability.starts_at,
            quantity: item.quantity,
          });

          manualBookingIds.push(booking.booking_id);
        }
      }
    } else if (request.intent === 'bundle') {
      // Intent=bundle
      if (request.constraints.allow_multiple_providers) {
        // Criar booking por item com provider possivelmente diferente
        for (const item of request.service_items) {
          // Usar provider que aceitou (ou primeiro candidato para este item)
          const itemCandidate = dispatch.candidates.find(c => c.offering_id === item.offering_id);
          if (itemCandidate) {
            const offering = this.serviceOfferings.get(item.offering_id);
            if (offering) {
              const booking = this.createServiceBooking({
                offering_id: item.offering_id,
                user_id: request.requester_actor_id,
                date: request.schedule.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                time: '09:00', // Default
                quantity: item.quantity,
              });

              manualBookingIds.push(booking.booking_id);
            }
          }
        }
      } else {
        // Exige provider que cubra todos os offering_id
        const allOfferingsCovered = request.service_items.every(item =>
          dispatch.candidates.some(c => c.offering_id === item.offering_id && c.provider_actor_id === providerActorId)
        );

        if (!allOfferingsCovered) {
          throw new Error('Provider não cobre todos os serviços do bundle');
        }

        // Criar bookings para todos os itens
        for (const item of request.service_items) {
          const offering = this.serviceOfferings.get(item.offering_id);
          if (offering) {
            const booking = this.createServiceBooking({
              offering_id: item.offering_id,
              user_id: request.requester_actor_id,
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
    userOrder = this.createOrder({
      store_id: providerActorId, // Usar provider como store (já que é serviço)
      items: [],
      channel: 'online',
      origin: 'marketplace',
    });

    // Confirmar bookings e adicionar ServiceOrders ao Order
    // (bookings já foram criados via confirmPreReservation ou fallback)
    for (const bookingId of finalBookingIds) {
      // Confirmar booking (cria ServiceOrder)
      const confirmed = this.confirmServiceBooking(bookingId);
      
      // Adicionar ServiceOrder ao Order
      this.addServiceOrderToOrder(userOrder.order_id, confirmed.order_id);
    }

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        const eventType = request.intent === 'bundle' ? 'bundle_service_booked' : 'service_request_accepted';
        (this as any).generateEconomicEvent({
          type: eventType,
          region: { country: 'BR', state: 'PR', city: request.city },
          actor_id: providerActorId,
          actor_type: 'service_provider',
          reference_id: dispatchId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Dispatch de serviço aceito', {
      dispatch_id: dispatchId,
      provider_actor_id: providerActorId,
      bookings_count: finalBookingIds.length,
      order_id: userOrder.order_id,
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

    if (request.intent === 'now' && request.schedule.max_wait_minutes) {
      const requestAge = (now.getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      if (requestAge > request.schedule.max_wait_minutes) {
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
      d => d.request_id === requestId && d.status === 'sent'
    );
    if (activeDispatch) {
      activeDispatch.status = 'expired';
      activeDispatch.expiredAt = new Date().toISOString();
      this.serviceDispatches.set(activeDispatch.dispatch_id, activeDispatch);
    }

    // Registrar evento econômico (restricted)
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_request_created', // Reutilizar tipo
          region: { country: 'BR', state: 'PR', city: request.city },
          actor_id: request.requester_actor_id,
          actor_type: 'user',
          reference_id: requestId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Requisição de serviço expirada', {
      request_id: requestId,
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
   * Provider Presences (in-memory)
   * Armazena presença/online de providers
   */
  private providerPresences: Map<string, ProviderPresence> = new Map(); // provider_actor_id -> presence

  /**
   * Dispatch Response Times (in-memory)
   * Armazena tempos de resposta a dispatches para cálculo de SLA
   */
  private dispatchResponseTimes: Map<string, {
    dispatch_id: string;
    provider_actor_id: string;
    request_id: string;
    sentAt: string;
    respondedAt?: string;
    response_time_minutes?: number;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
  }> = new Map(); // dispatch_id -> response_time

  /**
   * Atualizar presença de provider
   */
  updateProviderPresence(input: {
    provider_actor_id: string;
    status: 'online' | 'offline';
    region: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
    };
  }): ProviderPresence {
    const existingPresence = this.providerPresences.get(input.provider_actor_id);

    let presence: ProviderPresence;
    if (existingPresence) {
      presence = {
        ...existingPresence,
        status: input.status,
        region: input.region,
        last_seen: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      const presenceId = `presence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      presence = {
        presence_id: presenceId,
        provider_actor_id: input.provider_actor_id,
        status: input.status,
        region: input.region,
        last_seen: new Date().toISOString(),
        response_sla_metrics: {
          average_response_time_minutes: 0,
          total_dispatches_received: 0,
          total_dispatches_accepted: 0,
          total_dispatches_declined: 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    this.providerPresences.set(input.provider_actor_id, presence);

    // Atualizar status online (compatibilidade com código existente)
    this.providerOnlineStatus.set(input.provider_actor_id, input.status === 'online');

    marketplaceLogger.init('Presença de provider atualizada', {
      provider_actor_id: input.provider_actor_id,
      status: input.status,
    });

    return presence;
  }

  /**
   * Buscar presença de provider
   */
  getProviderPresence(providerActorId: string): ProviderPresence | null {
    return this.providerPresences.get(providerActorId) || null;
  }

  /**
   * Registrar dispatch enviado (para cálculo de SLA)
   */
  private recordDispatchSent(dispatchId: string, providerActorId: string, requestId: string): void {
    this.dispatchResponseTimes.set(dispatchId, {
      dispatch_id: dispatchId,
      provider_actor_id: providerActorId,
      request_id: requestId,
      sentAt: new Date().toISOString(),
      status: 'pending',
    });

    // Atualizar métricas de presença
    const presence = this.providerPresences.get(providerActorId);
    if (presence && presence.response_sla_metrics) {
      presence.response_sla_metrics.total_dispatches_received += 1;
      presence.updatedAt = new Date().toISOString();
      this.providerPresences.set(providerActorId, presence);
    }
  }

  /**
   * Registrar resposta a dispatch (aceito ou recusado)
   */
  recordDispatchResponse(dispatchId: string, status: 'accepted' | 'declined'): void {
    const responseTime = this.dispatchResponseTimes.get(dispatchId);
    if (!responseTime) {
      return;
    }

    const respondedAt = new Date().toISOString();
    const sentAt = new Date(responseTime.sentAt);
    const responseTimeMinutes = (new Date(respondedAt).getTime() - sentAt.getTime()) / (1000 * 60);

    responseTime.respondedAt = respondedAt;
    responseTime.response_time_minutes = responseTimeMinutes;
    responseTime.status = status;
    this.dispatchResponseTimes.set(dispatchId, responseTime);

    // Atualizar métricas de presença
    const presence = this.providerPresences.get(responseTime.provider_actor_id);
    if (presence && presence.response_sla_metrics) {
      if (status === 'accepted') {
        presence.response_sla_metrics.total_dispatches_accepted += 1;
      } else {
        presence.response_sla_metrics.total_dispatches_declined += 1;
      }

      // Calcular tempo médio de resposta
      const allResponses = Array.from(this.dispatchResponseTimes.values())
        .filter(rt => rt.provider_actor_id === responseTime.provider_actor_id && rt.response_time_minutes !== undefined);

      if (allResponses.length > 0) {
        const totalResponseTime = allResponses.reduce((sum, rt) => sum + (rt.response_time_minutes || 0), 0);
        presence.response_sla_metrics.average_response_time_minutes = totalResponseTime / allResponses.length;
        presence.response_sla_metrics.last_response_time_minutes = responseTimeMinutes;
      }

      presence.updatedAt = new Date().toISOString();
      this.providerPresences.set(responseTime.provider_actor_id, presence);
    }

    // Alimentar governança (SLA)
    this.recordServiceDispatchResponseEvent(responseTime.provider_actor_id, responseTimeMinutes, status);
  }

  /**
   * Registrar evento de resposta a dispatch (alimenta SLA/Reputation)
   */
  private recordServiceDispatchResponseEvent(
    providerActorId: string,
    responseTimeMinutes: number,
    status: 'accepted' | 'declined'
  ): void {
    // Registrar evento de ordem para tracking de SLA
    const existingEvents = this.orderEvents.get(providerActorId) || [];
    existingEvents.push({
      order_id: `dispatch-${Date.now()}`,
      actor_id: providerActorId,
      actor_type: 'service_provider',
      event_type: status === 'accepted' ? 'fulfilled' : 'cancelled',
      timestamp: new Date().toISOString(),
      fulfillment_time_hours: responseTimeMinutes / 60,
    });
    this.orderEvents.set(providerActorId, existingEvents);

    marketplaceLogger.init('Evento de resposta a dispatch registrado', {
      provider_actor_id: providerActorId,
      response_time_minutes: responseTimeMinutes,
      status,
    });
  }

  /**
   * Buscar métricas de SLA de resposta de um provider
   */
  getProviderResponseSLAMetrics(providerActorId: string): {
    average_response_time_minutes: number;
    total_dispatches_received: number;
    total_dispatches_accepted: number;
    total_dispatches_declined: number;
    acceptance_rate: number; // % de aceitação
    last_response_time_minutes?: number;
  } | null {
    const presence = this.providerPresences.get(providerActorId);
    if (!presence || !presence.response_sla_metrics) {
      return null;
    }

    const metrics = presence.response_sla_metrics;
    const acceptanceRate = metrics.total_dispatches_received > 0
      ? (metrics.total_dispatches_accepted / metrics.total_dispatches_received) * 100
      : 0;

    return {
      average_response_time_minutes: metrics.average_response_time_minutes,
      total_dispatches_received: metrics.total_dispatches_received,
      total_dispatches_accepted: metrics.total_dispatches_accepted,
      total_dispatches_declined: metrics.total_dispatches_declined,
      acceptance_rate: acceptanceRate,
      last_response_time_minutes: metrics.last_response_time_minutes,
    };
  }

  // ============================================================
  // APP DO PRESTADOR: INBOX DE DISPATCH
  // ============================================================

  /**
   * Buscar inbox de dispatches para um provider
   */
  getProviderDispatchInbox(providerActorId: string): Array<{
    dispatch_id: string;
    request_id: string;
    request_summary: {
      intent: 'now' | 'scheduled' | 'bundle';
      service_items: Array<{ offering_id: string; quantity: number }>;
      city: string;
      neighborhood?: string;
      schedule: {
        mode: 'now' | 'scheduled';
        date?: string;
        time?: string;
      };
    };
    pre_reservation?: {
      pre_reservation_id: string;
      date: string;
      time: string;
      expiresAt: string;
      status: 'active' | 'expired';
    };
    status: 'sent' | 'accepted' | 'declined' | 'expired';
    createdAt: string;
  }> {
    const inbox: Array<{
      dispatch_id: string;
      request_id: string;
      request_summary: any;
      pre_reservation?: any;
      status: string;
      createdAt: string;
    }> = [];

    // Buscar todos os dispatches onde o provider é candidato
    for (const dispatch of this.serviceDispatches.values()) {
      const candidate = dispatch.candidates.find(c => c.provider_actor_id === providerActorId);
      if (!candidate) {
        continue;
      }

      // Apenas dispatches ativos (sent)
      if (dispatch.status !== 'sent') {
        continue;
      }

      // Buscar request
      const request = this.serviceRequests.get(dispatch.request_id);
      if (!request) {
        continue;
      }

      // Buscar pré-reserva do provider para este dispatch
      const preReservations = this.getPreReservationsByDispatch(dispatch.dispatch_id)
        .filter(pr => pr.provider_actor_id === providerActorId);

      const activePreReservation = preReservations.find(pr => pr.status === 'active');

      // Determinar data/hora do serviço
      let serviceDate: string | undefined;
      let serviceTime: string | undefined;

      if (request.intent === 'scheduled' && request.schedule.date) {
        serviceDate = request.schedule.date.split('T')[0];
        const availability = this.serviceAvailabilities.get(candidate.offering_id);
        if (availability && availability.length > 0) {
          const scheduledDate = new Date(request.schedule.date);
          const weekday = scheduledDate.getDay();
          const scheduledSlot = availability.find(a => a.weekday === weekday);
          if (scheduledSlot) {
            serviceTime = scheduledSlot.starts_at;
          }
        }
      } else if (request.intent === 'now') {
        const today = new Date();
        serviceDate = today.toISOString().split('T')[0];
        const availability = this.serviceAvailabilities.get(candidate.offering_id);
        if (availability && availability.length > 0) {
          const todaySlot = availability.find(a => a.weekday === today.getDay());
          if (todaySlot) {
            serviceTime = todaySlot.starts_at;
          }
        }
      }

      inbox.push({
        dispatch_id: dispatch.dispatch_id,
        request_id: request.request_id,
        request_summary: {
          intent: request.intent,
          service_items: request.service_items,
          city: request.city,
          neighborhood: request.neighborhood,
          schedule: {
            mode: request.schedule.mode,
            date: serviceDate,
            time: serviceTime,
          },
        },
        pre_reservation: activePreReservation ? {
          pre_reservation_id: activePreReservation.pre_reservation_id,
          date: activePreReservation.date,
          time: activePreReservation.time,
          expiresAt: activePreReservation.expiresAt,
          status: activePreReservation.status,
        } : undefined,
        status: dispatch.status,
        createdAt: dispatch.createdAt,
      });
    }

    // Ordenar por createdAt (mais recente primeiro)
    inbox.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return inbox;
  }

  /**
   * Buscar status de dispatch para um provider específico
   */
  getDispatchStatusForProvider(dispatchId: string, providerActorId: string): {
    dispatch_id: string;
    provider_actor_id: string;
    is_eligible: boolean;
    pre_reservation_status?: 'active' | 'expired' | 'confirmed' | 'released';
    pre_reservation_expiresAt?: string;
    time_remaining_minutes?: number;
    already_accepted: boolean;
    accepted_by?: string;
  } {
    const dispatch = this.serviceDispatches.get(dispatchId);
    if (!dispatch) {
      throw new Error('Dispatch não encontrado');
    }

    const candidate = dispatch.candidates.find(c => c.provider_actor_id === providerActorId);
    const isEligible = !!candidate;

    // Buscar pré-reserva
    const preReservations = this.getPreReservationsByDispatch(dispatchId)
      .filter(pr => pr.provider_actor_id === providerActorId);

    const activePreReservation = preReservations.find(pr => pr.status === 'active');
    const confirmedPreReservation = preReservations.find(pr => pr.status === 'confirmed');

    let preReservationStatus: 'active' | 'expired' | 'confirmed' | 'released' | undefined;
    let expiresAt: string | undefined;
    let timeRemainingMinutes: number | undefined;

    if (activePreReservation) {
      preReservationStatus = 'active';
      expiresAt = activePreReservation.expiresAt;
      const now = new Date();
      const expires = new Date(activePreReservation.expiresAt);
      timeRemainingMinutes = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / (1000 * 60)));
    } else if (confirmedPreReservation) {
      preReservationStatus = 'confirmed';
    } else if (preReservations.length > 0) {
      const expired = preReservations.find(pr => pr.status === 'expired');
      if (expired) {
        preReservationStatus = 'expired';
      } else {
        preReservationStatus = 'released';
      }
    }

    return {
      dispatch_id: dispatchId,
      provider_actor_id: providerActorId,
      is_eligible: isEligible,
      pre_reservation_status: preReservationStatus,
      pre_reservation_expiresAt: expiresAt,
      time_remaining_minutes: timeRemainingMinutes,
      already_accepted: dispatch.status === 'accepted',
      accepted_by: dispatch.accepted_by,
    };
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
    request_id: string;
    service_items: Array<{ offering_id: string; quantity: number }>;
    createdAt: string;
  }>> = new Map(); // requester_actor_id -> requests

  /**
   * Criar pré-reserva temporária na agenda
   */
  private createPreReservation(input: {
    dispatch_id: string;
    request_id: string;
    provider_actor_id: string;
    offering_id: string;
    date: string;
    time: string;
    quantity: number;
    hold_duration_minutes?: number; // Padrão: 10 minutos
  }): ServicePreReservation {
    const holdDuration = input.hold_duration_minutes || 10;
    const expiresAt = new Date(Date.now() + holdDuration * 60 * 1000);

    const preReservationId = `pre-reservation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const preReservation: ServicePreReservation = {
      pre_reservation_id: preReservationId,
      dispatch_id: input.dispatch_id,
      request_id: input.request_id,
      provider_actor_id: input.provider_actor_id,
      offering_id: input.offering_id,
      date: input.date,
      time: input.time,
      quantity: input.quantity,
      hold_duration_minutes: holdDuration,
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
          actor_id: input.provider_actor_id,
          actor_type: 'service_provider',
          reference_id: preReservationId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Pré-reserva criada', {
      pre_reservation_id: preReservationId,
      dispatch_id: input.dispatch_id,
      provider_actor_id: input.provider_actor_id,
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
        b.offering_id === offeringId &&
        b.date === date &&
        b.time === time &&
        b.status !== 'cancelled'
      );

    const totalBooked = existingBookings.reduce((sum, b) => sum + b.quantity, 0);

    // Verificar pré-reservas ativas (hold)
    const activePreReservations = Array.from(this.servicePreReservations.values())
      .filter(pr =>
        pr.offering_id === offeringId &&
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
      provider_actor_id: string;
      offering_id: string;
      eligibility_reason: string;
      reputation_score?: number;
    }>,
    request: ServiceRequest
  ): Array<{
    provider_actor_id: string;
    offering_id: string;
    eligibility_reason: string;
    reputation_score?: number;
    sort_score: number; // Score determinístico para ordenação
  }> {
    return candidates.map(candidate => {
      const presence = this.providerPresences.get(candidate.provider_actor_id);
      
      // Calcular prioridade de matching baseada em métricas de governança
      const governancePriority = this.calculateMatchingPriority(candidate.provider_actor_id);
      const slaMetrics = this.getProviderResponseSLAMetrics(candidate.provider_actor_id);

      // Calcular score determinístico
      // 1. Disponibilidade exata do slot (já validado, score = 1 se disponível)
      let sortScore = 1;

      // 2. Menor distância lógica (bairro = 2, cidade = 1)
      if (request.constraints.provider_radius_mode === 'same_neighborhood') {
        sortScore += 2;
      } else {
        sortScore += 1;
      }

      // 3. Melhor SLA de resposta (menor tempo médio = maior score)
      if (slaMetrics) {
        // Inverter tempo médio (menor tempo = maior score)
        // Normalizar: 0-60 minutos -> 0-10 pontos
        const responseTimeScore = Math.max(0, 10 - (slaMetrics.average_response_time_minutes / 6));
        sortScore += responseTimeScore;
      }

      // 4. Maior taxa de aceitação
      if (slaMetrics) {
        // Taxa de aceitação: 0-100% -> 0-5 pontos
        sortScore += (slaMetrics.acceptance_rate / 20);
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
      return a.provider_actor_id.localeCompare(b.provider_actor_id);
    });
  }

  /**
   * Verificar anti-spam (usuário não pode criar múltiplas requests simultâneas iguais)
   */
  private checkAntiSpam(requesterActorId: string, serviceItems: Array<{ offering_id: string; quantity: number }>): boolean {
    const userHistory = this.userRequestHistory.get(requesterActorId) || [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Verificar se há request recente com os mesmos itens
    const recentDuplicate = userHistory.find(req => {
      if (new Date(req.createdAt) < fiveMinutesAgo) {
        return false;
      }

      // Comparar service_items
      if (req.service_items.length !== serviceItems.length) {
        return false;
      }

      const itemsMatch = req.service_items.every(item1 =>
        serviceItems.some(item2 =>
          item1.offering_id === item2.offering_id && item1.quantity === item2.quantity
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
    if (slaMetrics.total_dispatches_received > 10 && slaMetrics.acceptance_rate < 30) {
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
      if (!this.checkProviderAbuse(candidate.provider_actor_id)) {
        continue;
      }

      // Buscar offering
      const offering = this.serviceOfferings.get(candidate.offering_id);
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
        const availability = this.serviceAvailabilities.get(candidate.offering_id);
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
        const availability = this.serviceAvailabilities.get(candidate.offering_id);
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
      const requestItem = request.service_items.find(item => item.offering_id === candidate.offering_id);
      if (!requestItem) {
        continue;
      }

      // Verificar se slot está disponível (sem conflito)
      if (!this.isSlotAvailable(candidate.offering_id, targetDate, targetTime, requestItem.quantity)) {
        continue; // Slot não disponível
      }

      // Criar pré-reserva
      const preReservation = this.createPreReservation({
        dispatch_id: dispatchId,
        request_id: request.request_id,
        provider_actor_id: candidate.provider_actor_id,
        offering_id: candidate.offering_id,
        date: targetDate,
        time: targetTime,
        quantity: requestItem.quantity,
        hold_duration_minutes: 10, // Padrão: 10 minutos
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
    pre_reservation_id: string;
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
    const request = this.serviceRequests.get(preReservation.request_id);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    const booking = this.createServiceBooking({
      offering_id: preReservation.offering_id,
      user_id: request.requester_actor_id,
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
          actor_id: preReservation.provider_actor_id,
          actor_type: 'service_provider',
          reference_id: preReservationId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('Pré-reserva confirmada', {
      pre_reservation_id: preReservationId,
      booking_id: booking.booking_id,
    });

    return {
      booking_id: booking.booking_id,
      pre_reservation_id: preReservationId,
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
        this.servicePreReservations.set(preReservation.pre_reservation_id, preReservation);
        expiredPreReservations.push(preReservation);

        // Registrar evento econômico (restricted)
        try {
          if (typeof (this as any).generateEconomicEvent === 'function') {
            (this as any).generateEconomicEvent({
              type: 'service_pre_reservation_expired',
              region: { country: 'BR', state: 'PR', city: 'Curitiba' }, // TODO: obter da request
              actor_id: preReservation.provider_actor_id,
              actor_type: 'service_provider',
              reference_id: preReservation.pre_reservation_id,
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
      .filter(pr => pr.dispatch_id === dispatchId);
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
      actor_id?: string;
      payload?: any;
    }> = [];

    // Evento: service_request_created
    timeline.push({
      type: 'service_request_created',
      timestamp: request.createdAt,
      actor_id: request.requester_actor_id,
      payload: {
        intent: request.intent,
        service_items: request.service_items,
        city: request.city,
        neighborhood: request.neighborhood,
      },
    });

    // Buscar dispatches relacionados
    const dispatches = Array.from(this.serviceDispatches.values())
      .filter(d => d.request_id === requestId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const dispatch of dispatches) {
      // Evento: service_dispatch_sent
      timeline.push({
        type: 'service_dispatch_sent',
        timestamp: dispatch.createdAt,
        payload: {
          dispatch_id: dispatch.dispatch_id,
          candidates_count: dispatch.candidates.length,
          candidates: dispatch.candidates.map(c => ({
            provider_actor_id: c.provider_actor_id,
            offering_id: c.offering_id,
          })),
        },
      });

      // Buscar pré-reservas deste dispatch
      const preReservations = this.getPreReservationsByDispatch(dispatch.dispatch_id);
      for (const preReservation of preReservations) {
        // Evento: service_pre_reservation_created
        timeline.push({
          type: 'service_pre_reservation_created',
          timestamp: preReservation.createdAt,
          actor_id: preReservation.provider_actor_id,
          payload: {
            pre_reservation_id: preReservation.pre_reservation_id,
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
            actor_id: preReservation.provider_actor_id,
            payload: {
              pre_reservation_id: preReservation.pre_reservation_id,
            },
          });
        }

        // Se confirmada
        if (preReservation.status === 'confirmed' && preReservation.confirmedAt) {
          timeline.push({
            type: 'service_pre_reservation_confirmed',
            timestamp: preReservation.confirmedAt,
            actor_id: preReservation.provider_actor_id,
            payload: {
              pre_reservation_id: preReservation.pre_reservation_id,
            },
          });
        }
      }

      // Se dispatch foi recusado
      if (dispatch.status === 'declined') {
        timeline.push({
          type: 'service_dispatch_declined',
          timestamp: dispatch.expiredAt || dispatch.createdAt,
          actor_id: dispatch.accepted_by, // Provider que recusou (se houver)
          payload: {
            dispatch_id: dispatch.dispatch_id,
          },
        });
      }

      // Se dispatch foi aceito
      if (dispatch.status === 'accepted' && dispatch.acceptedAt) {
        timeline.push({
          type: 'service_dispatch_accepted',
          timestamp: dispatch.acceptedAt,
          actor_id: dispatch.accepted_by,
          payload: {
            dispatch_id: dispatch.dispatch_id,
          },
        });
      }
    }

    // Buscar bookings relacionados
    // Buscar via dispatches aceitos
    const acceptedDispatches = dispatches.filter(d => d.status === 'accepted');
    const bookings: any[] = [];
    
    for (const dispatch of acceptedDispatches) {
      const preReservations = this.getPreReservationsByDispatch(dispatch.dispatch_id);
      const confirmedPreReservation = preReservations.find(pr => pr.status === 'confirmed');
      
      if (confirmedPreReservation) {
        // Buscar booking criado a partir desta pré-reserva
        const relatedBookings = Array.from(this.serviceBookings.values())
          .filter(b =>
            b.offering_id === confirmedPreReservation.offering_id &&
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
        const relatedBooking = bookings.find(b => b.booking_id === so.booking_id);
        return !!relatedBooking;
      });

    for (const serviceOrder of serviceOrders) {
      // Buscar order pai (serviceOrder.order_id é o order_id)
      const parentOrder = this.orders.get(serviceOrder.order_id);

      if (parentOrder) {
        timeline.push({
          type: 'order_created',
          timestamp: parentOrder.createdAt,
          payload: {
            order_id: parentOrder.order_id,
            totalCents: parentOrder.totalCents,
          },
        });

        // Verificar se order foi pago (via checkout/payment plan)
        const checkout = Array.from(this.checkouts.values())
          .find(c => c.orders.some(o => o.order_id === parentOrder.order_id));

        if (checkout && checkout.status === 'paid') {
          timeline.push({
            type: 'order_paid',
            timestamp: checkout.paidAt || checkout.createdAt,
            payload: {
              checkout_id: checkout.checkout_id,
              order_id: parentOrder.order_id,
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
          request_id: requestId,
        },
      });
    }

    // Se request foi completada
    if (request.status === 'completed' && (request as any).completedAt) {
      timeline.push({
        type: 'service_completed',
        timestamp: (request as any).completedAt,
        payload: {
          request_id: requestId,
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
    request_id: string;
    status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
    intent: 'now' | 'scheduled' | 'bundle';
    provider?: {
      provider_actor_id: string;
      confirmedAt: string;
    };
    confirmed_schedule?: {
      date: string;
      time: string;
    };
    service_items: Array<{ offering_id: string; quantity: number }>;
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
        .find(d => d.request_id === requestId && d.status === 'accepted');

      if (acceptedDispatch && acceptedDispatch.accepted_by) {
        // Buscar pré-reserva confirmada (via dispatch_id)
        const preReservations = this.getPreReservationsByDispatch(acceptedDispatch.dispatch_id);
        const confirmedPreReservation = preReservations.find(pr =>
          pr.provider_actor_id === acceptedDispatch.accepted_by &&
          pr.status === 'confirmed'
        );

        if (confirmedPreReservation) {
          // Buscar booking confirmado
          const confirmedBooking = Array.from(this.serviceBookings.values())
            .find(b =>
              b.offering_id === confirmedPreReservation.offering_id &&
              b.date === confirmedPreReservation.date &&
              b.time === confirmedPreReservation.time &&
              b.status === 'confirmed'
            );

          if (confirmedBooking) {
            // Verificar se order foi criado e pago
            const serviceOrder = Array.from(this.serviceOrders.values())
              .find(so => so.booking_id === confirmedBooking.booking_id);

            if (serviceOrder) {
              const parentOrder = this.orders.get(serviceOrder.order_id);

              if (parentOrder) {
                const checkout = Array.from(this.checkouts.values())
                  .find(c => c.orders.some(o => o.order_id === parentOrder.order_id));

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
    let provider: { provider_actor_id: string; confirmedAt: string } | undefined;
    const acceptedDispatch = Array.from(this.serviceDispatches.values())
      .find(d => d.request_id === requestId && d.status === 'accepted');

    if (acceptedDispatch && acceptedDispatch.accepted_by && acceptedDispatch.acceptedAt) {
      provider = {
        provider_actor_id: acceptedDispatch.accepted_by,
        confirmedAt: acceptedDispatch.acceptedAt,
      };
    }

    // Buscar horário confirmado
    let confirmedSchedule: { date: string; time: string } | undefined;
    if (acceptedDispatch && acceptedDispatch.accepted_by) {
      const preReservations = this.getPreReservationsByDispatch(acceptedDispatch.dispatch_id);
      const confirmedPreReservation = preReservations.find(pr =>
        pr.provider_actor_id === acceptedDispatch.accepted_by &&
        pr.status === 'confirmed'
      );

      if (confirmedPreReservation) {
        confirmedSchedule = {
          date: confirmedPreReservation.date,
          time: confirmedPreReservation.time,
        };
      }
    }

    return {
      request_id: requestId,
      status: currentStatus,
      intent: request.intent,
      provider,
      confirmed_schedule: confirmedSchedule,
      service_items: request.service_items,
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
   * Service Governance Metrics (in-memory)
   * Armazena métricas de governança por provider
   */
  private serviceGovernanceMetrics: Map<string, ServiceGovernanceMetrics> = new Map(); // provider_actor_id -> metrics

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
      hold_id: holdId,
      request_id: requestId,
      payment_plan_id: paymentPlanId,
      amount,
      currency,
      status: 'held',
      createdAt: now.toISOString(),
      release_deadlineAt: deadline.toISOString(),
      release_policy: releasePolicy,
    };

    this.servicePaymentHolds.set(holdId, hold);

    marketplaceLogger.init('Payment hold criado para serviço', {
      hold_id: holdId,
      request_id: requestId,
      payment_plan_id: paymentPlanId,
      amount,
      release_policy: releasePolicy,
    });

    return hold;
  }

  /**
   * Buscar payment hold por request_id
   */
  getServicePaymentHoldByRequest(requestId: string): ServicePaymentHold | null {
    const hold = Array.from(this.servicePaymentHolds.values())
      .find(h => h.request_id === requestId && h.status === 'held');
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
      signal_id: signalId,
      request_id: requestId,
      actor_id: actorId,
      role,
      action,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.serviceCompletionSignals.set(signalId, signal);

    marketplaceLogger.init('Sinal de conclusão criado', {
      signal_id: signalId,
      request_id: requestId,
      actor_id: actorId,
      role,
      action,
    });

    return signal;
  }

  /**
   * Confirmar conclusão do serviço (customer)
   */
  confirmServiceCompletedByCustomer(requestId: string, customerActorId: string): {
    hold_id: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Validar que é o customer
    if (request.requester_actor_id !== customerActorId) {
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
    return this.releaseServicePaymentHold(hold.hold_id, customerActorId);
  }

  /**
   * Confirmar conclusão do serviço (provider)
   */
  confirmServiceCompletedByProvider(requestId: string, providerActorId: string): {
    hold_id: string;
    releasedAt: string;
    status: 'released';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Buscar dispatch aceito
    const acceptedDispatch = Array.from(this.serviceDispatches.values())
      .find(d => d.request_id === requestId && d.status === 'accepted');

    if (!acceptedDispatch || acceptedDispatch.accepted_by !== providerActorId) {
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
    if (hold.release_policy === 'provider_confirm_with_proof') {
      return this.releaseServicePaymentHold(hold.hold_id, providerActorId);
    }

    // Para outras políticas, apenas registrar sinal
    // (release só via customer ou auto)
    throw new Error('Provider não pode liberar pagamento diretamente nesta política');
  }

  /**
   * Disputar serviço
   */
  disputeService(requestId: string, actorId: string, role: 'customer' | 'provider', reason: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'): {
    hold_id: string;
    dispute_case_id: string;
    status: 'disputed';
  } {
    const request = this.serviceRequests.get(requestId);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    // Validar role
    if (role === 'customer' && request.requester_actor_id !== actorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode disputar');
    }

    if (role === 'provider') {
      const acceptedDispatch = Array.from(this.serviceDispatches.values())
        .find(d => d.request_id === requestId && d.status === 'accepted');
      if (!acceptedDispatch || acceptedDispatch.accepted_by !== actorId) {
        throw new Error('Apenas o provider que aceitou o serviço pode disputar');
      }
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
          order_id: requestId, // Usar request_id como referência
          actor_involved: [request.requester_actor_id, acceptedDispatch?.accepted_by].filter(Boolean) as string[],
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
    hold.dispute_case_id = disputeCaseId;
    this.servicePaymentHolds.set(hold.hold_id, hold);

    marketplaceLogger.init('Payment hold marcado como disputado', {
      hold_id: hold.hold_id,
      request_id: requestId,
      dispute_case_id: disputeCaseId,
    });

    return {
      hold_id: hold.hold_id,
      dispute_case_id: disputeCaseId,
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
      if (hold.status === 'held' && new Date(hold.release_deadlineAt) <= now) {
        // Verificar se há disputa
        const hasDispute = Array.from(this.serviceCompletionSignals.values())
          .some(s => s.request_id === hold.request_id && s.action === 'dispute');

        if (!hasDispute) {
          // Auto-release
          try {
            this.releaseServicePaymentHold(hold.hold_id, 'auto');
            releasedCount++;
          } catch (err) {
            // Se falhar, marcar como expirado
            hold.status = 'expired';
            this.servicePaymentHolds.set(hold.hold_id, hold);
            expiredCount++;
          }
        } else {
          // Se houver disputa, não libera automaticamente
          hold.status = 'expired';
          this.servicePaymentHolds.set(hold.hold_id, hold);
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
    hold_id: string;
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
    const paymentPlan = this.paymentPlans.get(hold.payment_plan_id);
    if (!paymentPlan) {
      throw new Error('PaymentPlan não encontrado');
    }

    // Se payment plan já foi executado, apenas marcar hold como released
    // (o dinheiro já está retido na plataforma)
    if (paymentPlan.status === 'executed') {
      const releasedAt = new Date().toISOString();
      hold.status = 'released';
      hold.releasedAt = releasedAt;
      hold.released_by = releasedBy;
      this.servicePaymentHolds.set(holdId, hold);

      // Executar splits finais (debitar da plataforma, creditar targets)
      // Por enquanto, apenas marcar como released
      // (em produção, aqui seria a lógica de ledger para liberar os splits)

      marketplaceLogger.init('Payment hold liberado', {
        hold_id: holdId,
        payment_plan_id: hold.payment_plan_id,
        released_by: releasedBy,
      });

      return {
        hold_id: holdId,
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
    request_id: string;
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
      .find(d => d.request_id === requestId && d.status === 'accepted');

    if (!acceptedDispatch || !acceptedDispatch.accepted_by) {
      throw new Error('Nenhum provider aceito encontrado para este serviço');
    }

    // Validar que completedBy é o provider que aceitou
    if (completedBy !== acceptedDispatch.accepted_by) {
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
          actor_id: completedBy,
          actor_type: 'service_provider',
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
      request_id: requestId,
      provider_actor_id: completedBy,
      completedAt: completedAt,
    });

    return {
      request_id: requestId,
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
    request_id: string;
    dispatch_id: string;
    provider_actor_id: string;
    scheduled_at: string;
    scheduled_at: string;
  }): ServiceVisit {
    const visitId = `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const visit: ServiceVisit = {
      visit_id: visitId,
      request_id: input.request_id,
      dispatch_id: input.dispatch_id,
      provider_actor_id: input.provider_actor_id,
      scheduled_at: input.scheduled_at,
      scheduled_at: input.scheduled_at,
      status: 'visit_scheduled',
      createdAt: new Date().toISOString(),
    };

    this.serviceVisits.set(visitId, visit);

    marketplaceLogger.init('ServiceVisit criada', {
      visit_id: visitId,
      request_id: input.request_id,
      provider_actor_id: input.provider_actor_id,
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
      visit.provider_actor_id,
      startDate.toISOString(),
      endDate.toISOString()
    );

    marketplaceLogger.init('Visita marcada como completa', {
      visit_id: visitId,
    });

    return visit;
  }

  /**
   * Buscar visitas por request_id
   */
  getServiceVisitsByRequest(requestId: string): ServiceVisit[] {
    return Array.from(this.serviceVisits.values())
      .filter(v => v.request_id === requestId);
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
    request_id: string;
    visit_id: string;
    provider_actor_id: string;
    service_value: { amountCents: number; currency: string };
    description: string;
    requires_materials: boolean;
    execution_date?: string;
    execution_time?: string;
  }): ServiceQuote {
    const visit = this.serviceVisits.get(input.visit_id);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }

    if (visit.status !== 'visit_completed') {
      throw new Error('Visita precisa estar completa para enviar orçamento');
    }

    if (visit.provider_actor_id !== input.provider_actor_id) {
      throw new Error('Apenas o provider que realizou a visita pode enviar orçamento');
    }

    // Verificar se já existe quote pendente para esta visita
    const existingQuote = Array.from(this.serviceQuotes.values())
      .find(q => q.visit_id === input.visit_id && q.status === 'pending');
    if (existingQuote) {
      throw new Error('Já existe um orçamento pendente para esta visita');
    }

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const quote: ServiceQuote = {
      quote_id: quoteId,
      request_id: input.request_id,
      visit_id: input.visit_id,
      provider_actor_id: input.provider_actor_id,
      service_value: input.service_value,
      description: input.description,
      requires_materials: input.requires_materials,
      execution_date: input.execution_date,
      execution_time: input.execution_time,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.serviceQuotes.set(quoteId, quote);

    // Atualizar métricas de governança
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.calculateServiceGovernanceMetrics(
      input.provider_actor_id,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_quote_sent',
          region: { country: 'BR', state: 'PR', city: 'Curitiba' }, // TODO: obter da request
          actor_id: input.provider_actor_id,
          actor_type: 'service_provider',
          reference_id: quoteId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('ServiceQuote criado', {
      quote_id: quoteId,
      request_id: input.request_id,
      visit_id: input.visit_id,
      service_value: input.service_value,
    });

    return quote;
  }

  /**
   * Aceitar ServiceQuote (gera ServiceBooking + ServiceOrder + PaymentHold)
   */
  acceptServiceQuote(quoteId: string, customerActorId: string): {
    quote_id: string;
    booking_id: string;
    order_id: string;
    payment_hold_id: string;
  } {
    const quote = this.serviceQuotes.get(quoteId);
    if (!quote) {
      throw new Error('Orçamento não encontrado');
    }

    if (quote.status !== 'pending') {
      throw new Error(`Orçamento não está em status 'pending' (status atual: ${quote.status})`);
    }

    const request = this.serviceRequests.get(quote.request_id);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.requester_actor_id !== customerActorId) {
      throw new Error('Apenas o cliente que solicitou o serviço pode aceitar o orçamento');
    }

    // Buscar visit
    const visit = this.serviceVisits.get(quote.visit_id);
    if (!visit) {
      throw new Error('Visita não encontrada');
    }

    // Criar ServiceBooking
    const booking = this.createServiceBooking({
      offering_id: request.service_items[0].offering_id, // Usar primeiro item
      user_id: customerActorId,
      date: quote.execution_date || visit.scheduled_at,
      time: quote.execution_time || visit.scheduled_at,
      quantity: request.service_items[0].quantity,
    });

    // Confirmar booking (cria ServiceOrder)
    const confirmed = this.confirmServiceBooking(booking.booking_id);

    // Criar Order
    const order = this.createOrder({
      store_id: quote.provider_actor_id,
      items: [{
        product_id: confirmed.order_id, // ServiceOrder ID
        name: `Serviço - ${quote.description}`,
        price: quote.service_value,
        quantity: 1,
        subtotal: quote.service_value.amount,
      }],
      channel: 'online',
      origin: 'marketplace',
    });

    // Criar Checkout
    const checkout = this.createCheckoutFromOrder(order.order_id);

    // Confirmar Checkout
    this.confirmCheckout(checkout.checkout_id);

    // Criar PaymentPlan
    const paymentPlan = this.createPaymentPlan(checkout.checkout_id, 'balance'); // Default balance

    // PaymentHold será criado automaticamente pelo createPaymentPlan se for serviço

    // Marcar quote como aceito
    quote.status = 'accepted';
    quote.acceptedAt = new Date().toISOString();
    quote.booking_id = booking.booking_id;
    quote.order_id = order.order_id;
    this.serviceQuotes.set(quoteId, quote);

    // Atualizar métricas de governança
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.calculateServiceGovernanceMetrics(
      quote.provider_actor_id,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_quote_accepted',
          region: { country: 'BR', state: 'PR', city: request.city },
          actor_id: customerActorId,
          actor_type: 'user',
          reference_id: quoteId,
          visibility: { scope: 'local' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    // Buscar payment hold criado
    const hold = this.getServicePaymentHoldByRequest(quote.request_id);

    marketplaceLogger.init('ServiceQuote aceito', {
      quote_id: quoteId,
      booking_id: booking.booking_id,
      order_id: order.order_id,
      payment_plan_id: paymentPlan.payment_plan_id,
    });

    return {
      quote_id: quoteId,
      booking_id: booking.booking_id,
      order_id: order.order_id,
      payment_hold_id: hold?.hold_id || '',
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

    const request = this.serviceRequests.get(quote.request_id);
    if (!request) {
      throw new Error('Requisição não encontrada');
    }

    if (request.requester_actor_id !== customerActorId) {
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
      quote.provider_actor_id,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Registrar evento econômico
    try {
      if (typeof (this as any).generateEconomicEvent === 'function') {
        (this as any).generateEconomicEvent({
          type: 'service_quote_declined',
          region: { country: 'BR', state: 'PR', city: request.city },
          actor_id: customerActorId,
          actor_type: 'user',
          reference_id: quoteId,
          visibility: { scope: 'restricted' },
        });
      }
    } catch (err) {
      // Ignorar se método não existir
    }

    marketplaceLogger.init('ServiceQuote recusado', {
      quote_id: quoteId,
    });

    return quote;
  }

  /**
   * Buscar quotes por request_id
   */
  getServiceQuotesByRequest(requestId: string): ServiceQuote[] {
    return Array.from(this.serviceQuotes.values())
      .filter(q => q.request_id === requestId);
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
        if (v.provider_actor_id !== providerActorId) return false;
        const visitDate = new Date(v.createdAt);
        return visitDate >= start && visitDate <= end;
      });

    // Buscar todos os quotes do provider no período
    const quotes = Array.from(this.serviceQuotes.values())
      .filter(q => {
        if (q.provider_actor_id !== providerActorId) return false;
        const quoteDate = new Date(q.createdAt);
        return quoteDate >= start && quoteDate <= end;
      });

    // Calcular métricas
    const visitas_completadas = visits.filter(v => v.status === 'visit_completed').length;
    const visitas_sem_orcamento = visits.filter(v => {
      const hasQuote = quotes.some(q => q.visit_id === v.visit_id);
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
    const warnings_count = existingMetrics?.warnings_count || 0;
    const sla_violations_count = existingMetrics?.sla_violations_count || 0;
    const trust_downgrades_count = existingMetrics?.trust_downgrades_count || 0;

    const metrics: ServiceGovernanceMetrics = {
      provider_actor_id: providerActorId,
      category_id: categoryId,
      period: {
        starts_at: startDate,
        ends_at: endDate,
      },
      visitas_sem_orcamento,
      orcamentos_enviados,
      orcamentos_aceitos,
      orcamentos_recusados,
      orcamentos_expirados,
      taxa_quote_to_execution,
      status,
      warnings_count: status === 'warning' ? warnings_count + 1 : warnings_count,
      sla_violations_count: status === 'sla_violation' ? sla_violations_count + 1 : sla_violations_count,
      trust_downgrades_count,
      calculatedAt: new Date().toISOString(),
      last_warningAt: status === 'warning' ? new Date().toISOString() : existingMetrics?.last_warningAt,
      last_sla_violationAt: status === 'sla_violation' ? new Date().toISOString() : existingMetrics?.last_sla_violationAt,
      last_trust_downgradeAt: existingMetrics?.last_trust_downgradeAt,
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
    if (metrics.status === 'warning' && metrics.warnings_count === 1) {
      marketplaceLogger.init('Warning de governança aplicado', {
        provider_actor_id: providerActorId,
        taxa_visitas_sem_orcamento: metrics.visitas_sem_orcamento,
      });
    }

    // SLA Violation: registrar no SLAContract
    if (metrics.status === 'sla_violation') {
      try {
        if (typeof (this as any).recordOrderEvent === 'function') {
          (this as any).recordOrderEvent({
            actor_id: providerActorId,
            event_type: 'service_governance_sla_violation',
            metadata: {
              visitas_sem_orcamento: metrics.visitas_sem_orcamento,
              taxa_visitas_sem_orcamento: metrics.visitas_sem_orcamento / (metrics.orcamentos_enviados + metrics.visitas_sem_orcamento) * 100,
            },
          });
        }
      } catch (err) {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('SLA violation de governança registrada', {
        provider_actor_id: providerActorId,
        sla_violations_count: metrics.sla_violations_count,
      });
    }

    // Trust Downgrade: apenas se reincidente (nunca automático de primeira)
    if (metrics.sla_violations_count >= 2 && metrics.status === 'sla_violation') {
      try {
        if (typeof (this as any).downgradeTrustLevel === 'function') {
          (this as any).downgradeTrustLevel(providerActorId, 'service_governance_recurring_violation');
          metrics.trust_downgrades_count += 1;
          metrics.last_trust_downgradeAt = new Date().toISOString();
          this.serviceGovernanceMetrics.set(providerActorId, metrics);
        }
      } catch (err) {
        // Ignorar se método não existir
      }

      marketplaceLogger.init('Trust downgrade aplicado por governança', {
        provider_actor_id: providerActorId,
        trust_downgrades_count: metrics.trust_downgrades_count,
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
    template_id: string;
    template_type: 'product' | 'service';
    category_id: string;
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
        template_id: 'prod-template-rice-1kg',
        name: 'Arroz Tipo 1 (1kg)',
        description: 'Arroz branco tipo 1, pacote de 1kg',
        category_id: 'cat-supermarket',
        type: 'industrialized',
        default_unit: 'pacote',
        canonical_images: {
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
        template_id: 'prod-template-beans-1kg',
        name: 'Feijão Preto (1kg)',
        description: 'Feijão preto, pacote de 1kg',
        category_id: 'cat-supermarket',
        type: 'industrialized',
        default_unit: 'pacote',
        canonical_images: {
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
        template_id: 'prod-template-oil-900ml',
        name: 'Óleo de Soja (900ml)',
        description: 'Óleo de soja refinado, garrafa de 900ml',
        category_id: 'cat-supermarket',
        type: 'industrialized',
        default_unit: 'garrafa',
        canonical_images: {
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
        template_id: 'prod-template-paracetamol',
        name: 'Paracetamol 500mg',
        description: 'Paracetamol comprimidos 500mg, caixa com 20 comprimidos',
        category_id: 'cat-medicines',
        type: 'industrialized',
        default_unit: 'caixa',
        canonical_images: {
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
        template_id: 'prod-template-ibuprofen',
        name: 'Ibuprofeno 400mg',
        description: 'Ibuprofeno comprimidos 400mg, caixa com 20 comprimidos',
        category_id: 'cat-medicines',
        type: 'industrialized',
        default_unit: 'caixa',
        canonical_images: {
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
        template_id: 'prod-template-beer-350ml',
        name: 'Cerveja (350ml)',
        description: 'Cerveja lata 350ml',
        category_id: 'cat-beverages',
        type: 'industrialized',
        default_unit: 'lata',
        canonical_images: {
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
        template_id: 'prod-template-soda-2l',
        name: 'Refrigerante (2L)',
        description: 'Refrigerante garrafa 2 litros',
        category_id: 'cat-beverages',
        type: 'industrialized',
        default_unit: 'garrafa',
        canonical_images: {
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
        template_id: 'prod-template-cement-50kg',
        name: 'Cimento (50kg)',
        description: 'Cimento Portland, saco de 50kg',
        category_id: 'cat-construction',
        type: 'industrialized',
        default_unit: 'saco',
        canonical_images: {
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
        template_id: 'prod-template-brick',
        name: 'Tijolo Comum',
        description: 'Tijolo cerâmico comum',
        category_id: 'cat-construction',
        type: 'industrialized',
        default_unit: 'milheiro',
        canonical_images: {
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
      this.productTemplates.set(template.template_id, template);
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
        template_id: 'service-template-delivery',
        name: 'Entrega',
        description: 'Serviço de entrega de produtos',
        category_id: 'cat-delivery',
        type: 'one_time',
        default_duration_minutes: 60,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-prescription',
        name: 'Prescrição Médica',
        description: 'Serviço de prescrição e orientação farmacêutica',
        category_id: 'cat-health',
        type: 'one_time',
        default_duration_minutes: 15,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-consultation',
        name: 'Consulta Médica',
        description: 'Consulta médica geral',
        category_id: 'cat-health',
        type: 'one_time',
        default_duration_minutes: 30,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-exam',
        name: 'Exame Médico',
        description: 'Exame médico geral',
        category_id: 'cat-health',
        type: 'quote_required',
        default_duration_minutes: 60,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-gym-membership',
        name: 'Mensalidade de Academia',
        description: 'Plano mensal de academia',
        category_id: 'cat-fitness',
        type: 'recurring',
        default_duration_minutes: null,
        default_pricing_model: 'fixed',
        canonical_images: {
          icon: '/templates/services/gym-icon.png',
          banner: '/templates/services/gym-banner.png',
        },
        attributes: {
          billing_cycle: 'monthly',
        },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        template_id: 'service-template-personal-training',
        name: 'Personal Trainer',
        description: 'Aula particular de personal trainer',
        category_id: 'cat-fitness',
        type: 'one_time',
        default_duration_minutes: 60,
        default_pricing_model: 'hourly',
        canonical_images: {
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
        template_id: 'service-template-haircut',
        name: 'Corte de Cabelo',
        description: 'Corte de cabelo masculino/feminino',
        category_id: 'cat-beauty',
        type: 'one_time',
        default_duration_minutes: 45,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-manicure',
        name: 'Manicure',
        description: 'Serviço de manicure',
        category_id: 'cat-beauty',
        type: 'one_time',
        default_duration_minutes: 60,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-facial',
        name: 'Limpeza de Pele',
        description: 'Limpeza de pele facial',
        category_id: 'cat-beauty',
        type: 'one_time',
        default_duration_minutes: 90,
        default_pricing_model: 'fixed',
        canonical_images: {
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
        template_id: 'service-template-catering',
        name: 'Buffet/Catering',
        description: 'Serviço de buffet e catering para eventos',
        category_id: 'cat-food',
        type: 'quote_required',
        default_duration_minutes: null,
        default_pricing_model: 'per_unit',
        canonical_images: {
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
      this.serviceTemplatesCanonical.set(template.template_id, template);
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
    template_id: string;
    usage_count: number;
    last_usedAt: string;
    companies: string[]; // IDs de empresas que usam este template
  }> = new Map(); // template_id -> audit

  /**
   * Company Activation States (in-memory)
   * Estados de ativação guiada por empresa
   */
  private companyActivationStates: Map<string, {
    company_id: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdv_enabled: boolean;
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
        template_id: 'supermarket',
        name: 'Supermercado',
        description: 'Supermercado com produtos industrializados e próprios',
        type: 'supermarket',
        version: 'v2.0',
        category_ids: ['cat-supermarket'],
        allowed_product_types: 'both',
        default_product_templates: [
          'prod-template-rice-1kg',
          'prod-template-beans-1kg',
          'prod-template-oil-900ml',
        ],
        default_service_templates: ['service-template-delivery'],
        operational_config: {
          requires_agenda: false,
          supports_dispatch: true,
          supports_quote_flow: false,
          supports_pdv: true,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'sales'],
        recommended_plan: 'Basic',
        canonical_images: {
          logo: '/templates/business/supermarket-logo.png',
          banner: '/templates/business/supermarket-banner.png',
          icon: '/templates/business/supermarket-icon.png',
        },
        flags: {
          allows_own_products: true,
          allows_industrial_products: true,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Farmácia
      {
        template_id: 'pharmacy',
        name: 'Farmácia',
        description: 'Farmácia com medicamentos e produtos de saúde',
        type: 'pharmacy',
        version: 'v2.0',
        category_ids: ['cat-medicines', 'cat-health'],
        allowed_product_types: 'industrialized',
        default_product_templates: [
          'prod-template-paracetamol',
          'prod-template-ibuprofen',
        ],
        default_service_templates: [
          'service-template-prescription',
          'service-template-consultation',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: true,
          supports_quote_flow: false,
          supports_pdv: true,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'sales', 'service_operator'],
        recommended_plan: 'Professional',
        canonical_images: {
          logo: '/templates/business/pharmacy-logo.png',
          banner: '/templates/business/pharmacy-banner.png',
          icon: '/templates/business/pharmacy-icon.png',
        },
        flags: {
          allows_own_products: false,
          allows_industrial_products: true,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Distribuidora de Bebidas
      {
        template_id: 'beverage_distributor',
        name: 'Distribuidora de Bebidas',
        description: 'Distribuidora de bebidas alcoólicas e não alcoólicas',
        type: 'beverage_distributor',
        version: 'v2.0',
        category_ids: ['cat-beverages'],
        allowed_product_types: 'industrialized',
        default_product_templates: [
          'prod-template-beer-350ml',
          'prod-template-soda-2l',
        ],
        default_service_templates: ['service-template-delivery'],
        operational_config: {
          requires_agenda: false,
          supports_dispatch: true,
          supports_quote_flow: false,
          supports_pdv: true,
          supports_b2b: true,
        },
        default_roles_enabled: ['manager', 'sales'],
        recommended_plan: 'Professional',
        canonical_images: {
          logo: '/templates/business/beverage-logo.png',
          banner: '/templates/business/beverage-banner.png',
          icon: '/templates/business/beverage-icon.png',
        },
        flags: {
          allows_own_products: false,
          allows_industrial_products: true,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Academia
      {
        template_id: 'gym',
        name: 'Academia',
        description: 'Academia com serviços de treinamento e mensalidades',
        type: 'gym',
        version: 'v2.0',
        category_ids: ['cat-fitness'],
        allowed_product_types: 'own',
        default_product_templates: [],
        default_service_templates: [
          'service-template-gym-membership',
          'service-template-personal-training',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: false,
          supports_quote_flow: false,
          supports_pdv: false,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'service_operator'],
        recommended_plan: 'Basic',
        canonical_images: {
          logo: '/templates/business/gym-logo.png',
          banner: '/templates/business/gym-banner.png',
          icon: '/templates/business/gym-icon.png',
        },
        flags: {
          allows_own_products: true,
          allows_industrial_products: false,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Clínica
      {
        template_id: 'clinic',
        name: 'Clínica Médica',
        description: 'Clínica médica com consultas e exames',
        type: 'clinic',
        version: 'v2.0',
        category_ids: ['cat-health'],
        allowed_product_types: 'industrialized',
        default_product_templates: [],
        default_service_templates: [
          'service-template-consultation',
          'service-template-exam',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: false,
          supports_quote_flow: true,
          supports_pdv: false,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'service_operator', 'accountant'],
        recommended_plan: 'Professional',
        canonical_images: {
          logo: '/templates/business/clinic-logo.png',
          banner: '/templates/business/clinic-banner.png',
          icon: '/templates/business/clinic-icon.png',
        },
        flags: {
          allows_own_products: false,
          allows_industrial_products: true,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Prestador de Serviços
      {
        template_id: 'service_provider',
        name: 'Prestador de Serviços',
        description: 'Prestador de serviços gerais (limpeza, manutenção, etc.)',
        type: 'service_provider',
        version: 'v2.0',
        category_ids: ['cat-home-services'],
        allowed_product_types: 'own',
        default_product_templates: [],
        default_service_templates: [
          'service-template-cleaning',
          'service-template-maintenance',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: true,
          supports_quote_flow: true,
          supports_pdv: false,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'service_operator'],
        recommended_plan: 'Basic',
        canonical_images: {
          logo: '/templates/business/service-provider-logo.png',
          banner: '/templates/business/service-provider-banner.png',
          icon: '/templates/business/service-provider-icon.png',
        },
        flags: {
          allows_own_products: true,
          allows_industrial_products: false,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Restaurante
      {
        template_id: 'restaurant',
        name: 'Restaurante',
        description: 'Restaurante com cardápio e serviços de catering',
        type: 'restaurant',
        version: 'v2.0',
        category_ids: ['cat-food'],
        allowed_product_types: 'own',
        default_product_templates: [],
        default_service_templates: [
          'service-template-catering',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: true,
          supports_quote_flow: true,
          supports_pdv: true,
          supports_b2b: true,
        },
        default_roles_enabled: ['manager', 'sales', 'service_operator'],
        recommended_plan: 'Professional',
        canonical_images: {
          logo: '/templates/business/restaurant-logo.png',
          banner: '/templates/business/restaurant-banner.png',
          icon: '/templates/business/restaurant-icon.png',
        },
        flags: {
          allows_own_products: true,
          allows_industrial_products: false,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Material de Construção
      {
        template_id: 'construction_material',
        name: 'Material de Construção',
        description: 'Loja de materiais de construção',
        type: 'construction_material',
        version: 'v2.0',
        category_ids: ['cat-construction'],
        allowed_product_types: 'both',
        default_product_templates: [
          'prod-template-cement-50kg',
          'prod-template-brick',
        ],
        default_service_templates: ['service-template-delivery'],
        operational_config: {
          requires_agenda: false,
          supports_dispatch: true,
          supports_quote_flow: false,
          supports_pdv: true,
          supports_b2b: true,
        },
        default_roles_enabled: ['manager', 'sales'],
        recommended_plan: 'Professional',
        canonical_images: {
          logo: '/templates/business/construction-logo.png',
          banner: '/templates/business/construction-banner.png',
          icon: '/templates/business/construction-icon.png',
        },
        flags: {
          allows_own_products: true,
          allows_industrial_products: true,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Serviços de Beleza
      {
        template_id: 'beauty_services',
        name: 'Salão de Beleza',
        description: 'Salão de beleza com serviços de corte, manicure, etc.',
        type: 'beauty_services',
        version: 'v2.0',
        category_ids: ['cat-beauty'],
        allowed_product_types: 'own',
        default_product_templates: [],
        default_service_templates: [
          'service-template-haircut',
          'service-template-manicure',
          'service-template-facial',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: false,
          supports_quote_flow: false,
          supports_pdv: false,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'service_operator'],
        recommended_plan: 'Basic',
        canonical_images: {
          logo: '/templates/business/beauty-logo.png',
          banner: '/templates/business/beauty-banner.png',
          icon: '/templates/business/beauty-icon.png',
        },
        flags: {
          allows_own_products: true,
          allows_industrial_products: false,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      // Clínica de Saúde
      {
        template_id: 'health_clinic',
        name: 'Clínica de Saúde',
        description: 'Clínica de saúde com consultas e exames',
        type: 'health_clinic',
        version: 'v2.0',
        category_ids: ['cat-health'],
        allowed_product_types: 'industrialized',
        default_product_templates: [],
        default_service_templates: [
          'service-template-consultation',
          'service-template-exam',
        ],
        operational_config: {
          requires_agenda: true,
          supports_dispatch: false,
          supports_quote_flow: true,
          supports_pdv: false,
          supports_b2b: false,
        },
        default_roles_enabled: ['manager', 'service_operator', 'accountant'],
        recommended_plan: 'Professional',
        canonical_images: {
          logo: '/templates/business/health-clinic-logo.png',
          banner: '/templates/business/health-clinic-banner.png',
          icon: '/templates/business/health-clinic-icon.png',
        },
        flags: {
          allows_own_products: false,
          allows_industrial_products: true,
          allows_services: true,
        },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];

    for (const template of templates) {
      this.businessTemplates.set(template.template_id, template);
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
      pdv_enabled: boolean;
      b2b_enabled: boolean;
    }>
  ): {
    company_id: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdv_enabled: boolean;
    b2b_enabled: boolean;
    updatedAt: string;
  } {
    let state = this.companyActivationStates.get(companyId);
    if (!state) {
      state = {
        company_id: companyId,
        catalog_ready: false,
        services_ready: false,
        agenda_configured: false,
        dispatch_enabled: false,
        quote_flow_enabled: false,
        pdv_enabled: false,
        b2b_enabled: false,
        updatedAt: new Date().toISOString(),
      };
    }

    // Atualizar campos
    Object.assign(state, updates);
    state.updatedAt = new Date().toISOString();

    this.companyActivationStates.set(companyId, state);

    marketplaceLogger.init('Estado de ativação atualizado', {
      company_id: companyId,
      updates,
    });

    return state;
  }

  /**
   * Buscar estado de ativação de uma empresa
   */
  getCompanyActivationState(companyId: string): {
    company_id: string;
    catalog_ready: boolean;
    services_ready: boolean;
    agenda_configured: boolean;
    dispatch_enabled: boolean;
    quote_flow_enabled: boolean;
    pdv_enabled: boolean;
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
        template_id: templateId,
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
    template_id: string;
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
      .filter(t => t.category_id === categoryId);
  }

  /**
   * Buscar service templates canônicos por categoria
   */
  getServiceTemplatesCanonicalByCategory(categoryId: string): ServiceTemplateCanonical[] {
    return Array.from(this.serviceTemplatesCanonical.values())
      .filter(t => t.category_id === categoryId);
  }

  /**
   * Importar templates de produtos para uma loja
   */
  importProductTemplates(
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
      template_id: string;
      store_product_id?: string;
      status: 'imported' | 'skipped';
    }>;
  } {
    const imported: Array<{
      template_id: string;
      store_product_id?: string;
      status: 'imported' | 'skipped';
    }> = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (const templateId of templateIds) {
      // Verificar se deve pular
      if (options?.skip_items?.includes(templateId)) {
        imported.push({ template_id: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      const template = this.productTemplates.get(templateId);
      if (!template) {
        imported.push({ template_id: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Criar instância local (StoreProduct) em estado inactive
      let storeActivations = this.storeProductActivations.get(storeId);
      if (!storeActivations) {
        storeActivations = new Map();
        this.storeProductActivations.set(storeId, storeActivations);
      }

      // Verificar se já existe ativação para este template
      const existingActivation = Array.from(storeActivations.entries())
        .find(([productId, _]) => {
          // Buscar produto canônico que corresponde ao template
          const canonicalProduct = Array.from(this.products.values())
            .find(p => (p as any).template_id === templateId);
          return canonicalProduct && productId === canonicalProduct.id;
        });

      if (existingActivation) {
        imported.push({ template_id: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Buscar ou criar produto canônico baseado no template
      let canonicalProduct = Array.from(this.products.values())
        .find(p => (p as any).template_id === templateId);

      if (!canonicalProduct) {
        // Criar produto canônico baseado no template
        const productId = `product-${templateId}-${Date.now()}`;
        canonicalProduct = {
          id: productId,
          name: template.name,
          description: template.description || '',
          category_id: template.category_id,
          attributes: template.attributes,
          images: template.canonical_images.main ? [template.canonical_images.main] : [],
          product_type: template.type === 'industrialized' ? 'industrial' : 'retail',
        } as any;
        (canonicalProduct as any).template_id = templateId;
        this.products.set(productId, canonicalProduct);
      }

      // Criar ativação em estado inactive
      storeActivations.set(canonicalProduct.id, {
        enabled: false,
        price: null,
        stock: null,
        industry_id: template.type === 'industrialized' ? undefined : undefined,
        hub_id: template.type === 'industrialized' ? undefined : undefined,
      });

      imported.push({
        template_id: templateId,
        store_product_id: canonicalProduct.id,
        status: 'imported',
      });
      importedCount++;

      // Registrar auditoria de uso
      const auditKey = `product-${templateId}`;
      const existingAudit = this.templateUsageAudit.get(auditKey);
      if (existingAudit) {
        existingAudit.usage_count += 1;
        existingAudit.last_usedAt = new Date().toISOString();
      } else {
        this.templateUsageAudit.set(auditKey, {
          template_id: templateId,
          template_type: 'product',
          category_id: template.category_id,
          usage_count: 1,
          last_usedAt: new Date().toISOString(),
        });
      }
    }

    marketplaceLogger.init('Product templates importados', {
      store_id: storeId,
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
      template_id: string;
      offering_id?: string;
      status: 'imported' | 'skipped';
    }>;
  } {
    const imported: Array<{
      template_id: string;
      offering_id?: string;
      status: 'imported' | 'skipped';
    }> = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (const templateId of templateIds) {
      // Verificar se deve pular
      if (options?.skip_items?.includes(templateId)) {
        imported.push({ template_id: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      const template = this.serviceTemplatesCanonical.get(templateId);
      if (!template) {
        imported.push({ template_id: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Verificar se já existe offering para este template
      const existingOffering = Array.from(this.serviceOfferings.values())
        .find(so => so.template_id === templateId && so.store_id === storeId);

      if (existingOffering) {
        imported.push({ template_id: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }

      // Criar ServiceOffering em estado inactive
      const offeringId = `offering-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const offering: any = {
        offering_id: offeringId,
        store_id: storeId,
        template_id: templateId,
        price: {
          amountCents: 0, // Preço padrão, será ajustado pelo dono
          currency: 'BRL',
        },
        duration_minutes: template.default_duration_minutes || 60,
        recurrence: template.type === 'recurring' ? { cycle: 'monthly' } : null,
        isActive: false, // Inactive por padrão
      };

      this.serviceOfferings.set(offeringId, offering);

      imported.push({
        template_id: templateId,
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
          template_id: templateId,
          template_type: 'service',
          category_id: template.category_id,
          usage_count: 1,
          last_usedAt: new Date().toISOString(),
        });
      }
    }

    marketplaceLogger.init('Service templates importados', {
      store_id: storeId,
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
  importCanonicalCatalog(
    companyId: string,
    storeId: string,
    businessTemplateId: string,
    options?: {
      import_all?: boolean;
      import_partial?: boolean;
      product_template_ids?: string[];
      service_template_ids?: string[];
      skip_product_templates?: string[];
      skip_service_templates?: string[];
    }
  ): {
    imported_products: number;
    imported_services: number;
    imported_categories: number;
    imported_templates: {
      products: Array<{ template_id: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
      services: Array<{ template_id: string; offering_id?: string; status: 'imported' | 'skipped' }>;
    };
  } {
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) {
      throw new Error('Business template não encontrado');
    }

    // Buscar empresa/onboarding
    const onboarding = Array.from(this.companyOnboardings.values())
      .find(o => o.company_id === companyId);
    if (!onboarding) {
      throw new Error('Onboarding não encontrado');
    }

    const importedCategories = businessTemplate.category_ids.length;

    // Importar product templates
    let productTemplateIds: string[] = [];
    if (options?.import_all) {
      // Importar todos os templates do business template
      const allProductTemplates = this.getProductTemplatesByBusinessTemplate(businessTemplateId);
      productTemplateIds = allProductTemplates.map(t => t.template_id);
    } else if (options?.product_template_ids) {
      productTemplateIds = options.product_template_ids;
    } else {
      // Importar apenas os sugeridos pelo business template
      productTemplateIds = businessTemplate.default_product_templates;
    }

    const productImportResult = this.importProductTemplates(storeId, productTemplateIds, {
      import_all: options?.import_all,
      import_partial: options?.import_partial,
      skip_items: options?.skip_product_templates,
    });

    // Importar service templates
    let serviceTemplateIds: string[] = [];
    if (options?.import_all) {
      // Importar todos os templates do business template
      const allServiceTemplates = this.getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId);
      serviceTemplateIds = allServiceTemplates.map(t => t.template_id);
    } else if (options?.service_template_ids) {
      serviceTemplateIds = options.service_template_ids;
    } else {
      // Importar apenas os padrão do business template
      serviceTemplateIds = businessTemplate.default_service_templates;
    }

    const serviceImportResult = this.importServiceTemplates(storeId, serviceTemplateIds, {
      import_all: options?.import_all,
      import_partial: options?.import_partial,
      skip_items: options?.skip_service_templates,
    });

    marketplaceLogger.init('Catálogo canônico importado', {
      company_id: companyId,
      store_id: storeId,
      business_template_id: businessTemplateId,
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
    template_id: string;
    template_type: 'product' | 'service';
    category_id: string;
    business_template_id?: string;
    usage_count: number;
    last_usedAt: string;
  }> {
    let audits = Array.from(this.templateUsageAudit.values());

    if (templateId) {
      audits = audits.filter(a => a.template_id === templateId);
    }

    if (categoryId) {
      audits = audits.filter(a => a.category_id === categoryId);
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
    for (const templateId of businessTemplate.default_product_templates) {
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
    for (const templateId of businessTemplate.default_service_templates) {
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
    if (metrics.trust_downgrades_count > 0) {
      priority -= 0.5;
    }

    // Penalidade progressiva por taxa baixa de conversão
    if (metrics.taxa_quote_to_execution < 20) {
      priority -= 0.2;
    } else if (metrics.taxa_quote_to_execution < 50) {
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
  private capacityEvents: Map<string, CapacityEvent> = new Map(); // event_id -> event

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
      actor_id?: string;
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
    const resourceId = options.actor_id
      ? `resource-${type}-${options.actor_id}`
      : options.physical_id
      ? `resource-${type}-${options.physical_id}`
      : `resource-${type}-${Date.now()}`;

    const existing = this.serviceResources.get(resourceId);
    const now = new Date().toISOString();

    const resource: ServiceResource = {
      resource_id: resourceId,
      store_id: storeId,
      type,
      name,
      description: options.description,
      actor_id: options.actor_id,
      physical_id: options.physical_id,
      has_own_agenda: options.has_own_agenda ?? true,
      required_for_services: options.required_for_services || [],
      status: existing?.status || 'active',
      status_reason: existing?.status_reason,
      status_updatedAt: existing?.status_updatedAt || now,
      historical_metrics: existing?.historical_metrics || {
        average_execution_time_minutes: 0,
        sla_response_rate: 1.0,
        sla_execution_rate: 1.0,
        cancellation_rate: 0,
        overrun_rate: 0,
        total_services_completed: 0,
        last_30_days_services: 0,
      },
      current_capacity: existing?.current_capacity || {
        total_slots_available: 0,
        slots_reserved: 0,
        slots_confirmed: 0,
        slots_in_progress: 0,
        slots_available: 0,
        risk_level: 'low',
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    // Se compensation_config foi fornecido, configurar
    if (options.compensation_config) {
      this.setResourceCompensationConfig(resourceId, {
        compensation_model: options.compensation_config.model,
        percent_value: options.compensation_config.percent_value,
        fixed_amount: options.compensation_config.fixed_amount,
        currency: options.compensation_config.fixed_amount ? 'BRL' : undefined,
        monthly_salary: options.compensation_config.monthly_salary,
        base_salary: options.compensation_config.base_salary,
        variable_percent: options.compensation_config.variable_percent,
        min_compensation: options.compensation_config.min_compensation,
        max_compensation: options.compensation_config.max_compensation,
        isActive: options.compensation_config.isActive,
        effective_from: options.compensation_config.effective_from,
        effective_until: options.compensation_config.effective_until,
      });
    }

    this.serviceResources.set(resourceId, resource);

    // Recalcular capacidade do recurso
    this.recalculateResourceCapacity(resourceId);

    marketplaceLogger.init('ServiceResource criado/atualizado', {
      resource_id: resourceId,
      store_id: storeId,
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
      .filter(r => r.store_id === storeId);
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
    resource.status_reason = reason;
    resource.status_updatedAt = new Date().toISOString();
    resource.updatedAt = new Date().toISOString();

    this.serviceResources.set(resourceId, resource);

    // Recalcular capacidade
    this.recalculateResourceCapacity(resourceId);

    // Se ficou sobrecarregado, registrar evento
    if (status === 'overloaded') {
      this.recordCapacityEvent({
        resource_id: resourceId,
        store_id: resource.store_id,
        company_id: resource.store_id, // Simplificação: store_id = company_id
        event_type: 'resource_overloaded',
        details: {
          capacity_available: resource.current_capacity.slots_available,
          capacity_utilized: resource.current_capacity.slots_reserved + resource.current_capacity.slots_confirmed + resource.current_capacity.slots_in_progress,
          saturation_rate: resource.current_capacity.slots_available === 0 ? 1.0 : (resource.current_capacity.slots_reserved + resource.current_capacity.slots_confirmed + resource.current_capacity.slots_in_progress) / resource.current_capacity.total_slots_available,
          reason: reason || 'Capacidade máxima atingida',
        },
      });
    }

    marketplaceLogger.init('Status de ServiceResource atualizado', {
      resource_id: resourceId,
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
      dependency_id: dependencyId,
      service_template_id: serviceTemplateId,
      required_resources: requiredResourceIds,
      all_required: allRequired,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.resourceDependencies.set(dependencyId, dependency);

    marketplaceLogger.init('Dependência de recursos criada', {
      dependency_id: dependencyId,
      service_template_id: serviceTemplateId,
      required_resources: requiredResourceIds,
    });

    return dependency;
  }

  /**
   * Buscar dependências de um serviço
   */
  getResourceDependenciesByService(serviceTemplateId: string): ServiceResourceDependency[] {
    return Array.from(this.resourceDependencies.values())
      .filter(d => d.service_template_id === serviceTemplateId);
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
      .filter(so => so.store_id === resource.store_id);

    // Calcular total de slots disponíveis na agenda
    let totalSlots = 0;
    const now = new Date();
    const currentDay = now.getDay(); // 0 = domingo, 6 = sábado

    for (const offering of serviceOfferings) {
      const availability = Array.from(this.serviceAvailability.values())
        .filter(sa => sa.offering_id === offering.offering_id);

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
        const dispatch = this.serviceDispatches.get(pr.dispatch_id);
        if (!dispatch) return false;

        const request = this.serviceRequests.get(dispatch.request_id);
        if (!request) return false;

        // Verificar se o serviço exige este recurso
        const dependencies = this.getResourceDependenciesByService(request.service_template_id || '');
        return dependencies.some(d => d.required_resources.includes(resourceId));
      })
      .filter(pr => {
        const expiresAt = new Date(pr.expiresAt);
        return expiresAt > now && !pr.confirmed;
      });

    // Buscar serviços confirmados
    const confirmedBookings = Array.from(this.serviceBookings.values())
      .filter(booking => {
        const offering = this.serviceOfferings.get(booking.offering_id);
        if (!offering || offering.store_id !== resource.store_id) return false;

        const dependencies = this.getResourceDependenciesByService(offering.template_id);
        return dependencies.some(d => d.required_resources.includes(resourceId));
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
        const offering = this.serviceOfferings.get(booking.offering_id);
        if (!offering || offering.store_id !== resource.store_id) return false;

        const dependencies = this.getResourceDependenciesByService(offering.template_id);
        return dependencies.some(d => d.required_resources.includes(resourceId));
      })
      .filter(booking => booking.status === 'in_progress');

    // Atualizar capacidade atual
    resource.current_capacity = {
      total_slots_available: totalSlots,
      slots_reserved: preReservations.length,
      slots_confirmed: confirmedBookings.length,
      slots_in_progress: inProgressBookings.length,
      slots_available: Math.max(0, totalSlots - preReservations.length - confirmedBookings.length - inProgressBookings.length),
      risk_level: this.calculateRiskLevel(resource, totalSlots, preReservations.length + confirmedBookings.length + inProgressBookings.length),
    };

    // Se capacidade disponível = 0, marcar como sobrecarregado
    if (resource.current_capacity.slots_available === 0 && resource.status === 'active') {
      this.updateServiceResourceStatus(resourceId, 'overloaded', 'Capacidade disponível zerada');
    } else if (resource.current_capacity.slots_available > 0 && resource.status === 'overloaded') {
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
    const historicalMetrics = resource.historical_metrics;

    // Risco baseado em utilização
    if (utilizationRate >= 0.9) return 'high';
    if (utilizationRate >= 0.7) return 'medium';

    // Risco baseado em métricas históricas
    if (historicalMetrics.sla_execution_rate < 0.7) return 'high';
    if (historicalMetrics.sla_execution_rate < 0.85) return 'medium';
    if (historicalMetrics.overrun_rate > 0.3) return 'high';
    if (historicalMetrics.overrun_rate > 0.15) return 'medium';

    return 'low';
  }

  /**
   * Atualizar métricas de capacidade de um recurso
   */
  private updateResourceCapacityMetrics(resourceId: string): void {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) return;

    const capacity = resource.current_capacity;
    const metrics = resource.historical_metrics;

    const capacityMetrics: ResourceCapacityMetrics = {
      resource_id: resourceId,
      resource_name: resource.name,
      store_id: resource.store_id,
      capacity_total: capacity.total_slots_available,
      capacity_reserved: capacity.slots_reserved,
      capacity_confirmed: capacity.slots_confirmed,
      capacity_in_progress: capacity.slots_in_progress,
      capacity_utilized: capacity.slots_reserved + capacity.slots_confirmed + capacity.slots_in_progress,
      capacity_available: capacity.slots_available,
      risk_sla: capacity.risk_level,
      risk_factors: this.getRiskFactors(resource, capacity),
      historical_average_utilization: metrics.total_services_completed > 0
        ? (metrics.last_30_days_services / 30) / capacity.total_slots_available
        : 0,
      historical_peak_utilization: Math.min(1.0, metrics.last_30_days_services / capacity.total_slots_available),
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.resourceCapacityMetrics.set(resourceId, capacityMetrics);
  }

  /**
   * Obter fatores de risco
   */
  private getRiskFactors(resource: ServiceResource, capacity: ServiceResource['current_capacity']): string[] {
    const factors: string[] = [];

    if (capacity.slots_available === 0) {
      factors.push('Capacidade zerada');
    }

    if (capacity.risk_level === 'high') {
      factors.push('Alto risco de quebra de SLA');
    }

    const metrics = resource.historical_metrics;
    if (metrics.overrun_rate > 0.2) {
      factors.push('Alta taxa de atrasos históricos');
    }

    if (metrics.sla_execution_rate < 0.8) {
      factors.push('Taxa de execução dentro do SLA abaixo do esperado');
    }

    if (metrics.cancellation_rate > 0.15) {
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
      this.recalculateResourceCapacity(resource.resource_id);
    }

    // Agregar métricas
    let totalCapacity = 0;
    let utilizedCapacity = 0;
    let availableCapacity = 0;
    const bottleneckResources: Array<{
      resource_id: string;
      resource_name: string;
      utilization_rate: number;
      risk_level: 'low' | 'medium' | 'high';
    }> = [];

    for (const resource of resources) {
      const capacity = resource.current_capacity;
      totalCapacity += capacity.total_slots_available;
      utilizedCapacity += capacity.slots_reserved + capacity.slots_confirmed + capacity.slots_in_progress;
      availableCapacity += capacity.slots_available;

      // Identificar gargalos (utilização > 80%)
      const utilizationRate = capacity.total_slots_available > 0
        ? (capacity.slots_reserved + capacity.slots_confirmed + capacity.slots_in_progress) / capacity.total_slots_available
        : 0;

      if (utilizationRate > 0.8) {
        bottleneckResources.push({
          resource_id: resource.resource_id,
          resource_name: resource.name,
          utilization_rate: utilizationRate,
          risk_level: capacity.risk_level,
        });
      }
    }

    const saturationRate = totalCapacity > 0 ? utilizedCapacity / totalCapacity : 0;

    // Buscar contagem de serviços rejeitados (simulado por enquanto)
    const rejectedCount = 0; // TODO: Implementar rastreamento de rejeições

    const companyMetrics: CompanyCapacityMetrics = {
      company_id: storeId, // Simplificação: store_id = company_id
      store_id: storeId,
      period: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      },
      total_capacity: totalCapacity,
      utilized_capacity: utilizedCapacity,
      available_capacity: availableCapacity,
      bottleneck_resources: bottleneckResources,
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
      if (dep.all_required) {
        requiredResources.push(...dep.required_resources);
      } else {
        // Pelo menos um dos recursos deve estar disponível
        requiredResources.push(...dep.required_resources);
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

      if (resource.store_id !== storeId) {
        missingResources.push(resourceId);
        continue;
      }

      if (resource.status === 'overloaded' || resource.status === 'unavailable') {
        missingResources.push(resourceId);
        continue;
      }

      // Verificar se há capacidade disponível
      if (resource.current_capacity.slots_available <= 0) {
        missingResources.push(resourceId);
        continue;
      }

      availableResources.push(resourceId);
    }

    // Se todas as dependências exigem todos os recursos, todos devem estar disponíveis
    const allRequired = dependencies.every(d => d.all_required);
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
  private recordCapacityEvent(event: Omit<CapacityEvent, 'event_id' | 'createdAt' | 'immutable'>): void {
    const eventId = `capacity-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const capacityEvent: CapacityEvent = {
      event_id: eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.capacityEvents.set(eventId, capacityEvent);

    // Gerar evento econômico se relevante
    if (event.event_type === 'service_rejected_capacity') {
      this.generateEconomicEvent({
        type: 'service_rejected_capacity',
        region: 'local', // TODO: Obter região real
        actor_id: event.store_id,
        reference_id: event.details.service_request_id,
        amountCents: null,
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

        return dependencies.some(d => d.required_resources.includes(r.resource_id));
      })
      .filter(r => {
        // Proteção anti-overload: apenas recursos com capacidade disponível
        return r.current_capacity.slots_available > 0;
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
  private resourceCompensations: Map<string, ResourceCompensation> = new Map(); // compensation_id -> compensation

  /**
   * Resource Compensation Configs (in-memory)
   * Configurações de compensação por recurso
   */
  private resourceCompensationConfigs: Map<string, ResourceCompensationConfig> = new Map(); // resource_id -> config

  /**
   * Configurar modelo de compensação para um recurso
   */
  setResourceCompensationConfig(
    resourceId: string,
    config: Omit<ResourceCompensationConfig, 'resource_id' | 'createdAt' | 'updatedAt'>
  ): ResourceCompensationConfig {
    const now = new Date().toISOString();
    const existing = this.resourceCompensationConfigs.get(resourceId);

    const compensationConfig: ResourceCompensationConfig = {
      resource_id: resourceId,
      ...config,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    this.resourceCompensationConfigs.set(resourceId, compensationConfig);

    // Atualizar ServiceResource com a configuração
    const resource = this.serviceResources.get(resourceId);
    if (resource) {
      resource.compensation_config = {
        model: config.compensation_model,
        percent_value: config.percent_value,
        fixed_amount: config.fixed_amount,
        monthly_salary: config.monthly_salary,
        base_salary: config.base_salary,
        variable_percent: config.variable_percent,
        min_compensation: config.min_compensation,
        max_compensation: config.max_compensation,
        isActive: config.isActive,
        effective_from: config.effective_from,
        effective_until: config.effective_until,
      };
      resource.updatedAt = now;
      this.serviceResources.set(resourceId, resource);
    }

    marketplaceLogger.init('Configuração de compensação atualizada', {
      resource_id: resourceId,
      model: config.compensation_model,
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
        resource.store_id,
        serviceValue,
        'none',
        { amountCents: 0, currency: serviceValue.currency },
        {}
      );
    }

    // Verificar se está dentro do período de vigência
    const now = new Date();
    const effectiveFrom = new Date(config.effective_from);
    if (now < effectiveFrom) {
      throw new Error('Configuração de compensação ainda não está em vigência');
    }

    if (config.effective_until) {
      const effectiveUntil = new Date(config.effective_until);
      if (now > effectiveUntil) {
        throw new Error('Configuração de compensação expirou');
      }
    }

    let compensationAmount = 0;
    const calculationDetails: ResourceCompensation['calculation_details'] = {
      adjustments: [],
    };

    // Calcular compensação baseado no modelo
    switch (config.compensation_model) {
      case 'none':
        compensationAmount = 0;
        break;

      case 'fixed_percent':
        if (!config.percent_value) {
          throw new Error('Percentual não configurado para modelo fixed_percent');
        }
        compensationAmount = Math.round((serviceValue.amount * config.percent_value) / 100);
        calculationDetails.base_value = serviceValue.amount;
        calculationDetails.percent_applied = config.percent_value;
        break;

      case 'fixed_value':
        if (!config.fixed_amount) {
          throw new Error('Valor fixo não configurado para modelo fixed_value');
        }
        compensationAmount = config.fixed_amount;
        calculationDetails.fixed_value_applied = config.fixed_amount;
        break;

      case 'salary':
        // Funcionário assalariado não gera repasse por serviço
        compensationAmount = 0;
        break;

      case 'mixed':
        if (!config.base_salary || !config.variable_percent) {
          throw new Error('Salário base ou percentual variável não configurado para modelo mixed');
        }
        // Variável: percentual sobre o valor do serviço
        const variableAmount = Math.round((serviceValue.amount * config.variable_percent) / 100);
        compensationAmount = variableAmount;
        calculationDetails.base_value = serviceValue.amount;
        calculationDetails.percent_applied = config.variable_percent;
        break;
    }

    // Aplicar limites mínimo e máximo
    if (config.min_compensation && compensationAmount < config.min_compensation) {
      const adjustment = config.min_compensation - compensationAmount;
      compensationAmount = config.min_compensation;
      calculationDetails.adjustments!.push({
        type: 'min_limit',
        amountCents: adjustment,
        reason: `Aplicado limite mínimo de ${config.min_compensation / 100} ${serviceValue.currency}`,
      });
    }

    if (config.max_compensation && compensationAmount > config.max_compensation) {
      const adjustment = compensationAmount - config.max_compensation;
      compensationAmount = config.max_compensation;
      calculationDetails.adjustments!.push({
        type: 'max_limit',
        amountCents: -adjustment,
        reason: `Aplicado limite máximo de ${config.max_compensation / 100} ${serviceValue.currency}`,
      });
    }

    return this.createCompensationRecord(
      resourceId,
      serviceOrderId,
      serviceBookingId,
      resource.store_id,
      serviceValue,
      config.compensation_model,
      { amountCents: compensationAmount, currency: serviceValue.currency },
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
    calculationDetails: ResourceCompensation['calculation_details']
  ): ResourceCompensation {
    const compensationId = `compensation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const compensation: ResourceCompensation = {
      compensation_id: compensationId,
      resource_id: resourceId,
      service_order_id: serviceOrderId,
      service_booking_id: serviceBookingId,
      store_id: storeId,
      service_value: serviceValue,
      compensation_amount: compensationAmount,
      compensation_model: model,
      calculation_details: calculationDetails,
      status: 'calculated',
      createdAt: now,
      updatedAt: now,
      immutable: true,
    };

    this.resourceCompensations.set(compensationId, compensation);

    marketplaceLogger.init('Compensação calculada', {
      compensation_id: compensationId,
      resource_id: resourceId,
      service_order_id: serviceOrderId,
      amountCents: compensationAmount.amount,
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
      .find(so => so.order_id === serviceOrderId);
    if (!serviceOrder) {
      throw new Error('ServiceOrder não encontrado');
    }

    // Buscar Order associado
    const order = this.orders.get(serviceOrder.order_id);
    if (!order) {
      throw new Error('Order não encontrado');
    }

    // Buscar PaymentPlan
    const checkout = Array.from(this.checkoutIntents.values())
      .find(c => c.orders.some(o => o.order_id === order.order_id));
    if (!checkout) {
      throw new Error('CheckoutIntent não encontrado');
    }

    const paymentPlan = Array.from(this.paymentPlans.values())
      .find(pp => pp.checkout_id === checkout.checkout_id);
    if (!paymentPlan || paymentPlan.status !== 'executed') {
      throw new Error('PaymentPlan não encontrado ou não executado');
    }

    // Valor do serviço (do ServiceOrder)
    const serviceValue = {
      amountCents: serviceOrder.price.amount,
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
            order.store_id,
            resourceId
          );

          compensation.ledger_entry_id = ledgerEntryId;
          compensation.status = 'pending'; // Aguardando confirmação de pagamento
          compensation.updatedAt = new Date().toISOString();
          this.resourceCompensations.set(compensation.compensation_id, compensation);
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
    const ledgerEntryId = `ledger-resource-compensation-${compensation.compensation_id}`;

    marketplaceLogger.init('Repasse interno registrado no ledger', {
      compensation_id: compensation.compensation_id,
      resource_id: resourceId,
      amountCents: compensation.compensationAmount.amountCents,
      ledger_entry_id: ledgerEntryId,
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
      compensation_id: compensationId,
      resource_id: compensation.resource_id,
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
      .filter(c => c.resource_id === resourceId);

    if (options?.starts_at) {
      compensations = compensations.filter(c => c.createdAt >= options.starts_at!);
    }

    if (options?.ends_at) {
      compensations = compensations.filter(c => c.createdAt <= options.ends_at!);
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
    const resourceIds = resources.map(r => r.resource_id);

    let compensations = Array.from(this.resourceCompensations.values())
      .filter(c => resourceIds.includes(c.resource_id));

    if (options?.starts_at) {
      compensations = compensations.filter(c => c.createdAt >= options.starts_at!);
    }

    if (options?.ends_at) {
      compensations = compensations.filter(c => c.createdAt <= options.ends_at!);
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
      const model = comp.compensation_model;
      byModel[model].count += 1;
      byModel[model].totalCents += comp.compensationAmount.amountCents;
    }

    const history: ResourceCompensationHistory = {
      resource_id: resourceId,
      period: { start: startDate, end: endDate },
      compensations,
      total_services: compensations.length,
      total_compensation: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensation_amount.currency || 'BRL',
      },
      average_per_service: {
        amountCents: compensations.length > 0 ? Math.round(totalCompensation / compensations.length) : 0,
        currency: compensations[0]?.compensation_amount.currency || 'BRL',
      },
      by_model: byModel,
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
      resource_id: string;
      resource_name: string;
      compensation_model: CompensationModel;
      services_count: number;
      total_compensationCents: number;
    }>();

    for (const comp of compensations) {
      const resource = resources.find(r => r.resource_id === comp.resource_id);
      if (!resource) continue;

      const existing = byResourceMap.get(comp.resource_id);
      if (existing) {
        existing.services_count += 1;
        existing.total_compensationCents += comp.compensationAmount.amountCents;
      } else {
        byResourceMap.set(comp.resource_id, {
          resource_id: comp.resource_id,
          resource_name: resource.name,
          compensation_model: comp.compensation_model,
          services_count: 1,
          total_compensationCents: comp.compensationAmount.amountCents,
        });
      }
    }

    // Por modelo
    const byModel: Record<CompensationModel, {
      resources_count: number;
      services_count: number;
      total_compensation: { amountCents: number; currency: string };
    }> = {
      none: { resources_count: 0, services_count: 0, total_compensation: { amountCents: 0, currency: 'BRL' } },
      fixed_percent: { resources_count: 0, services_count: 0, total_compensation: { amountCents: 0, currency: 'BRL' } },
      fixed_value: { resources_count: 0, services_count: 0, total_compensation: { amountCents: 0, currency: 'BRL' } },
      salary: { resources_count: 0, services_count: 0, total_compensation: { amountCents: 0, currency: 'BRL' } },
      mixed: { resources_count: 0, services_count: 0, total_compensation: { amountCents: 0, currency: 'BRL' } },
    };

    const modelResources = new Set<string>();
    for (const comp of compensations) {
      const model = comp.compensation_model;
      byModel[model].services_count += 1;
      byModel[model].total_compensation.amountCents += comp.compensationAmount.amountCents;
      modelResources.add(`${model}-${comp.resource_id}`);
    }

    for (const key of modelResources) {
      const [model] = key.split('-');
      byModel[model as CompensationModel].resources_count += 1;
    }

    const report: CompanyCompensationReport = {
      company_id: storeId, // Simplificação: store_id = company_id
      store_id: storeId,
      period: { start: startDate, end: endDate },
      total_compensations_paid: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensation_amount.currency || 'BRL',
      },
      total_resources: resources.length,
      total_services: compensations.length,
      by_resource: Array.from(byResourceMap.values()),
      by_model: byModel,
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
  private voucherOffers: Map<string, VoucherOffer> = new Map(); // offer_id -> offer

  /**
   * Voucher Claims (in-memory)
   * Resgates de vouchers
   */
  private voucherClaims: Map<string, VoucherClaim> = new Map(); // claim_id -> claim

  /**
   * Voucher Redemption Events (in-memory)
   * Eventos de voucher (append-only)
   */
  private voucherRedemptionEvents: Map<string, VoucherRedemptionEvent> = new Map(); // event_id -> event

  /**
   * Voucher Participation Score (in-memory)
   * Score interno de participação em vouchers (para boost local)
   */
  private voucherParticipationScores: Map<string, {
    store_id: string;
    participation_count: number; // Número de ofertas criadas
    cancellation_rate: number; // Taxa de cancelamento/pausa
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
    offer: Omit<VoucherOffer, 'offer_id' | 'issuer_actor_id' | 'store_id' | 'quantity_claimed' | 'status' | 'createdAt' | 'updatedAt'>
  ): VoucherOffer {
    // Validações obrigatórias
    if (!offer.startAt || !offer.endAt) {
      throw new Error('Janela startAt e endAt são obrigatórias');
    }

    if (offer.quantity_total <= 0) {
      throw new Error('quantity_total deve ser maior que 0');
    }

    if (offer.type === 'service' && !offer.linked_service_template_id && !offer.linked_service_offering_id) {
      throw new Error('Oferta de serviço deve vincular a um ServiceTemplateCanonical ou ServiceOffering');
    }

    if (offer.type === 'product' && !offer.linked_product_id) {
      throw new Error('Oferta de produto deve vincular a um StoreProduct');
    }

    if (offer.visibility_scope === 'local_neighborhood' || offer.visibility_scope === 'city') {
      // Verificar se store tem location definida
      const stores = this.getStores();
      const store = stores.stores.find(s => s.store_id === storeId);
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
      offer_id: offerId,
      issuer_actor_id: issuerActorId,
      store_id: storeId,
      ...offer,
      quantity_claimed: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      immutable: false,
    };

    this.voucherOffers.set(offerId, voucherOffer);

    // Registrar evento
    this.recordVoucherEvent({
      offer_id: offerId,
      actor_id: issuerActorId,
      type: 'offer_created',
      metadata: {
        offer_title: offer.title,
      },
    });

    marketplaceLogger.init('Oferta de voucher criada', {
      offer_id: offerId,
      store_id: storeId,
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
      offer_id: offerId,
      actor_id: offer.issuer_actor_id,
      type: 'offer_activated',
      metadata: {
        offer_title: offer.title,
        quantity_remaining: offer.quantity_total - offer.quantity_claimed,
      },
    });

    marketplaceLogger.init('Oferta de voucher ativada', {
      offer_id: offerId,
      store_id: offer.store_id,
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
      offer_id: offerId,
      actor_id: offer.issuer_actor_id,
      type: 'offer_paused',
      metadata: {
        offer_title: offer.title,
        reason: 'Pausada pela empresa',
      },
    });

    // Atualizar métricas de participação (cancelamento alto reduz boost)
    this.updateVoucherParticipationScore(offer.store_id, 'pause');

    marketplaceLogger.init('Oferta de voucher pausada', {
      offer_id: offerId,
      store_id: offer.store_id,
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
    store_id?: string;
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
    if (filters.store_id) {
      offers = offers.filter(o => o.store_id === filters.store_id);
    }

    // Filtrar por escopo e localização
    if (filters.city || filters.neighborhood) {
      const stores = this.getStores();
      offers = offers.filter(offer => {
        const store = stores.stores.find(s => s.store_id === offer.store_id);
        if (!store) return false;

        // Verificar escopo
        if (offer.visibility_scope === 'local_neighborhood') {
          if (filters.neighborhood) {
            return store.branches.some(b => b.location?.neighborhood === filters.neighborhood);
          }
          return false; // Escopo neighborhood requer neighborhood no filtro
        }

        if (offer.visibility_scope === 'city') {
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
      offers = offers.filter(o => o.visibility_scope === filters.scope);
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
      return offer.quantity_claimed < offer.quantity_total;
    });

    return offers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Resgatar voucher (claim)
   */
  claimVoucherOffer(offerId: string, userId: string, audit?: {
    ip_hash?: string;
    device_hash?: string;
    neighborhood?: string;
    city?: string;
  }): VoucherClaim {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      throw new Error('Oferta não encontrada');
    }

    // Verificar se oferta está ativa
    if (offer.status !== 'active') {
      throw new Error('Oferta não está ativa');
    }

    // Verificar se ainda está dentro da janela
    const now = new Date();
    const startAt = new Date(offer.startAt);
    const endAt = new Date(offer.endAt);
    if (now < startAt || now > endAt) {
      throw new Error('Oferta fora da janela de resgate');
    }

    // Verificar se ainda há quantidade disponível
    if (offer.quantity_claimed >= offer.quantity_total) {
      offer.status = 'depleted';
      offer.updatedAt = new Date().toISOString();
      this.voucherOffers.set(offerId, offer);
      throw new Error('Oferta esgotada');
    }

    // Verificar quantidade por usuário
    const userClaims = Array.from(this.voucherClaims.values())
      .filter(c => c.offer_id === offerId && c.claimer_user_id === userId && c.status === 'claimed');
    if (userClaims.length >= offer.quantity_per_user) {
      throw new Error(`Limite de ${offer.quantity_per_user} resgate(s) por usuário atingido`);
    }

    // Verificar elegibilidade
    const identity = this.getEconomicIdentity(userId);
    if (offer.eligibility.min_trust_level) {
      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[offer.eligibility.min_trust_level] || 0;
      const userLevel = identity ? trustLevels[identity.trust_level] || 0 : 0;
      if (userLevel < requiredLevel) {
        throw new Error(`Trust level mínimo requerido: ${offer.eligibility.min_trust_level}`);
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
      .find(c => c.offer_id === offerId && c.claimer_user_id === userId && c.status === 'claimed');
    if (existingClaim) {
      throw new Error('Usuário já possui um resgate ativo para esta oferta');
    }

    // Gerar código de resgate único
    const redemptionCode = this.generateRedemptionCode();

    // Calcular expiresAt
    const redemptionDeadline = offer.redemption_deadlineAt
      ? new Date(offer.redemption_deadlineAt)
      : new Date(endAt.getTime() + 7 * 24 * 60 * 60 * 1000); // Padrão: 7 dias após endAt

    const claimId = `voucher-claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const claim: VoucherClaim = {
      claim_id: claimId,
      offer_id: offerId,
      claimer_user_id: userId,
      status: 'claimed',
      claimedAt: now.toISOString(),
      redemption_code: redemptionCode,
      expiresAt: redemptionDeadline.toISOString(),
      store_checkin_required: offer.pickup_constraints?.requires_checkin || false,
      audit: {
        ip_hash: audit?.ip_hash,
        device_hash: audit?.device_hash,
        claimed_from_neighborhood: audit?.neighborhood,
        claimed_from_city: audit?.city,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      immutable: true,
    };

    this.voucherClaims.set(claimId, claim);

    // Atualizar quantidade resgatada
    offer.quantity_claimed += 1;
    if (offer.quantity_claimed >= offer.quantity_total) {
      offer.status = 'depleted';
    }
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    // Registrar evento
    this.recordVoucherEvent({
      offer_id: offerId,
      claim_id: claimId,
      actor_id: userId,
      type: 'claim_created',
      metadata: {
        offer_title: offer.title,
        claimer_user_id: userId,
        redemption_code: redemptionCode,
        quantity_remaining: offer.quantity_total - offer.quantity_claimed,
      },
    });

    marketplaceLogger.init('Voucher resgatado', {
      claim_id: claimId,
      offer_id: offerId,
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
    if (claim.redemption_code !== presentedCode.toUpperCase()) {
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

    const offer = this.voucherOffers.get(claim.offer_id);
    if (!offer) {
      throw new Error('Oferta não encontrada');
    }

    // Verificar check-in (se exigido)
    if (claim.store_checkin_required && !claim.checked_inAt) {
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
    if (offer.type === 'product' && offer.linked_product_id) {
      // Criar Order com desconto total ou parcial
      const order = this.createOrder(offer.store_id);
      
      // Adicionar produto ao pedido
      const orderWithItem = this.addOrderItem(order.order_id, offer.linked_product_id, 1);

      // Aplicar desconto (se houver)
      if (offer.discount_value) {
        // TODO: Aplicar desconto no Order (por enquanto, criar com valor 0)
        // O desconto pode ser aplicado no PaymentPlan posteriormente
      }

      orderId = orderWithItem.order_id;
      claim.linked_order_id = orderId;
    } else if (offer.type === 'service' && (offer.linked_service_template_id || offer.linked_service_offering_id)) {
      // Criar ServiceBooking
      const offeringId = offer.linked_service_offering_id || '';
      const offering = this.serviceOfferings.get(offeringId);
      if (!offering) {
        throw new Error('ServiceOffering não encontrado');
      }

      const booking = this.createServiceBooking({
        offering_id: offeringId,
        user_id: claim.claimer_user_id,
        date: new Date().toISOString().split('T')[0], // Hoje
        time: new Date().toTimeString().split(' ')[0].substring(0, 5), // Agora
        quantity: 1,
      });

      serviceBookingId = booking.booking_id;
      claim.linked_service_booking_id = serviceBookingId;
    }

    this.voucherClaims.set(claimId, claim);

    // Registrar evento
    this.recordVoucherEvent({
      offer_id: claim.offer_id,
      claim_id: claimId,
      actor_id: storeOperatorActorId,
      type: 'redeemed',
      metadata: {
        offer_title: offer.title,
        claimer_user_id: claim.claimer_user_id,
        redemption_code: claim.redemption_code,
      },
    });

    marketplaceLogger.init('Voucher resgatado na loja', {
      claim_id: claimId,
      offer_id: claim.offer_id,
      user_id: claim.claimer_user_id,
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
    this.updateUserVoucherAbuseMetrics(claim.claimer_user_id, 'no_show');

    // Atualizar métricas de participação da empresa
    const offer = this.voucherOffers.get(claim.offer_id);
    if (offer) {
      this.updateVoucherParticipationScore(offer.store_id, 'no_show');
    }

    // Registrar evento
    this.recordVoucherEvent({
      offer_id: claim.offer_id,
      claim_id: claimId,
      actor_id: offer?.issuer_actor_id || '',
      type: 'no_show_marked',
      metadata: {
        offer_title: offer?.title,
        claimer_user_id: claim.claimer_user_id,
        reason: 'No-show marcado pela empresa',
      },
    });

    marketplaceLogger.init('No-show marcado', {
      claim_id: claimId,
      user_id: claim.claimer_user_id,
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
          this.updateUserVoucherAbuseMetrics(claim.claimer_user_id, 'expired');

          // Registrar evento
          const offer = this.voucherOffers.get(claim.offer_id);
          this.recordVoucherEvent({
            offer_id: claim.offer_id,
            claim_id: claimId,
            actor_id: claim.claimer_user_id,
            type: 'claim_expired',
            metadata: {
              offer_title: offer?.title,
              claimer_user_id: claim.claimer_user_id,
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
  private recordVoucherEvent(event: Omit<VoucherRedemptionEvent, 'event_id' | 'createdAt' | 'immutable'>): void {
    const eventId = `voucher-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const voucherEvent: VoucherRedemptionEvent = {
      event_id: eventId,
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
        store_id: storeId,
        participation_count: 0,
        cancellation_rate: 0,
        no_show_rate: 0,
        last_boost_reset: new Date().toISOString(),
      };
    }

    if (action === 'pause') {
      // Aumentar taxa de cancelamento
      score.cancellation_rate = Math.min(1.0, score.cancellation_rate + 0.1);
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
      .filter(c => c.claimer_user_id === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar claims de uma oferta
   */
  getOfferVoucherClaims(offerId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.offer_id === offerId)
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
      const storeResources = this.getServiceResourcesByStore(store.store_id);
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
      const capacity = resource.current_capacity;
      if (capacity.total_slots_available > 0) {
        const utilization = (capacity.slots_reserved + capacity.slots_confirmed + capacity.slots_in_progress) / capacity.total_slots_available;
        totalUtilization += utilization;
        peakUtilization = Math.max(peakUtilization, utilization);
      }
    }
    const avgUtilizationRate = totalResources > 0 ? totalUtilization / totalResources : 0;

    // Buscar eventos de sobrecarga no período
    const capacityEvents = Array.from(this.capacityEvents.values())
      .filter(e => {
        if (e.resource_id) {
          const resource = allResources.find(r => r.resource_id === e.resource_id);
          return !!resource;
        }
        return regionStores.some(s => s.store_id === e.store_id);
      })
      .filter(e => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= periodStart && eventDate <= periodEnd;
      })
      .filter(e => e.event_type === 'resource_overloaded');

    const overloadEventsCount = capacityEvents.length;

    // Buscar ServiceRequests na região e categoria
    const serviceRequests = Array.from(this.serviceRequests.values())
      .filter(r => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      });

    const totalRequests = serviceRequests.length;
    const expiredRequests = serviceRequests.filter(r => {
      const expiresAt = r.expiresAt ? new Date(r.expiresAt) : null;
      return expiresAt && expiresAt < now;
    }).length;
    const requestExpirationRate = totalRequests > 0 ? expiredRequests / totalRequests : 0;

    // Buscar dispatches
    const dispatches = Array.from(this.serviceDispatches.values())
      .filter(d => {
        const request = serviceRequests.find(r => r.request_id === d.request_id);
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
      if (dispatch.sentAt && dispatch.respondedAt) {
        const responseTime = (new Date(dispatch.respondedAt).getTime() - new Date(dispatch.sentAt).getTime()) / (1000 * 60);
        totalResponseTime += responseTime;
        responseTimeCount++;
      }

      const request = serviceRequests.find(r => r.request_id === dispatch.request_id);
      if (request && request.completedAt) {
        const executionTime = (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
        totalExecutionTime += executionTime;
        executionTimeCount++;
      }

      if (dispatch.acceptedAt && dispatch.sentAt) {
        const confirmationTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.sentAt).getTime()) / (1000 * 60);
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
        const resource = allResources.find(r => r.actor_id === m.provider_actor_id);
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
      region_id: regionId,
      service_category: serviceCategory,
      total_resources: totalResources,
      active_resources: activeResources,
      overloaded_resources: overloadedResources,
      avg_utilization_rate: avgUtilizationRate,
      peak_utilization_rate: peakUtilization,
      overload_events_count: overloadEventsCount,
      request_expiration_rate: requestExpirationRate,
      dispatch_rejection_rate: dispatchRejectionRate,
      avg_response_time_minutes: avgResponseTime,
      avg_execution_time_minutes: avgExecutionTime,
      avg_confirmation_time_minutes: avgConfirmationTime,
      sla_risk_level: slaRiskLevel,
      sla_violation_rate: slaViolationRate,
      request_to_execution_rate: requestToExecutionRate,
      status,
      bottleneck_cause: bottleneckCause,
      bottleneck_details: bottleneckDetails,
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
      .find(s => s.region_id === regionId && s.period.start === period.start && s.period.end === period.end);

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
    const totalResources = byCategory.reduce((sum, m) => sum + m.total_resources, 0);
    const totalActiveResources = byCategory.reduce((sum, m) => sum + m.active_resources, 0);
    const totalOverloadedResources = byCategory.reduce((sum, m) => sum + m.overloaded_resources, 0);

    // Identificar gargalos
    const identifiedBottlenecks = byCategory
      .filter(m => m.status !== 'healthy' && m.bottleneck_cause)
      .map(m => ({
        category: m.service_category,
        cause: m.bottleneck_cause!,
        severity: m.status === 'critical' ? 'high' as const : m.status === 'warning' ? 'medium' as const : 'low' as const,
        details: m.bottleneck_details || '',
      }));

    // Calcular status geral
    const criticalCount = byCategory.filter(m => m.status === 'critical').length;
    const warningCount = byCategory.filter(m => m.status === 'warning').length;
    const overallStatus: RegionalCapacityStatus = criticalCount > 0 ? 'critical' : warningCount > byCategory.length * 0.3 ? 'warning' : 'healthy';

    // Calcular risco geral de SLA
    const highRiskCount = byCategory.filter(m => m.sla_risk_level === 'high').length;
    const mediumRiskCount = byCategory.filter(m => m.sla_risk_level === 'medium').length;
    const overallSLARisk: SLARiskLevel = highRiskCount > 0 ? 'high' : mediumRiskCount > byCategory.length * 0.3 ? 'medium' : 'low';

    // Por tipo de empresa (simplificado)
    const byCompanyType: Array<{
      company_type: string;
      total_resources: number;
      active_resources: number;
      avg_utilization_rate: number;
      status: RegionalCapacityStatus;
    }> = []; // TODO: Implementar agregação por tipo de empresa se necessário

    const snapshotId = `snapshot-${regionId}-${period.start}-${period.end}`;
    const snapshot: RegionalCapacitySnapshot = {
      snapshot_id: snapshotId,
      region_id: regionId,
      period,
      period_type: periodType,
      total_resources: totalResources,
      total_active_resources: totalActiveResources,
      total_overloaded_resources: totalOverloadedResources,
      by_category: byCategory,
      by_company_type: byCompanyType,
      identified_bottlenecks: identifiedBottlenecks,
      overall_status: overallStatus,
      overall_sla_risk: overallSLARisk,
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.regionalCapacitySnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de capacidade regional gerado', {
      snapshot_id: snapshotId,
      region_id: regionId,
      period_type: periodType,
      overall_status: overallStatus,
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
    region_id?: string;
    period_type?: 'weekly' | 'monthly';
    starts_at?: string;
    ends_at?: string;
  }): RegionalCapacitySnapshot[] {
    let snapshots = Array.from(this.regionalCapacitySnapshots.values());

    if (filters?.region_id) {
      snapshots = snapshots.filter(s => s.region_id === filters.region_id);
    }

    if (filters?.period_type) {
      snapshots = snapshots.filter(s => s.period_type === filters.period_type);
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
    region_id?: string;
    service_category?: string;
    status?: RegionalCapacityStatus;
  }): RegionalCapacityMetric[] {
    let metrics = Array.from(this.regionalCapacityMetrics.values());

    if (filters?.region_id) {
      metrics = metrics.filter(m => m.region_id === filters.region_id);
    }

    if (filters?.service_category) {
      metrics = metrics.filter(m => m.service_category === filters.service_category);
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
  private expansionUnlocks: Map<string, ExpansionUnlock> = new Map(); // unlock_id -> unlock

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
    const criticalCategories = snapshot.by_category.filter(
      m => m.status === 'warning' || m.status === 'critical'
    );

    // Processar apenas categorias com risco de SLA medium ou high
    const highRiskCategories = criticalCategories.filter(
      m => m.sla_risk_level === 'medium' || m.sla_risk_level === 'high'
    );

    for (const metric of highRiskCategories) {
      // Determinar tipo de sinal baseado no gargalo
      let signalType: ExpansionSignalType;
      let unlockedFeatures: ExpansionUnlockFeature[] = [];

      switch (metric.bottleneck_cause) {
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

      const signalId = `expansion-signal-${snapshot.region_id}-${metric.service_category}-${Date.now()}`;

      const signal: RegionalExpansionSignal = {
        signal_id: signalId,
        region_id: snapshot.region_id,
        service_category: metric.service_category,
        signal_type: signalType,
        bottleneck_cause: metric.bottleneck_cause || 'lack_of_professionals',
        triggering_metrics: {
          status: metric.status,
          sla_risk_level: metric.sla_risk_level,
          request_expiration_rate: metric.request_expiration_rate,
          dispatch_rejection_rate: metric.dispatch_rejection_rate,
          avg_utilization_rate: metric.avg_utilization_rate,
          overloaded_resources_ratio: metric.total_resources > 0
            ? metric.overloaded_resources / metric.total_resources
            : 0,
        },
        source_snapshot_id: snapshotId,
        unlocked_features: unlockedFeatures,
        status: 'active',
        createdAt: new Date().toISOString(),
        immutable: true,
      };

      this.regionalExpansionSignals.set(signalId, signal);

      // Criar desbloqueios para cada funcionalidade
      for (const feature of unlockedFeatures) {
        this.createExpansionUnlock(signalId, feature, snapshot.region_id, metric.service_category);
      }

      signals.push(signal);
    }

    marketplaceLogger.init('Sinais de expansão gerados', {
      snapshot_id: snapshotId,
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
      unlock_id: unlockId,
      signal_id: signalId,
      region_id: regionId,
      service_category: serviceCategory,
      feature,
      details: {
        description: featureDescriptions[feature],
        eligibility_criteria: this.getEligibilityCriteria(feature),
        available_until: this.getAvailabilityDeadline(feature),
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
    region_id?: string;
    service_category?: string;
    signal_type?: ExpansionSignalType;
  }): RegionalExpansionSignal[] {
    let signals = Array.from(this.regionalExpansionSignals.values())
      .filter(s => s.status === 'active');

    if (filters?.region_id) {
      signals = signals.filter(s => s.region_id === filters.region_id);
    }

    if (filters?.service_category) {
      signals = signals.filter(s => s.service_category === filters.service_category);
    }

    if (filters?.signal_type) {
      signals = signals.filter(s => s.signal_type === filters.signal_type);
    }

    return signals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar desbloqueios disponíveis
   */
  getAvailableExpansionUnlocks(filters?: {
    region_id?: string;
    service_category?: string;
    feature?: ExpansionUnlockFeature;
  }): ExpansionUnlock[] {
    const now = new Date();
    let unlocks = Array.from(this.expansionUnlocks.values())
      .filter(u => {
        if (u.status !== 'available') return false;
        if (u.details.available_until) {
          const deadline = new Date(u.details.available_until);
          if (now > deadline) {
            // Marcar como expirado
            u.status = 'expired';
            u.updatedAt = new Date().toISOString();
            this.expansionUnlocks.set(u.unlock_id, u);
            return false;
          }
        }
        return true;
      });

    if (filters?.region_id) {
      unlocks = unlocks.filter(u => u.region_id === filters.region_id);
    }

    if (filters?.service_category) {
      unlocks = unlocks.filter(u => u.service_category === filters.service_category);
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
      unlock_id: unlockId,
      feature: unlock.feature,
      region_id: unlock.region_id,
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
      region_id: regionId,
      service_category: serviceCategory,
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
      signal_id: signalId,
      region_id: signal.region_id,
    });

    return signal;
  }

  /**
   * Verificar se há sinais de expansão para uma região
   */
  hasExpansionSignals(regionId: string): boolean {
    const signals = this.getActiveExpansionSignals({ region_id: regionId });
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
    const signals = this.getActiveExpansionSignals({ region_id: regionId });
    const unlocks = this.getAvailableExpansionUnlocks({ region_id: regionId });

    const categoriesAffected = [...new Set(signals.map(s => s.service_category))];
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
      fixed_costs_monthly?: {
        rent?: { amountCents: number; currency: string };
        salaries?: { amountCents: number; currency: string };
        pro_labore?: { amountCents: number; currency: string };
        systems?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      variable_costs_per_service?: {
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
    const fixedTotal = (profile.fixed_costs_monthly?.rent?.amountCents || 0) +
      (profile.fixed_costs_monthly?.salaries?.amountCents || 0) +
      (profile.fixed_costs_monthly?.pro_labore?.amountCents || 0) +
      (profile.fixed_costs_monthly?.systems?.amountCents || 0) +
      (profile.fixed_costs_monthly?.other?.amountCents || 0);

    const variableAverage = (profile.variable_costs_per_service?.materials?.amountCents || 0) +
      (profile.variable_costs_per_service?.commission?.amountCents || 0) +
      (profile.variable_costs_per_service?.transportation?.amountCents || 0) +
      (profile.variable_costs_per_service?.other?.amountCents || 0);

    const costProfile: OperationalCostProfile = {
      store_id: storeId,
      company_id: companyId,
      fixed_costs_monthly: {
        rent: profile.fixed_costs_monthly?.rent,
        salaries: profile.fixed_costs_monthly?.salaries,
        pro_labore: profile.fixed_costs_monthly?.pro_labore,
        systems: profile.fixed_costs_monthly?.systems,
        other: profile.fixed_costs_monthly?.other,
        totalCents: { amountCents: fixedTotal, currency: 'BRL' },
      },
      variable_costs_per_service: {
        materials: profile.variable_costs_per_service?.materials,
        commission: profile.variable_costs_per_service?.commission,
        transportation: profile.variable_costs_per_service?.transportation,
        other: profile.variable_costs_per_service?.other,
        average_per_service: { amountCents: variableAverage, currency: 'BRL' },
      },
      costs_per_hour: profile.costs_per_hour ? {
        fixed_cost_per_hour: profile.costs_per_hour.fixed_cost_per_hour || { amountCents: 0, currency: 'BRL' },
        variable_cost_per_hour: profile.costs_per_hour.variable_cost_per_hour || { amountCents: 0, currency: 'BRL' },
        total_cost_per_hour: {
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
      store_id: storeId,
      company_id: companyId,
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
        const offering = this.serviceOfferings.get(o.offering_id);
        if (!offering) return false;
        return offering.store_id === storeId;
      });

    // Calcular receita total e ticket médio
    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.totalCents;
    }
    const averageTicket = serviceOrders.length > 0 ? totalRevenue / serviceOrders.length : 0;

    // Calcular tempos médios
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const order of serviceOrders) {
      const request = Array.from(this.serviceRequests.values())
        .find(r => r.request_id === order.request_id);

      if (request) {
        if (request.completedAt && request.createdAt) {
          const executionTime = (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
          totalExecutionTime += executionTime;
          executionTimeCount++;
        }

        const dispatch = Array.from(this.serviceDispatches.values())
          .find(d => d.request_id === request.request_id && d.status === 'accepted');

        if (dispatch && dispatch.sentAt && dispatch.respondedAt) {
          const responseTime = (new Date(dispatch.respondedAt).getTime() - new Date(dispatch.sentAt).getTime()) / (1000 * 60);
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
            const order = serviceOrders.find(so => so.request_id === r.request_id);
            return order && o.offering_id === order.offering_id;
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
      store_id: storeId,
      company_id: companyId,
      period,
      average_ticket: { amountCents: averageTicket, currency: 'BRL' },
      total_revenue: { amountCents: totalRevenue, currency: 'BRL' },
      total_services: serviceOrders.length,
      average_execution_time_minutes: avgExecutionTime,
      average_response_time_minutes: avgResponseTime,
      cancellation_rate: cancellationRate,
      cancelled_services_count: cancelledRequests,
      total_requests_count: totalRequests,
      services_at_loss: servicesAtLoss,
      services_at_loss_percentage: servicesAtLossPercentage,
      total_loss_amount: { amountCents: totalLossAmount, currency: 'BRL' },
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
    const fixedCosts = costProfile.fixed_costs_monthly.totalCents.amountCents;
    const variableCostPerService = costProfile.variable_costs_per_service.average_per_service.amountCents;
    const averageTicket = operationMetrics.average_ticket.amountCents;

    // Ponto de equilíbrio: receita = custos fixos + (custo variável * quantidade)
    // Receita = preço médio * quantidade
    // preço médio * quantidade = custos fixos + (custo variável * quantidade)
    // quantidade * (preço médio - custo variável) = custos fixos
    // quantidade = custos fixos / (preço médio - custo variável)

    const marginPerService = averageTicket - variableCostPerService;
    const breakEvenServices = marginPerService > 0 ? Math.ceil(fixedCosts / marginPerService) : 0;
    const breakEvenRevenue = breakEvenServices * averageTicket;

    const currentRevenue = operationMetrics.total_revenue.amountCents;
    const marginToBreakEven = currentRevenue - breakEvenRevenue;
    const isAboveBreakEven = marginToBreakEven >= 0;

    return {
      break_even_monthly_services: breakEvenServices,
      break_even_monthly_revenue: { amountCents: breakEvenRevenue, currency: 'BRL' },
      current_monthly_services: operationMetrics.total_services,
      current_monthly_revenue: { amountCents: currentRevenue, currency: 'BRL' },
      margin_to_break_even: marginToBreakEven,
      is_above_break_even: isAboveBreakEven,
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
    if (!offering || offering.store_id !== storeId) {
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
      .filter(o => o.offering_id === serviceOfferingId);

    if (serviceOrders.length === 0) {
      return null;
    }

    // Calcular preço médio
    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.totalCents;
    }
    const averagePrice = totalRevenue / serviceOrders.length;

    // Calcular custo médio (variável + proporcional fixo)
    const variableCost = costProfile.variable_costs_per_service.average_per_service.amountCents;
    const fixedCostPerService = costProfile.fixed_costs_monthly.totalCents.amountCents / Math.max(serviceOrders.length, 1);
    const averageCost = variableCost + fixedCostPerService;

    // Calcular margem
    const marginPerService = averagePrice - averageCost;
    const marginPercentage = averagePrice > 0 ? (marginPerService / averagePrice) * 100 : 0;
    const isProfitable = marginPerService > 0;

    const totalCost = averageCost * serviceOrders.length;

    return {
      service_offering_id: serviceOfferingId,
      service_name: offering.name,
      average_price: { amountCents: averagePrice, currency: 'BRL' },
      average_cost: { amountCents: averageCost, currency: 'BRL' },
      margin_per_service: { amountCents: marginPerService, currency: 'BRL' },
      margin_percentage: marginPercentage,
      is_profitable: isProfitable,
      services_executed_count: serviceOrders.length,
      total_revenue: { amountCents: totalRevenue, currency: 'BRL' },
      total_cost: { amountCents: totalCost, currency: 'BRL' },
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
    if (!breakEven.is_above_break_even) {
      factors.push('Operando abaixo do ponto de equilíbrio');
    }

    // Verificar taxa de cancelamento alta
    if (operationMetrics.cancellation_rate > 0.3) {
      factors.push(`Taxa de cancelamento alta (${Math.round(operationMetrics.cancellation_rate * 100)}%)`);
    }

    // Verificar serviços no prejuízo
    const unprofitableServices = serviceMargins.filter(m => !m.is_profitable).length;
    if (unprofitableServices > 0) {
      factors.push(`${unprofitableServices} serviço(s) executado(s) no prejuízo`);
    }

    // Verificar margem média baixa
    const avgMargin = serviceMargins.length > 0
      ? serviceMargins.reduce((sum, m) => sum + m.margin_percentage, 0) / serviceMargins.length
      : 0;
    if (avgMargin < 10) {
      factors.push(`Margem média baixa (${Math.round(avgMargin)}%)`);
    }

    // Determinar nível de risco
    let risk: OperationalRiskLevel = 'low';
    if (factors.length >= 3 || !breakEven.is_above_break_even) {
      risk = 'high';
    } else if (factors.length >= 2 || operationMetrics.cancellation_rate > 0.2) {
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
      .find(r => r.store_id === storeId && r.period.start === period.start && r.period.end === period.end);

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
      .filter(o => o.store_id === storeId);

    const serviceMargins: ServiceMarginAnalysis[] = [];
    for (const offering of serviceOfferings) {
      const margin = this.calculateServiceMarginAnalysis(storeId, offering.offering_id, costProfile, period);
      if (margin) {
        serviceMargins.push(margin);
      }
    }

    // Calcular margem média mensal
    const totalRevenue = serviceMargins.reduce((sum, m) => sum + m.total_revenue.amount, 0);
    const totalCost = serviceMargins.reduce((sum, m) => sum + m.total_cost.amount, 0);
    const margin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    // Calcular risco operacional
    const { risk, factors } = this.calculateOperationalRisk(breakEvenAnalysis, operationMetrics, serviceMargins);

    // Gerar alertas silenciosos (não prescritivos)
    const alerts: Array<{
      type: 'operating_at_loss' | 'below_break_even' | 'high_cancellation_rate' | 'low_margin_services';
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }> = [];

    if (!breakEvenAnalysis.is_above_break_even) {
      alerts.push({
        type: 'below_break_even',
        message: `Receita atual (R$ ${breakEvenAnalysis.current_monthly_revenue.amount.toFixed(2)}) está abaixo do ponto de equilíbrio (R$ ${breakEvenAnalysis.break_even_monthly_revenue.amount.toFixed(2)})`,
        severity: 'critical',
      });
    }

    if (operationMetrics.cancellation_rate > 0.3) {
      alerts.push({
        type: 'high_cancellation_rate',
        message: `Taxa de cancelamento de ${Math.round(operationMetrics.cancellation_rate * 100)}%`,
        severity: 'warning',
      });
    }

    const unprofitableServices = serviceMargins.filter(m => !m.is_profitable);
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
      report_id: reportId,
      store_id: storeId,
      company_id: companyId,
      actor_id: actorId,
      period,
      cost_profile: costProfile,
      operation_metrics: operationMetrics,
      break_even_analysis: breakEvenAnalysis,
      service_margins: serviceMargins,
      average_monthly_margin: {
        total_revenue: { amountCents: totalRevenue, currency: 'BRL' },
        total_cost: { amountCents: totalCost, currency: 'BRL' },
        margin: { amountCents: margin, currency: 'BRL' },
        margin_percentage: marginPercentage,
      },
      operational_risk: risk,
      risk_factors: factors,
      alerts,
      governance: {
        no_price_suggestion: true,
        no_catalog_modification: true,
        no_matching_interference: true,
        private_only: true,
      },
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.pricingAssistanceReports.set(reportId, report);

    marketplaceLogger.init('Relatório de precificação assistida gerado', {
      report_id: reportId,
      store_id: storeId,
      company_id: companyId,
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
    if (report.actor_id !== actorId) {
      throw new Error('Acesso negado: apenas o dono/gestor pode ver este relatório');
    }

    return report;
  }

  /**
   * Listar relatórios de precificação assistida
   */
  listPricingAssistanceReports(filters: {
    store_id: string;
    actor_id: string;
    starts_at?: string;
    ends_at?: string;
  }): PricingAssistanceReport[] {
    let reports = Array.from(this.pricingAssistanceReports.values())
      .filter(r => r.store_id === filters.store_id && r.actor_id === filters.actor_id);

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





