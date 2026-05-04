// backend/src/modules/marketplace/marketplace-templates.service.ts
// Módulo de templates e catálogo (estado e lógica extraídos da facade).

import type { MarketplaceService } from './marketplace.service';
import type {
  ProductTemplate,
  ServiceTemplateCanonical,
  BusinessTemplate,
} from '@contracts/marketplace';
import { productCatalogService } from './product-catalog.service';
import { storeProductService } from './store-product.service';
import { marketplaceLogger } from './marketplace.logger';

export class MarketplaceTemplatesModule {
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

  constructor(private readonly facade: MarketplaceService) {}

  initializeProductTemplates(): void {
    const templates: ProductTemplate[] = [
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
        attributes: { volume: '1kg', embalagem: 'plástico' },
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
        attributes: { volume: '900ml', embalagem: 'plástico' },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { volume: '20 comprimidos', embalagem: 'cartela', prescricao: 'isento' },
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
        attributes: { volume: '20 comprimidos', embalagem: 'cartela', prescricao: 'isento' },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { volume: '350ml', embalagem: 'lata', teor_alcoolico: '4.5%' },
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
        attributes: { volume: '2L', embalagem: 'PET' },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { volume: '50kg', embalagem: 'papel' },
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
        attributes: { volume: '1000 unidades', embalagem: 'pallet' },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];
    for (const template of templates) {
      this.productTemplates.set(template.templateId, template);
    }
    marketplaceLogger.init('Product templates canônicos inicializados', { count: templates.length });
  }

  initializeServiceTemplatesCanonical(): void {
    const templates: ServiceTemplateCanonical[] = [
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
        attributes: { requires_vehicle: true, max_distance_km: 10 },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { requires_license: true },
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
        attributes: { requires_license: true, requires_appointment: true },
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
        attributes: { requires_license: true, requires_appointment: true },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { billingCycle: 'monthly' },
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
        attributes: { requires_certification: true },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { requires_appointment: true },
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
        attributes: { requires_appointment: true },
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
        attributes: { requires_appointment: true },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
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
        attributes: { requires_quote: true, min_guests: 10 },
        version: 'v1',
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];
    for (const template of templates) {
      this.serviceTemplatesCanonical.set(template.templateId, template);
    }
    marketplaceLogger.init('Service templates canônicos inicializados', { count: templates.length });
  }

  initializeBusinessTemplates(): void {
    const templates: BusinessTemplate[] = [
      {
        templateId: 'supermarket',
        name: 'Supermercado',
        description: 'Supermercado com produtos industrializados e próprios',
        type: 'supermarket',
        version: 'v2.0',
        categoryIds: ['cat-supermarket'],
        allowedProductTypes: 'both',
        defaultProductTemplates: ['prod-template-rice-1kg', 'prod-template-beans-1kg', 'prod-template-oil-900ml'],
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
        flags: { allowsOwnProducts: true, allowsIndustrialProducts: true, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'pharmacy',
        name: 'Farmácia',
        description: 'Farmácia com medicamentos e produtos de saúde',
        type: 'pharmacy',
        version: 'v2.0',
        categoryIds: ['cat-medicines', 'cat-health'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: ['prod-template-paracetamol', 'prod-template-ibuprofen'],
        defaultServiceTemplates: ['service-template-prescription', 'service-template-consultation'],
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
        flags: { allowsOwnProducts: false, allowsIndustrialProducts: true, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'beverage_distributor',
        name: 'Distribuidora de Bebidas',
        description: 'Distribuidora de bebidas alcoólicas e não alcoólicas',
        type: 'beverage_distributor',
        version: 'v2.0',
        categoryIds: ['cat-beverages'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: ['prod-template-beer-350ml', 'prod-template-soda-2l'],
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
        flags: { allowsOwnProducts: false, allowsIndustrialProducts: true, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'gym',
        name: 'Academia',
        description: 'Academia com serviços de treinamento e mensalidades',
        type: 'gym',
        version: 'v2.0',
        categoryIds: ['cat-fitness'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: ['service-template-gym-membership', 'service-template-personal-training'],
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
        flags: { allowsOwnProducts: true, allowsIndustrialProducts: false, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'clinic',
        name: 'Clínica Médica',
        description: 'Clínica médica com consultas e exames',
        type: 'clinic',
        version: 'v2.0',
        categoryIds: ['cat-health'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: [],
        defaultServiceTemplates: ['service-template-consultation', 'service-template-exam'],
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
        flags: { allowsOwnProducts: false, allowsIndustrialProducts: true, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'service_provider',
        name: 'Prestador de Serviços',
        description: 'Prestador de serviços gerais (limpeza, manutenção, etc.)',
        type: 'service_provider',
        version: 'v2.0',
        categoryIds: ['cat-home-services'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: ['service-template-cleaning', 'service-template-maintenance'],
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
        flags: { allowsOwnProducts: true, allowsIndustrialProducts: false, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'restaurant',
        name: 'Restaurante',
        description: 'Restaurante com cardápio e serviços de catering',
        type: 'restaurant',
        version: 'v2.0',
        categoryIds: ['cat-food'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: ['service-template-catering'],
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
        flags: { allowsOwnProducts: true, allowsIndustrialProducts: false, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'construction_material',
        name: 'Material de Construção',
        description: 'Loja de materiais de construção',
        type: 'construction_material',
        version: 'v2.0',
        categoryIds: ['cat-construction'],
        allowedProductTypes: 'both',
        defaultProductTemplates: ['prod-template-cement-50kg', 'prod-template-brick'],
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
        flags: { allowsOwnProducts: true, allowsIndustrialProducts: true, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'beauty_services',
        name: 'Salão de Beleza',
        description: 'Salão de beleza com serviços de corte, manicure, etc.',
        type: 'beauty_services',
        version: 'v2.0',
        categoryIds: ['cat-beauty'],
        allowedProductTypes: 'own',
        defaultProductTemplates: [],
        defaultServiceTemplates: ['service-template-haircut', 'service-template-manicure', 'service-template-facial'],
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
        flags: { allowsOwnProducts: true, allowsIndustrialProducts: false, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
      {
        templateId: 'health_clinic',
        name: 'Clínica de Saúde',
        description: 'Clínica de saúde com consultas e exames',
        type: 'health_clinic',
        version: 'v2.0',
        categoryIds: ['cat-health'],
        allowedProductTypes: 'industrialized',
        defaultProductTemplates: [],
        defaultServiceTemplates: ['service-template-consultation', 'service-template-exam'],
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
        flags: { allowsOwnProducts: false, allowsIndustrialProducts: true, allowsServices: true },
        createdAt: new Date().toISOString(),
        immutable: true,
      },
    ];
    for (const template of templates) {
      this.businessTemplates.set(template.templateId, template);
    }
    marketplaceLogger.init('Business templates (arquétipos) inicializados', { count: templates.length });
  }

  getAllBusinessTemplates(): BusinessTemplate[] {
    return Array.from(this.businessTemplates.values());
  }

  getBusinessTemplate(templateId: string): BusinessTemplate | null {
    return this.businessTemplates.get(templateId) || null;
  }

  getBusinessTemplatesByType(type: BusinessTemplate['type']): BusinessTemplate[] {
    return Array.from(this.businessTemplates.values()).filter(t => t.type === type);
  }

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

  getProductTemplatesByCategory(categoryId: string): ProductTemplate[] {
    return Array.from(this.productTemplates.values()).filter(t => t.categoryId === categoryId);
  }

  getServiceTemplatesCanonicalByCategory(categoryId: string): ServiceTemplateCanonical[] {
    return Array.from(this.serviceTemplatesCanonical.values()).filter(t => t.categoryId === categoryId);
  }

  /**
   * Activa ofertas de loja a partir da matriz legada em memória (templates).
   * Trilho canónico preferencial: `storeOnboardingService.createStoreOnboarding` (Fase 4 — `PRODUTO_PLANO_MESTRE_COMPLETO.md`).
   */
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
    const imported: Array<{ templateId: string; store_product_id?: string; status: 'imported' | 'skipped' }> = [];
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
      imported.push({ templateId: templateId, store_product_id: productId, status: 'imported' });
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
    return { imported_count: importedCount, skipped_count: skippedCount, imported_templates: imported };
  }

  importServiceTemplates(
    storeId: string,
    templateIds: string[],
    options?: { import_all?: boolean; import_partial?: boolean; skip_items?: string[] }
  ): {
    imported_count: number;
    skipped_count: number;
    imported_templates: Array<{ templateId: string; offering_id?: string; status: 'imported' | 'skipped' }>;
  } {
    const imported: Array<{ templateId: string; offering_id?: string; status: 'imported' | 'skipped' }> = [];
    let importedCount = 0;
    let skippedCount = 0;
    for (const templateId of templateIds) {
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
      const existingOffering = Array.from(this.facade.serviceOfferings.values()).find(
        (so: { templateId?: string; storeId?: string }) => so.templateId === templateId && so.storeId === storeId
      );
      if (existingOffering) {
        imported.push({ templateId: templateId, status: 'skipped' });
        skippedCount++;
        continue;
      }
      const offeringId = `offering-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const offering = {
        offering_id: offeringId,
        storeId: storeId,
        templateId: templateId,
        price: { amountCents: 0, currency: 'BRL' },
        duration_minutes: template.defaultDurationMinutes || 60,
        recurrence: (template.type === 'recurring' ? 'monthly' : undefined) as 'weekly' | 'monthly' | undefined,
        isActive: false,
      };
      this.facade.createServiceOffering(offering);
      imported.push({ templateId: templateId, offering_id: offeringId, status: 'imported' });
      importedCount++;

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
    return { imported_count: importedCount, skipped_count: skippedCount, imported_templates: imported };
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
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) {
      throw new Error('Business template não encontrado');
    }
    const onboarding = this.facade.company.getCompanyOnboardingByCompanyId(companyId);
    if (!onboarding) {
      throw new Error('Onboarding não encontrado');
    }
    const importedCategories = businessTemplate.categoryIds.length;

    let productTemplateIds: string[] = [];
    if (options?.import_all) {
      productTemplateIds = this.getProductTemplatesByBusinessTemplate(businessTemplateId).map(t => t.templateId);
    } else if (options?.product_template_ids) {
      productTemplateIds = options.product_template_ids;
    } else {
      productTemplateIds = businessTemplate.defaultProductTemplates ?? [];
    }
    const productImportResult = await this.activateLegacyProductTemplatesForStore(tenantId, storeId, productTemplateIds, {
      import_all: options?.import_all,
      import_partial: options?.import_partial,
      skip_items: options?.skip_product_templates,
    });

    let serviceTemplateIds: string[] = [];
    if (options?.import_all) {
      serviceTemplateIds = this.getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId).map(t => t.templateId);
    } else if (options?.serviceTemplateIds) {
      serviceTemplateIds = options.serviceTemplateIds;
    } else {
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

  getProductTemplate(templateId: string): ProductTemplate | null {
    return this.productTemplates.get(templateId) || null;
  }

  getServiceTemplateCanonical(templateId: string): ServiceTemplateCanonical | null {
    return this.serviceTemplatesCanonical.get(templateId) || null;
  }

  getAllProductTemplates(): ProductTemplate[] {
    return Array.from(this.productTemplates.values());
  }

  getAllServiceTemplatesCanonical(): ServiceTemplateCanonical[] {
    return Array.from(this.serviceTemplatesCanonical.values());
  }

  getTemplateUsageAudit(
    templateId?: string,
    categoryId?: string
  ): Array<{
    templateId: string;
    template_type: 'product' | 'service';
    categoryId: string;
    business_template_id?: string;
    usage_count: number;
    last_usedAt: string;
  }> {
    let audits = Array.from(this.templateUsageAudit.values());
    if (templateId) audits = audits.filter(a => a.templateId === templateId);
    if (categoryId) audits = audits.filter(a => a.categoryId === categoryId);
    return audits;
  }

  getProductTemplatesByBusinessTemplate(businessTemplateId: string): ProductTemplate[] {
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) return [];
    const templates: ProductTemplate[] = [];
    for (const templateId of businessTemplate.defaultProductTemplates ?? []) {
      const template = this.productTemplates.get(templateId);
      if (template) templates.push(template);
    }
    return templates;
  }

  getServiceTemplatesCanonicalByBusinessTemplate(businessTemplateId: string): ServiceTemplateCanonical[] {
    const businessTemplate = this.businessTemplates.get(businessTemplateId);
    if (!businessTemplate) return [];
    const templates: ServiceTemplateCanonical[] = [];
    for (const templateId of businessTemplate.defaultServiceTemplates) {
      const template = this.serviceTemplatesCanonical.get(templateId);
      if (template) templates.push(template);
    }
    return templates;
  }
}