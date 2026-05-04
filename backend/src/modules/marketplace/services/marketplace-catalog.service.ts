// backend/src/modules/marketplace/services/marketplace-catalog.service.ts
// Agregador: templates, catálogo, produtos canônicos, store products, business templates.
// Estado vive nos domain/application; este agregador apenas delega.

import type {
  ProductTemplate,
  ServiceTemplateCanonical,
  BusinessTemplate,
} from '@contracts/marketplace';
import type { CatalogApplicationService } from '../application/services/catalog-application.service';
import type { MarketplaceOrchestrationService } from '../application/services/marketplace-orchestration.service';

export class MarketplaceCatalogAggregatorService {
  constructor(
    private readonly catalog: CatalogApplicationService,
    private readonly orchestration: MarketplaceOrchestrationService
  ) {}

  getTemplates() {
    return this.orchestration.getTemplates();
  }

  getCategories() {
    return this.orchestration.getCategories();
  }

  getStores(scope?: string, valueCents?: string) {
    return this.orchestration.getStores(scope, valueCents);
  }

  getRegions() {
    return this.orchestration.getRegions();
  }

  getStoreCatalog(storeId: string) {
    return this.catalog.getStoreCatalog(storeId);
  }

  getCanonicalProducts() {
    return this.catalog.getCanonicalProducts();
  }

  async getStoreProducts(
    tenantId: string,
    storeId: string,
    categoryId?: string
  ) {
    return this.catalog.getStoreProducts(tenantId, storeId, categoryId ?? undefined);
  }

  initializeProductTemplates(): void {
    this.catalog.initializeProductTemplates();
  }

  initializeServiceTemplatesCanonical(): void {
    this.catalog.initializeServiceTemplatesCanonical();
  }

  initializeBusinessTemplates(): void {
    this.catalog.initializeBusinessTemplates();
  }

  getAllBusinessTemplates(): BusinessTemplate[] {
    return this.catalog.getAllBusinessTemplates();
  }

  getBusinessTemplate(templateId: string): BusinessTemplate | null {
    return this.catalog.getBusinessTemplate(templateId);
  }

  getBusinessTemplatesByType(type: BusinessTemplate['type']): BusinessTemplate[] {
    return this.catalog.getBusinessTemplatesByType(type);
  }

  recordBusinessTemplateUsage(templateId: string, companyId: string): void {
    this.catalog.recordBusinessTemplateUsage(templateId, companyId);
  }

  getBusinessTemplateUsageAudit(templateId?: string) {
    return this.catalog.getBusinessTemplateUsageAudit(templateId);
  }

  getProductTemplatesByCategory(categoryId: string): ProductTemplate[] {
    return this.catalog.getProductTemplatesByCategory(categoryId);
  }

  getServiceTemplatesCanonicalByCategory(categoryId: string): ServiceTemplateCanonical[] {
    return this.catalog.getServiceTemplatesCanonicalByCategory(categoryId);
  }

  async activateLegacyProductTemplatesForStore(
    tenantId: string,
    storeId: string,
    templateIds: string[],
    options?: { import_all?: boolean; import_partial?: boolean; skip_items?: string[] }
  ) {
    return this.catalog.activateLegacyProductTemplatesForStore(tenantId, storeId, templateIds, options);
  }

  importServiceTemplates(
    storeId: string,
    templateIds: string[],
    options?: { import_all?: boolean; import_partial?: boolean; skip_items?: string[] }
  ) {
    return this.catalog.importServiceTemplates(storeId, templateIds, options);
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
  ) {
    return this.catalog.importCanonicalCatalog(tenantId, companyId, storeId, businessTemplateId, options);
  }

  getProductTemplate(templateId: string): ProductTemplate | null {
    return this.catalog.getProductTemplate(templateId);
  }

  getServiceTemplateCanonical(templateId: string): ServiceTemplateCanonical | null {
    return this.catalog.getServiceTemplateCanonical(templateId);
  }

  getAllProductTemplates(): ProductTemplate[] {
    return this.catalog.getAllProductTemplates();
  }

  getAllServiceTemplatesCanonical(): ServiceTemplateCanonical[] {
    return this.catalog.getAllServiceTemplatesCanonical();
  }

  getTemplateUsageAudit(templateId?: string, categoryId?: string) {
    return this.catalog.getTemplateUsageAudit(templateId, categoryId);
  }

  getProductTemplatesByBusinessTemplate(businessTemplateId: string): ProductTemplate[] {
    return this.catalog.getProductTemplatesByBusinessTemplate(businessTemplateId);
  }

  getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId: string): ServiceTemplateCanonical[] {
    return this.catalog.getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId);
  }

  // --- Imported product/service activation (API explícita; implementação futura) ---

  activateImportedProduct(
    storeId: string,
    productId: string,
    price: { amountCents: number; currency: string },
    stock?: { quantity: number; unit: string }
  ): void {
    throw new Error('Imported product/service activation: not implemented');
  }

  deactivateImportedProduct(storeId: string, productId: string): void {
    throw new Error('Imported product/service activation: not implemented');
  }

  activateImportedService(
    offeringId: string,
    price: { amountCents: number; currency: string },
    duration_minutes?: number
  ): void {
    throw new Error('Imported product/service activation: not implemented');
  }

  deactivateImportedService(offeringId: string): void {
    throw new Error('Imported product/service activation: not implemented');
  }
}