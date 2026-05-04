// backend/src/modules/marketplace/application/services/catalog-application.service.ts
// Application Service: catálogo, produtos canónicos, store products, templates (delegação ao templates module).

import type { MarketplaceTemplatesModule } from '../../marketplace-templates.service';
import type {
  ProductTemplate,
  ServiceTemplateCanonical,
  BusinessTemplate,
} from '@contracts/marketplace';

export interface IStoreProductService {
  getStoreProducts(tenantId: string, storeId: string, categoryId?: string | null): Promise<{
    domain: string;
    version: string;
    storeId: string;
    products: Array<{
      productId: string;
      name: string;
      description: string | null;
      categoryId: string | null;
      attributes?: Record<string, unknown>;
      images?: string[];
      isEnabled: boolean;
      price: { amountCents: number; currency: string } | null;
      stock: { quantity: number; unit: string } | null;
      industryId?: string;
      hubId?: string;
      is_industrial?: boolean;
    }>;
  }>;
}

export interface ICatalogOrchestrator {
  getStores(scope?: string, valueCents?: string): {
    stores: Array<{ storeId: string; name: string; templateId: string }>;
  };
  getCategories(): {
    categories: Array<{
      id: string;
      name: string;
      templates: string[];
      children?: Array<{
        id: string;
        name: string;
        templates: string[];
        children?: Array<{ id: string; name: string; templates: string[] }>;
      }>;
    }>;
  };
}

export interface ICatalogApplicationDeps {
  orchestrator: ICatalogOrchestrator;
  storeProductService: IStoreProductService;
  templatesModule: MarketplaceTemplatesModule;
}

export class CatalogApplicationService {
  constructor(private readonly deps: ICatalogApplicationDeps) {}

  /**
   * Catálogo da Loja
   * Retorna categorias compatíveis com o template da loja
   */
  getStoreCatalog(storeId: string): {
    storeId: string;
    name: string;
    templateId: string;
    categories: Array<{ id: string; name: string }>;
  } | null {
    const storesData = this.deps.orchestrator.getStores();
    const store = storesData.stores.find(s => s.storeId === storeId);
    if (!store) return null;

    const categoriesData = this.deps.orchestrator.getCategories();
    const compatibleCategories: Array<{ id: string; name: string }> = [];

    const collectCategories = (cats: typeof categoriesData.categories) => {
      for (const cat of cats) {
        if (cat.templates.includes(store.templateId)) {
          compatibleCategories.push({ id: cat.id, name: cat.name });
        }
        if (cat.children) collectCategories(cat.children);
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
   * READ-ONLY, in-memory, sem preço, estoque ou vendedor
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
        { id: 'product-001', name: 'Arroz Branco Tipo 1', description: 'Arroz branco de grão longo, pacote de 5kg', categoryId: 'food-beverages-packaged', attributes: { brand: 'Marca Genérica', weight: '5kg', unit: 'pacote' }, images: [] },
        { id: 'product-002', name: 'Feijão Preto', description: 'Feijão preto tipo 1, pacote de 1kg', categoryId: 'food-beverages-packaged', attributes: { brand: 'Marca Genérica', weight: '1kg', unit: 'pacote' }, images: [] },
        { id: 'product-003', name: 'Água Mineral', description: 'Água mineral natural, garrafa de 500ml', categoryId: 'food-beverages-beverages', attributes: { brand: 'Marca Genérica', volume: '500ml', unit: 'garrafa' }, images: [] },
        { id: 'product-004', name: 'Leite Integral', description: 'Leite integral pasteurizado, caixa de 1L', categoryId: 'food-beverages-fresh', attributes: { brand: 'Marca Genérica', volume: '1L', unit: 'caixa', type: 'integral' }, images: [] },
        { id: 'product-005', name: 'Paracetamol 500mg', description: 'Paracetamol 500mg, caixa com 20 comprimidos', categoryId: 'health-beauty-medicines', attributes: { brand: 'Marca Genérica', dosage: '500mg', quantity: '20 comprimidos', unit: 'caixa', requiresPrescription: false }, images: [] },
        { id: 'product-006', name: 'Shampoo Anticaspa', description: 'Shampoo anticaspa, frasco de 400ml', categoryId: 'health-beauty-personal-care', attributes: { brand: 'Marca Genérica', volume: '400ml', unit: 'frasco', type: 'anticaspa' }, images: [] },
        { id: 'product-007', name: 'Vitamina C 1000mg', description: 'Vitamina C 1000mg, frasco com 30 comprimidos', categoryId: 'health-beauty-vitamins', attributes: { brand: 'Marca Genérica', dosage: '1000mg', quantity: '30 comprimidos', unit: 'frasco' }, images: [] },
        { id: 'product-008', name: 'Cimento Portland', description: 'Cimento Portland comum, saco de 50kg', categoryId: 'home-construction-materials', attributes: { brand: 'Marca Genérica', weight: '50kg', unit: 'saco', type: 'portland' }, images: [] },
        { id: 'product-009', name: 'Martelo de Carpinteiro', description: 'Martelo de carpinteiro com cabo de madeira', categoryId: 'home-construction-tools', attributes: { brand: 'Marca Genérica', weight: '500g', unit: 'unidade', type: 'carpinteiro' }, images: [] },
        { id: 'product-010', name: 'Tinta Acrílica Branca', description: 'Tinta acrílica branca, balde de 18L', categoryId: 'home-construction-home-decor', attributes: { brand: 'Marca Genérica', volume: '18L', unit: 'balde', color: 'branco', type: 'acrílica' }, images: [] },
        { id: 'product-011', name: 'Smartphone Básico', description: 'Smartphone básico com tela de 6 polegadas', categoryId: 'electronics-mobile', attributes: { brand: 'Marca Genérica', screenSize: '6 polegadas', storage: '64GB', ram: '4GB', unit: 'unidade' }, images: [] },
        { id: 'product-012', name: 'Notebook Básico', description: 'Notebook básico com processador Intel Core i3', categoryId: 'electronics-computers', attributes: { brand: 'Marca Genérica', screenSize: '15.6 polegadas', storage: '256GB SSD', ram: '8GB', processor: 'Intel Core i3', unit: 'unidade' }, images: [] },
        { id: 'product-013', name: 'Camiseta Básica Masculina', description: 'Camiseta básica masculina, algodão 100%', categoryId: 'clothing-accessories-men', attributes: { brand: 'Marca Genérica', material: 'algodão 100%', sizes: ['P', 'M', 'G', 'GG'], unit: 'peça' }, images: [] },
        { id: 'product-014', name: 'Vestido Casual Feminino', description: 'Vestido casual feminino, algodão', categoryId: 'clothing-accessories-women', attributes: { brand: 'Marca Genérica', material: 'algodão', sizes: ['P', 'M', 'G'], unit: 'peça' }, images: [] },
        { id: 'product-015', name: 'Bola de Futebol', description: 'Bola de futebol oficial, tamanho 5', categoryId: 'sports-leisure-soccer', attributes: { brand: 'Marca Genérica', size: '5', material: 'couro sintético', unit: 'unidade' }, images: [] },
        { id: 'product-016', name: 'Tênis Esportivo', description: 'Tênis esportivo unissex, diversos tamanhos', categoryId: 'sports-leisure-footwear', attributes: { brand: 'Marca Genérica', sizes: ['36', '37', '38', '39', '40', '41', '42', '43'], unit: 'par' }, images: [] },
        { id: 'product-017', name: 'Livro de Ficção', description: 'Livro de ficção científica, capa dura', categoryId: 'books-media-books', attributes: { brand: 'Editora Genérica', pages: '300', format: 'capa dura', language: 'português', unit: 'unidade' }, images: [] },
        { id: 'product-018', name: 'Óleo de Motor 15W40', description: 'Óleo de motor 15W40, galão de 4L', categoryId: 'automotive-parts', attributes: { brand: 'Marca Genérica', viscosity: '15W40', volume: '4L', unit: 'galão' }, images: [] },
      ],
    };
  }

  /**
   * Produtos Ativados por Loja (Store Product Activation)
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
    const storesData = this.deps.orchestrator.getStores();
    const store = storesData.stores.find(s => s.storeId === storeId);
    if (!store) return null;
    const result = await this.deps.storeProductService.getStoreProducts(tenantId, storeId, categoryId ?? undefined);
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

  // ---------- Product / Service / Business Templates (delegação ao MarketplaceTemplatesModule) ----------

  initializeProductTemplates(): void {
    this.deps.templatesModule.initializeProductTemplates();
  }

  initializeServiceTemplatesCanonical(): void {
    this.deps.templatesModule.initializeServiceTemplatesCanonical();
  }

  initializeBusinessTemplates(): void {
    this.deps.templatesModule.initializeBusinessTemplates();
  }

  getAllBusinessTemplates(): BusinessTemplate[] {
    return this.deps.templatesModule.getAllBusinessTemplates();
  }

  getBusinessTemplate(templateId: string): BusinessTemplate | null {
    return this.deps.templatesModule.getBusinessTemplate(templateId);
  }

  getBusinessTemplatesByType(type: BusinessTemplate['type']): BusinessTemplate[] {
    return this.deps.templatesModule.getBusinessTemplatesByType(type);
  }

  recordBusinessTemplateUsage(templateId: string, companyId: string): void {
    this.deps.templatesModule.recordBusinessTemplateUsage(templateId, companyId);
  }

  getBusinessTemplateUsageAudit(templateId?: string): Array<{ templateId: string; usage_count: number; last_usedAt: string; companies: string[] }> {
    return this.deps.templatesModule.getBusinessTemplateUsageAudit(templateId);
  }

  getProductTemplatesByCategory(categoryId: string): ProductTemplate[] {
    return this.deps.templatesModule.getProductTemplatesByCategory(categoryId);
  }

  getServiceTemplatesCanonicalByCategory(categoryId: string): ServiceTemplateCanonical[] {
    return this.deps.templatesModule.getServiceTemplatesCanonicalByCategory(categoryId);
  }

  async activateLegacyProductTemplatesForStore(
    tenantId: string,
    storeId: string,
    templateIds: string[],
    options?: { import_all?: boolean; import_partial?: boolean; skip_items?: string[] }
  ): Promise<{
    imported_count: number;
    skipped_count: number;
    imported_templates: Array<{ templateId: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
  }> {
    return this.deps.templatesModule.activateLegacyProductTemplatesForStore(tenantId, storeId, templateIds, options);
  }

  importServiceTemplates(
    storeId: string,
    templateIds: string[],
    options?: { import_all?: boolean; import_partial?: boolean; skip_items?: string[] }
  ): { imported_count: number; skipped_count: number; imported_templates: Array<{ templateId: string; offering_id?: string; status: 'imported' | 'skipped' }> } {
    return this.deps.templatesModule.importServiceTemplates(storeId, templateIds, options);
  }

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
    return this.deps.templatesModule.importCanonicalCatalog(tenantId, companyId, storeId, businessTemplateId, options);
  }

  getProductTemplate(templateId: string): ProductTemplate | null {
    return this.deps.templatesModule.getProductTemplate(templateId);
  }

  getServiceTemplateCanonical(templateId: string): ServiceTemplateCanonical | null {
    return this.deps.templatesModule.getServiceTemplateCanonical(templateId);
  }

  getAllProductTemplates(): ProductTemplate[] {
    return this.deps.templatesModule.getAllProductTemplates();
  }

  getAllServiceTemplatesCanonical(): ServiceTemplateCanonical[] {
    return this.deps.templatesModule.getAllServiceTemplatesCanonical();
  }

  getTemplateUsageAudit(templateId?: string, categoryId?: string): Array<{ templateId: string; template_type: 'product' | 'service'; categoryId: string; business_template_id?: string; usage_count: number; last_usedAt: string }> {
    return this.deps.templatesModule.getTemplateUsageAudit(templateId, categoryId);
  }

  getProductTemplatesByBusinessTemplate(businessTemplateId: string): ProductTemplate[] {
    return this.deps.templatesModule.getProductTemplatesByBusinessTemplate(businessTemplateId);
  }

  getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId: string): ServiceTemplateCanonical[] {
    return this.deps.templatesModule.getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId);
  }
}