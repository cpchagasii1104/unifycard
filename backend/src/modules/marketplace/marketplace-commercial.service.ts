// backend/src/modules/marketplace/marketplace.service.commercial.ts
// Modulo Commercial (vitrine, stores, catalog, canonical/store products)

import type { MarketplaceService } from './marketplace.service';
import { storeProductService } from './store-product.service';

export class MarketplaceCommercialModule {
  constructor(private readonly facade: MarketplaceService) {}
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

}