// backend/src/modules/marketplace/store-onboarding.service.ts
// Store Onboarding Service
// 🔴 BLINDAGEM: Loja apenas seleciona recortes; não cria categorias.
// Materializa `products` (tenant) a partir de `canonical_products` antes de `product_offers` (FK → products.id).
// Modelo interno camelCase + conversão explícita a partir do banco — §5.2–5.3 (07_NOMENCLATURA_CANONICA.md).

import type {
  StoreOnboardingInput,
  StoreOnboardingResult,
  AvailableCatalogProduct,
  CategoryProductStats,
} from './store-onboarding.types';
import { marketplaceCategoriesService } from './marketplace-categories.service';
import { productCatalogService } from './product-catalog.service';
import { assertProductCategoryAllowedForCompany } from './product-concept-guard';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { ForbiddenError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import {
  logGovernanceCategoryMissingN1,
  logGovernanceCategoryValidationFailed,
  logStoreOnboardingCompleted,
  logStoreOnboardingFailed,
  type StoreOnboardingCategorySource,
  type StoreOnboardingLogContext,
} from '@core/observability/marketplace-store-onboarding.observability';
import { recordBusinessAuditSafely } from '@modules/business-audit/business-audit.helpers';
import { createCanonicalIndustrialCommand } from '@commands/catalog.commands';
import type { CanonicalProductPersistRow } from '@core/catalog/canonical/canonical-product.repository';
import {
  sqlCanonicalIdMatchesTenantContext,
  sqlCanonicalIndustrialOperationalReady,
  sqlOrderScopedCanonicalFirst,
} from '@core/catalog/canonical/canonical-product-readiness';

/** Catálogo canónico no domínio do serviço (camelCase — §5.2). */
interface CatalogCanonicalProduct {
  id: string;
  tenantId: string; // vazio quando canónico global (tenant_id NULL na origem)
  gtin: string;
  name: string;
  brand: string | null;
  images: string[];
  attributes: Record<string, any>;
  categoryId: string | null;
}

interface CatalogCanonicalProductDbRow {
  id: string;
  tenant_id: string | null;
  gtin: string | null;
  name: string;
  brand: string | null;
  images: unknown;
  attributes: unknown;
  category_id: string | null;
}

interface ProductOffer {
  id: string;
  tenantId: string;
  productId: string;
  merchantId: string;
  priceCents: string | number;
  availableQuantity: number | null;
  locationRegionId: string | null;
  locationCityId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductOfferDbRow {
  id: string;
  tenant_id: string;
  product_id: string;
  merchant_id: string;
  price_cents: string | number;
  available_quantity: number | null;
  location_region_id: string | null;
  location_city_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

class StoreOnboardingService {
  private fromDbCatalogCanonical(row: CatalogCanonicalProductDbRow): CatalogCanonicalProduct {
    const images = Array.isArray(row.images)
      ? row.images.filter((x): x is string => typeof x === 'string')
      : [];
    const attributes =
      row.attributes &&
      typeof row.attributes === 'object' &&
      !Array.isArray(row.attributes)
        ? (row.attributes as Record<string, any>)
        : {};
    return {
      id: row.id,
      tenantId: row.tenant_id ?? '',
      gtin: row.gtin ?? '',
      name: row.name,
      brand: row.brand,
      images,
      attributes,
      categoryId: row.category_id,
    };
  }

  private fromDbProductOffer(row: ProductOfferDbRow): ProductOffer {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      merchantId: row.merchant_id,
      priceCents: row.price_cents,
      availableQuantity: row.available_quantity,
      locationRegionId: row.location_region_id,
      locationCityId: row.location_city_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPersistRowToCatalogCanonical(row: CanonicalProductPersistRow): CatalogCanonicalProduct {
    const images = Array.isArray(row.images)
      ? row.images.filter((x): x is string => typeof x === 'string')
      : [];
    const attributes =
      row.attributes &&
      typeof row.attributes === 'object' &&
      !Array.isArray(row.attributes)
        ? (row.attributes as Record<string, any>)
        : {};
    return {
      id: row.id,
      tenantId: row.tenantId ?? '',
      gtin: row.gtin ?? '',
      name: row.name,
      brand: row.brand,
      images,
      attributes,
      categoryId: row.categoryId,
    };
  }

  /**
   * PONTE Estágio 4 (DECISION Op1 / Clayton 2026-06-05): resolve o company_type da FONTE CORRETA.
   * Com `companyId` → `companies.primary_company_type_id` (a empresa CLASSIFICADA é a fonte; o tenant NÃO vence;
   * sem classificação → null, sem fallback p/ tenant — não recriar segunda verdade). Sem `companyId` → path
   * LEGADO/compat lê `tenants.company_type_id`. NUNCA popular `tenants.company_type_id` para "fazer funcionar".
   */
  private async resolveStage4CompanyTypeId(tenantId: string, companyId?: string): Promise<string | null> {
    if (companyId) {
      const c = await runQueryWithTenant<{ t: string | null }>(
        tenantId,
        `SELECT primary_company_type_id::text AS t FROM companies WHERE company_id = $1 AND tenant_id = $2 LIMIT 1`,
        [companyId, tenantId]
      );
      return c?.t ?? null;
    }
    const tenantRow = await runQueryWithTenant<{ t: string | null }>(
      tenantId,
      `SELECT company_type_id::text AS t FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    return tenantRow?.t ?? null;
  }

  /**
   * Resolve categorias de onboarding a partir do tipo de empresa (`company_types.default_*_slugs`).
   * Não cria categorias — só resolve IDs de slugs globais existentes. Fonte do company_type via
   * `resolveStage4CompanyTypeId` (empresa classificada vence; tenant é legado).
   */
  private async resolveOnboardingCategories(
    tenantId: string,
    companyId?: string
  ): Promise<{ departmentCategoryId: string; selectedCategoryIds: string[] } | null> {
    const companyTypeId = await this.resolveStage4CompanyTypeId(tenantId, companyId);

    if (!companyTypeId) return null;

    const typeRow = await runQueryWithTenant<{
      default_department_slugs: string[] | null;
      default_branch_slugs: string[] | null;
    }>(
      tenantId,
      `SELECT default_department_slugs, default_branch_slugs
       FROM company_types WHERE id = $1 LIMIT 1`,
      [companyTypeId]
    );

    if (!typeRow) return null;

    const defaultDepartmentSlugs = typeRow.default_department_slugs ?? [];
    const defaultBranchSlugs = typeRow.default_branch_slugs ?? [];
    if (defaultDepartmentSlugs.length === 0) return null;

    const allSlugs = [...defaultDepartmentSlugs, ...defaultBranchSlugs];
    const rows = await runQueriesWithTenant<{
      category_id: string;
      slug: string;
    }>(
      tenantId,
      `SELECT category_id, slug FROM categories
       WHERE slug = ANY($1::text[]) AND is_active = true`,
      [allSlugs]
    );

    const bySlug = new Map(rows.map((r) => [r.slug, r.category_id]));

    const departmentCategoryId = bySlug.get(defaultDepartmentSlugs[0]!);
    if (!departmentCategoryId) return null;

    const selectedCategoryIds = defaultBranchSlugs
      .map((s) => bySlug.get(s))
      .filter((id): id is string => !!id);

    if (selectedCategoryIds.length === 0) return null;

    return { departmentCategoryId, selectedCategoryIds };
  }

  /**
   * Contexto para logs/métricas (não altera decisão de negócio). PONTE: com `companyId`, o company_type e o
   * concept vêm da empresa CLASSIFICADA (`companies.primary_company_type_id`/`primary_concept_id`); sem
   * `companyId`, do tenant (legado). Não recria segunda verdade.
   */
  private async loadTenantOnboardingAuditContext(
    tenantId: string,
    companyId?: string
  ): Promise<{ companyTypeId: string | null; conceptIds: string[] }> {
    if (companyId) {
      const c = await runQueryWithTenant<{ company_type_id: string | null; concept_id: string | null }>(
        tenantId,
        `SELECT primary_company_type_id::text AS company_type_id, primary_concept_id::text AS concept_id
           FROM companies WHERE company_id = $1 AND tenant_id = $2 LIMIT 1`,
        [companyId, tenantId]
      );
      if (!c) return { companyTypeId: null, conceptIds: [] };
      return { companyTypeId: c.company_type_id, conceptIds: c.concept_id ? [c.concept_id] : [] };
    }
    const row = await runQueryWithTenant<{
      company_type_id: string | null;
      concept_ids: string[] | null;
    }>(
      tenantId,
      `
      SELECT t.company_type_id,
             COALESCE(
               array_agg(DISTINCT c.concept_id::text) FILTER (WHERE c.concept_id IS NOT NULL),
               ARRAY[]::text[]
             ) AS concept_ids
      FROM tenants t
      LEFT JOIN company_type_allowed_concepts ctac ON ctac.company_type_id = t.company_type_id
      LEFT JOIN concepts c ON c.concept_id = ctac.concept_id
      WHERE t.id = $1
      GROUP BY t.company_type_id
      `,
      [tenantId]
    );
    if (!row) {
      return { companyTypeId: null, conceptIds: [] };
    }
    const raw = row.concept_ids;
    const conceptIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
    return { companyTypeId: row.company_type_id, conceptIds };
  }

  /**
   * Cria onboarding de loja
   * 🔴 BLINDAGEM: Seleciona categorias; para cada canónico INDUSTRIAL cria ou reutiliza `products` e depois `product_offers`.
   */
  async createStoreOnboarding(
    tenantId: string,
    input: StoreOnboardingInput,
    createdByActorId: string,
    createdByUserId?: string,
    logContext?: StoreOnboardingLogContext
  ): Promise<StoreOnboardingResult> {
    // ── W1 SLICE-B / DT-PRODUCT-PUBLISH-COMPANYID-NOT-BOUND-TO-ACTOR ──────────────────
    // O companyId que governa o guard de ramo (DECISION-0108) é DERIVADO server-side do
    // STORE ACTOR representado (input.actorId — já provado por canRepresentActor na rota),
    // NUNCA aceito do cliente como autoridade. input.companyId vira compat-check.
    const storeActorRow = await runQueryWithTenant<{ actor_type: string; company_id: string | null }>(
      tenantId,
      `SELECT actor_type, company_id::text AS company_id FROM actors WHERE id = $1::uuid LIMIT 1`,
      [input.actorId]
    );
    if (!storeActorRow) {
      throw new ForbiddenError(
        'STORE_ONBOARDING_ACTOR_NOT_FOUND: store actor inexistente neste tenant',
        ErrorCode.FORBIDDEN
      );
    }
    if (storeActorRow.actor_type !== 'user' && storeActorRow.actor_type !== 'page') {
      throw new ForbiddenError(
        `STORE_ONBOARDING_ACTOR_TYPE_UNSUPPORTED: actor_type '${storeActorRow.actor_type}' não suporta onboarding de loja`,
        ErrorCode.FORBIDDEN
      );
    }
    const derivedCompanyId: string | undefined = storeActorRow.company_id ?? undefined;
    if (storeActorRow.actor_type === 'page' && !derivedCompanyId) {
      throw new ForbiddenError(
        'STORE_ONBOARDING_PAGE_WITHOUT_COMPANY: page-actor sem company_id não pode onboardar loja (DECISION-0108)',
        ErrorCode.FORBIDDEN
      );
    }
    if (input.companyId != null && input.companyId !== derivedCompanyId) {
      throw new ForbiddenError(
        'STORE_ONBOARDING_COMPANY_MISMATCH: companyId enviado não corresponde à empresa do store actor representado (autoridade server-side, W1)',
        ErrorCode.FORBIDDEN
      );
    }

    const auditCtx = await this.loadTenantOnboardingAuditContext(tenantId, derivedCompanyId);

    let resolvedInput: StoreOnboardingInput = input;
    let inheritedApplied = false;
    if (!input.departmentCategoryId) {
      // PONTE: deriva da empresa classificada (companies.primary_company_type_id) quando há companyId.
      const inherited = await this.resolveOnboardingCategories(tenantId, derivedCompanyId);
      if (inherited) {
        resolvedInput = {
          ...input,
          departmentCategoryId: inherited.departmentCategoryId,
          selectedCategoryIds: [
            ...inherited.selectedCategoryIds,
            ...(input.selectedCategoryIds ?? []),
          ],
        };
        inheritedApplied = true;
      }
    }

    const categorySource: StoreOnboardingCategorySource =
      !input.departmentCategoryId && inheritedApplied
        ? 'company_type_inherited'
        : 'request_body';

    const deptId = resolvedInput.departmentCategoryId;
    const selectedIds = resolvedInput.selectedCategoryIds ?? [];
    if (!deptId) {
      logStoreOnboardingFailed(logContext, {
        tenantId,
        companyTypeId: auditCtx.companyTypeId,
        conceptIds: auditCtx.conceptIds,
        reason: 'missing_department_category',
        categorySource,
      });
      throw new Error(
        'Onboarding: informe departmentCategoryId ou associe tenants.company_type_id com default_department_slugs / default_branch_slugs.'
      );
    }

    const scopeCategoryIds = [deptId, ...selectedIds];
    await this.validateMarketplaceCategories(tenantId, scopeCategoryIds, logContext);

    const seedCategoryIds = [
      ...new Set((resolvedInput.seedCanonicalLines ?? []).map((l) => l.categoryId)),
    ];
    if (seedCategoryIds.length > 0) {
      await this.validateMarketplaceCategories(tenantId, seedCategoryIds, logContext);
      for (const cid of seedCategoryIds) {
        if (!scopeCategoryIds.includes(cid)) {
          logGovernanceCategoryValidationFailed(logContext, {
            tenantId,
            kind: 'seed_category_out_of_scope',
            categoryId: cid,
            message: `seedCanonicalLines: categoria ${cid} fora do recorte do onboarding (department + selected).`,
          });
          throw new Error(
            `seedCanonicalLines: categoria ${cid} fora do recorte do onboarding (department + selected).`
          );
        }
      }
    }

    // 2. Importar categorias selecionadas para a loja
    await marketplaceCategoriesService.importCategories(
      tenantId,
      resolvedInput.actorId,
      {
        categoryIds: [deptId, ...selectedIds],
        metadata: {
          onboardingDate: new Date().toISOString(),
          hasOwnProducts: resolvedInput.hasOwnProducts,
          ...resolvedInput.metadata,
        },
      },
      createdByActorId
    );

    // 3. Buscar produtos do catálogo canônico nas categorias selecionadas + seeds deduplicados
    let catalogProducts = await this.findCatalogProductsByCategories(
      tenantId,
      selectedIds
    );
    catalogProducts = await this.mergeSeedCanonicalLines(
      tenantId,
      catalogProducts,
      resolvedInput.seedCanonicalLines ?? []
    );

    // 4. CANONICAL → PRODUCT → OFFER (product_offers.product_id → products.id)
    let createdOffersCount = 0;
    for (const canonical of catalogProducts) {
      if (!canonical.categoryId) {
        throw new Error(
          `Produto canónico ${canonical.id} sem categoryId; não é possível materializar products para o tenant.`
        );
      }

      let tenantProduct = await productCatalogService.getProductByCanonicalId(tenantId, canonical.id);
      if (!tenantProduct) {
        tenantProduct = await productCatalogService.createProduct(tenantId, {
          name: canonical.name,
          description: null,
          categoryId: canonical.categoryId,
          canonicalProductId: canonical.id,
          // DECISION-0108: empresa CLASSIFICADA governa o recorte por categoria/ramo no guard
          // (companies.primary_company_type_id; nunca tenants.company_type_id no fluxo PJ novo).
          // W1 Slice-B: company DERIVADO server-side do store actor (não client-asserted).
          companyId: derivedCompanyId,
          productType: 'industrial',
          isActive: true,
          metadata: {
            source: 'store_onboarding',
            ...(canonical.gtin ? { gtin: canonical.gtin } : {}),
            ...(canonical.brand ? { brand: canonical.brand } : {}),
          },
        });
      }

      const tenantProductId = tenantProduct.id;

      const existingOffer = await this.findOfferByProductAndMerchant(
        tenantId,
        tenantProductId,
        resolvedInput.actorId
      );

      // Op2 (Trilho A): a oferta (preço/estoque/disponibilidade) é PROJEÇÃO operacional da empresa e exige
      // FONTE REAL de preço (`defaultSalePrice`). `product_offers.price_cents` é NOT NULL — o antigo
      // `?? 0` FABRICAVA preço-zero quando o merchant não informava preço (etiqueta falsa). Sem preço real,
      // o produto NASCE NA PRATELEIRA (`products` materializado) SEM oferta — não se inventa preço.
      const salePrice = resolvedInput.defaultSalePrice;
      const hasRealPrice = typeof salePrice === 'number' && Number.isFinite(salePrice) && salePrice >= 0;
      if (!existingOffer && hasRealPrice) {
        // DECISION-0108 na camada de OFERTA (prateleira): reaplica o recorte por categoria/ramo ANTES de
        // ativar a `product_offer`. Fecha a fresta do REUSO — quando o `product` já existia no tenant
        // (`createProduct` pulado), o guard de MATERIALIZAÇÃO não rodou; aqui a empresa só ATIVA na
        // prateleira itens elegíveis pelos seus ramos. `derivedCompanyId` (W1 Slice-B) presente →
        // fail-closed por categoria fora do ramo; ausente (PF/legado, derivado NULL) → bypass compat.
        // HARDENING FEITO (W1 Slice-B): company derivado server-side de `actors.company_id` via store
        // actor (input.actorId); companyId omitido pelo cliente NÃO bypassa o guard para actor de empresa.
        await assertProductCategoryAllowedForCompany(tenantId, canonical.id, derivedCompanyId);
        await this.createProductOffer(tenantId, {
          productId: tenantProductId,
          merchantId: resolvedInput.actorId,
          priceCents: Math.round(salePrice * 100),
          availableQuantity: resolvedInput.defaultStock ?? null,
          isActive: true,
        });
        createdOffersCount++;
      }
    }

    // 5. Registrar auditoria
    await recordBusinessAuditSafely(tenantId, {
      action: 'MARKETPLACE_STORE_ONBOARDED',
      actorId: createdByActorId,
      userId: createdByUserId ?? undefined,
      contextType: 'ACTOR',
      contextId: resolvedInput.actorId,
      metadata: {
        departmentCategoryId: deptId,
        selectedCategoryIds: selectedIds,
        hasOwnProducts: resolvedInput.hasOwnProducts,
        importedProductsCount: catalogProducts.length,
        createdOffersCount,
      },
    });

    logStoreOnboardingCompleted(logContext, {
      tenantId,
      companyTypeId: auditCtx.companyTypeId,
      conceptIds: auditCtx.conceptIds,
      storeActorId: resolvedInput.actorId,
      importerActorId: createdByActorId,
      categorySource,
      departmentCategoryId: deptId,
      importedCategoryIds: scopeCategoryIds,
      selectedBranchCount: selectedIds.length,
      importedProductsCount: catalogProducts.length,
      createdOffersCount,
    });

    return {
      storeId: resolvedInput.actorId,
      departmentCategoryId: deptId,
      selectedCategoryIds: selectedIds,
      hasOwnProducts: resolvedInput.hasOwnProducts,
      importedProductsCount: catalogProducts.length,
      createdOffersCount,
      categoriesImported: true,
      metadata: resolvedInput.metadata,
    };
  }

  /**
   * Lista produtos do catálogo disponíveis para importação por categoria
   */
  async listAvailableCatalogProducts(
    tenantId: string,
    categoryIds: string[]
  ): Promise<AvailableCatalogProduct[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const cpVis = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
    const ready = sqlCanonicalIndustrialOperationalReady('cp');
    const scopedFirst = sqlOrderScopedCanonicalFirst('cp');
    const query = `
      SELECT DISTINCT ON (cp.gtin)
        cp.id,
        cp.tenant_id,
        cp.gtin,
        cp.name,
        cp.brand,
        cp.images,
        cp.attributes,
        cp.category_id,
        c.name as category_name
      FROM canonical_products cp
      LEFT JOIN categories c ON cp.category_id = c.category_id
      WHERE ${cpVis}
        AND cp.category_id = ANY($2::uuid[])
        AND cp.type = 'INDUSTRIAL'
        AND ${ready}
      ORDER BY cp.gtin, ${scopedFirst}, cp.name ASC
    `;

    type Row = CatalogCanonicalProductDbRow & { category_name: string | null };
    const rows = await runQueriesWithTenant<Row>(tenantId, query, [tenantId, categoryIds]);

    return rows.map((row) => {
      const canonical = this.fromDbCatalogCanonical(row);
      return {
        canonicalProductId: canonical.id,
        gtin: canonical.gtin,
        name: canonical.name,
        brand: canonical.brand || undefined,
        categoryId: canonical.categoryId || '',
        categoryName: row.category_name || '',
        images: canonical.images,
        attributes: canonical.attributes,
      };
    });
  }

  /**
   * Retorna estatísticas de produtos disponíveis por categoria
   */
  async getCategoryProductStats(
    tenantId: string,
    categoryIds: string[]
  ): Promise<CategoryProductStats[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const cpVis = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
    const ready = sqlCanonicalIndustrialOperationalReady('cp');
    const scopedFirst = sqlOrderScopedCanonicalFirst('cp');
    const query = `
      SELECT 
        c.category_id,
        c.name as category_name,
        COUNT(dedup.id) as available_products_count
      FROM categories c
      LEFT JOIN (
        SELECT DISTINCT ON (cp.gtin) cp.id, cp.category_id
        FROM canonical_products cp
        WHERE ${cpVis}
          AND cp.type = 'INDUSTRIAL'
          AND ${ready}
        ORDER BY cp.gtin, ${scopedFirst}
      ) dedup ON dedup.category_id = c.category_id
      WHERE c.category_id = ANY($2::uuid[])
        AND c.metadata->>'domain' = 'marketplace'
      GROUP BY c.category_id, c.name
      ORDER BY c.name ASC
    `;

    const rows = await runQueriesWithTenant<{
      category_id: string;
      category_name: string;
      available_products_count: string;
    }>(tenantId, query, [tenantId, categoryIds]);

    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      availableProductsCount: parseInt(row.available_products_count, 10),
    }));
  }

  /**
   * Valida que todas as categorias são do domínio marketplace
   */
  private async validateMarketplaceCategories(
    tenantId: string,
    categoryIds: string[],
    logContext?: StoreOnboardingLogContext
  ): Promise<void> {
    for (const categoryId of categoryIds) {
      const category = await marketplaceCategoriesService.getCategoryById(tenantId, categoryId);
      if (!category) {
        logGovernanceCategoryValidationFailed(logContext, {
          tenantId,
          kind: 'category_not_found',
          categoryId,
          message: `Categoria ${categoryId} não encontrada`,
        });
        throw new Error(`Categoria ${categoryId} não encontrada`);
      }
      if (category.metadata?.domain !== 'marketplace') {
        logGovernanceCategoryValidationFailed(logContext, {
          tenantId,
          kind: 'category_not_marketplace_domain',
          categoryId,
          categorySlug: category.slug ?? null,
          message: `Categoria ${categoryId} não é do domínio marketplace`,
        });
        throw new Error(`Categoria ${categoryId} não é do domínio marketplace`);
      }

      const n1Row = await runQueryWithTenant<{ one: number }>(
        tenantId,
        `SELECT 1 AS one FROM category_n1_mapping WHERE category_id = $1 LIMIT 1`,
        [categoryId]
      );
      if (!n1Row) {
        logGovernanceCategoryMissingN1(logContext, {
          tenantId,
          categoryId,
          categorySlug: category.slug ?? null,
        });
      }
    }
  }

  /**
   * Garante canónicos adicionais via pipeline (GTIN / nome+marca+categoria), sem duplicar id no conjunto.
   */
  private async mergeSeedCanonicalLines(
    tenantId: string,
    existing: CatalogCanonicalProduct[],
    seeds: { name: string; brand?: string; gtin?: string; categoryId: string }[]
  ): Promise<CatalogCanonicalProduct[]> {
    if (seeds.length === 0) {
      return existing;
    }
    const byId = new Map(existing.map((c) => [c.id, c]));
    for (const line of seeds) {
      const { row } = await createCanonicalIndustrialCommand({
        tenantId,
        name: line.name,
        brand: line.brand,
        gtin: line.gtin,
        categoryId: line.categoryId,
      });
      const mapped = this.mapPersistRowToCatalogCanonical(row);
      if (!byId.has(mapped.id)) {
        byId.set(mapped.id, mapped);
      }
    }
    return Array.from(byId.values());
  }

  /**
   * Busca produtos do catálogo canônico por categorias
   */
  private async findCatalogProductsByCategories(
    tenantId: string,
    categoryIds: string[]
  ): Promise<CatalogCanonicalProduct[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const cpVis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
    const query = `
      SELECT 
        id, tenant_id, gtin, name, brand, images, attributes, category_id
      FROM canonical_products
      WHERE ${cpVis}
        AND category_id = ANY($2::uuid[])
        AND type = 'INDUSTRIAL'
      ORDER BY name ASC
    `;

    const rows = await runQueriesWithTenant<CatalogCanonicalProductDbRow>(tenantId, query, [
      tenantId,
      categoryIds,
    ]);
    return rows.map((r) => this.fromDbCatalogCanonical(r));
  }

  /**
   * Busca oferta existente por produto e merchant
   */
  private async findOfferByProductAndMerchant(
    tenantId: string,
    productId: string,
    merchantId: string
  ): Promise<ProductOffer | null> {
    const row = await runQueryWithTenant<ProductOfferDbRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_id, merchant_id, price_cents, available_quantity, 
             location_region_id, location_city_id, is_active, created_at, updated_at
      FROM product_offers
      WHERE tenant_id = $1 AND product_id = $2 AND merchant_id = $3
      LIMIT 1
      `,
      [tenantId, productId, merchantId]
    );

    return row ? this.fromDbProductOffer(row) : null;
  }

  /**
   * Cria oferta de produto
   */
  private async createProductOffer(
    tenantId: string,
    offer: {
      productId: string;
      merchantId: string;
      priceCents: number;
      availableQuantity?: number | null;
      isActive?: boolean;
    }
  ): Promise<ProductOffer> {
    const query = `
      INSERT INTO product_offers (
        tenant_id, product_id, merchant_id, price_cents, available_quantity, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, tenant_id, product_id, merchant_id, price_cents, available_quantity, 
                location_region_id, location_city_id, is_active, created_at, updated_at
    `;

    const row = await runQueryWithTenant<ProductOfferDbRow>(tenantId, query, [
      tenantId,
      offer.productId,
      offer.merchantId,
      offer.priceCents,
      offer.availableQuantity ?? null,
      offer.isActive !== false,
    ]);

    return this.fromDbProductOffer(row!);
  }
}

export const storeOnboardingService = new StoreOnboardingService();
