// product-offering.service.ts
// DECISION-0117 A (CP4) — ATIVAÇÃO de variante canônica + OFERTA empresarial.
//
// A empresa NÃO cria produto semântico: referencia a variante canônica (redirect
// de merge resolvido), ATIVA a relação (store_product_activations + ponte
// products/product_variants do tenant — dona do estoque actor-scoped) e cria a
// OFERTA própria (price_cents BIGINT, SKU interno, unidade comercial validada no
// registry, condições, fulfillment, status). Identidade NUNCA é copiada — nome/
// marca/mídia vivem no canônico; a oferta só guarda a relação comercial.
//
// Autoridade: canRepresentActor(merchant) provado server-side (DECISION-0113);
// recorte por categoria/ramo da empresa CLASSIFICADA via guard 0108 (embutido em
// productRepository.createProduct). Empresa só altera a PRÓPRIA oferta.
// Zero Bank writer; estoque permanece SSOT em inventory_movements (actor).

import { pool, runQueryWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { canonicalVariantService } from '@core/catalog/canonical/canonical-variant.service';
import { canonicalUnitsService } from '@core/catalog/canonical/canonical-units.service';
import { catalogCurationService } from '@core/catalog/curation/catalog-curation.service';
import { productRepository } from './product.repository';

export class ProductOfferingError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ProductOfferingError';
  }
}

/** Unidades aceitas pelo CHECK legado de product_variants.sale_unit (estoque). */
const LEGACY_VARIANT_UNITS = new Set(['un', 'kg', 'g', 'l', 'ml', 'hour', 'service']);

export interface ActivateVariantOfferInput {
  tenantId: string;
  userId: string;
  /** Page actor da loja/empresa (merchant). Autoridade provada por canRepresentActor. */
  storeActorId: string;
  /** Empresa CLASSIFICADA (governa o recorte por ramo — DECISION-0108). */
  companyId?: string | null;
  canonicalVariantId: string;
  internalSku: string;
  /** Unidade COMERCIAL da oferta (registry canônico). */
  saleUnit: string;
  priceCents: number;
  availableQuantity?: number | null;
  minQuantity?: number | null;
  conditions?: Record<string, unknown> | null;
  fulfillment?: Record<string, unknown> | null;
  locationCityId?: string | null;
  locationRegionId?: string | null;
}

export interface ActivateVariantOfferResult {
  offerId: string;
  activationId: string;
  productId: string;
  tenantVariantId: string;
  canonicalVariantId: string;
  canonicalProductId: string;
  internalSku: string;
  priceCents: number;
  status: string;
}

export const productOfferingService = {
  /**
   * Ativa a variante canônica para o merchant e cria a oferta. Idempotente por
   * (merchant, variante) — segunda chamada atualiza nada e retorna a existente.
   */
  async activateVariantAndCreateOffer(input: ActivateVariantOfferInput): Promise<{ result: ActivateVariantOfferResult; created: boolean }> {
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, input.storeActorId);
    if (!canRep) {
      throw new ProductOfferingError(403, 'OFFER_ACTOR_NOT_REPRESENTABLE',
        'Sem autoridade para representar o actor da loja (DECISION-0113).');
    }

    // ── W1 / DT-PRODUCT-PUBLISH-COMPANYID-NOT-BOUND-TO-ACTOR ──────────────────────
    // O "crachá de empresa" (companyId) que governa o guard de ramo (DECISION-0108) é
    // DERIVADO server-side do actor representado — NUNCA aceito do cliente como autoridade.
    // `input.companyId`, se vier, é só compat-check: igual ao derivado passa; diferente → 403.
    const sa = await runQueryWithTenant<{ actor_type: string; company_id: string | null }>(
      input.tenantId,
      `SELECT actor_type, company_id::text AS company_id FROM actors WHERE id = $1::uuid LIMIT 1`,
      [input.storeActorId]
    );
    if (!sa) {
      throw new ProductOfferingError(404, 'OFFER_STORE_ACTOR_NOT_FOUND',
        'Actor da loja inexistente neste tenant.');
    }
    if (sa.actor_type !== 'user' && sa.actor_type !== 'page') {
      throw new ProductOfferingError(403, 'OFFER_ACTOR_TYPE_UNSUPPORTED',
        `Tipo de actor '${sa.actor_type}' não suporta ofertar produto (esperado page de company).`);
    }
    // DECISION-0155 (W2 promulgada): produto é PJ/CNPJ-only no MVP inicial. Actor PF/user NÃO publica/oferta
    // produto (segue prestando SERVIÇO conforme gates próprios). Fail-closed ANTES de qualquer materialização/
    // oferta. Só actor 'page' de company segue para o guard de ramo (DECISION-0108). Não reabre W1: companyId
    // continua derivado server-side; este gate só restringe QUEM pode publicar (PJ-only).
    if (sa.actor_type === 'user') {
      throw new ProductOfferingError(403, 'PRODUCT_PUBLISH_PJ_ONLY',
        'Publicação/oferta de produto é exclusiva de PJ/empresa no MVP inicial (DECISION-0155); actor PF/user não publica produto. Serviço segue permitido.');
    }
    const derivedCompanyId: string | null = sa.company_id ?? null;
    if (sa.actor_type === 'page' && !derivedCompanyId) {
      throw new ProductOfferingError(403, 'OFFER_PAGE_WITHOUT_COMPANY',
        'Page-actor sem company_id não pode ofertar produto (DECISION-0108).');
    }
    if (input.companyId != null && input.companyId !== derivedCompanyId) {
      throw new ProductOfferingError(403, 'OFFER_COMPANY_MISMATCH',
        'companyId enviado não corresponde à empresa do actor representado — autoridade é server-side (W1).');
    }

    const sku = String(input.internalSku ?? '').trim();
    if (!sku) throw new ProductOfferingError(400, 'OFFER_SKU_REQUIRED', 'internalSku é obrigatório.');
    if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
      throw new ProductOfferingError(400, 'OFFER_PRICE_INVALID', 'priceCents inteiro ≥ 0 é obrigatório.');
    }
    await canonicalUnitsService.assertUnitKnown(input.saleUnit);

    // Variante canônica (redirect de merge resolvido) + produto canônico READY.
    const variant = await canonicalVariantService.resolveRedirect(input.canonicalVariantId);
    if (!variant || variant.status === 'retired') {
      // retired SEM redirect = retirada de verdade; com redirect o resolve já devolveu o vencedor.
      if (!variant) throw new ProductOfferingError(404, 'CANONICAL_VARIANT_NOT_FOUND', 'Variante canônica inexistente.');
    }
    const winnerProductId = await catalogCurationService.resolveProductRedirect(variant.canonicalProductId);
    const cp = await pool.query<{ id: string; name: string; category_id: string | null; concept_resolution_status: string; scope: string; tenant_id: string | null }>(
      `SELECT id, name, category_id, concept_resolution_status, scope, tenant_id
         FROM canonical_products WHERE id = $1::uuid LIMIT 1`,
      [winnerProductId]
    );
    const cpRow = cp.rows[0];
    if (!cpRow) throw new ProductOfferingError(404, 'CANONICAL_PRODUCT_NOT_FOUND', 'Produto canônico inexistente.');
    const visible = (cpRow.scope === 'global' && cpRow.tenant_id === null) || cpRow.tenant_id === input.tenantId;
    if (!visible) throw new ProductOfferingError(404, 'CANONICAL_NOT_VISIBLE', 'Canônico fora do escopo do tenant.');
    if (cpRow.concept_resolution_status !== 'confirmed') {
      throw new ProductOfferingError(422, 'CANONICAL_NOT_READY',
        'Produto canônico ainda não curado (READY) — oferta bloqueada (fail-closed).');
    }
    if (!cpRow.category_id) {
      throw new ProductOfferingError(422, 'CANONICAL_CATEGORY_MISSING', 'Canônico sem categoria — oferta bloqueada.');
    }

    // Idempotência: oferta existente do merchant para esta variante.
    const existing = await pool.query<{ id: string; product_id: string; internal_sku: string; price_cents: string; status: string }>(
      `SELECT id, product_id, internal_sku, price_cents, status FROM product_offers
        WHERE tenant_id = $1::uuid AND merchant_id = $2::uuid AND canonical_variant_id = $3::uuid LIMIT 1`,
      [input.tenantId, input.storeActorId, variant.id]
    );
    if (existing.rows[0]) {
      const e = existing.rows[0];
      const act = await pool.query<{ id: string }>(
        `SELECT id FROM store_product_activations WHERE store_id = $1::uuid AND canonical_variant_id = $2::uuid LIMIT 1`,
        [input.storeActorId, variant.id]
      );
      const tv = await pool.query<{ id: string }>(
        `SELECT pv.id FROM product_variants pv
          WHERE pv.tenant_id = $1::uuid AND pv.product_id = $2::uuid AND pv.canonical_variant_id = $3::uuid LIMIT 1`,
        [input.tenantId, e.product_id, variant.id]
      );
      return {
        created: false,
        result: {
          offerId: e.id,
          activationId: act.rows[0]?.id ?? '',
          productId: e.product_id,
          tenantVariantId: tv.rows[0]?.id ?? '',
          canonicalVariantId: variant.id,
          canonicalProductId: cpRow.id,
          internalSku: e.internal_sku,
          priceCents: Number(e.price_cents),
          status: e.status,
        },
      };
    }

    // 1) products do tenant (materialização por REFERÊNCIA; guard 0108 por ramo via companyId).
    const prodExisting = await pool.query<{ id: string }>(
      `SELECT id FROM products WHERE tenant_id = $1::uuid AND canonical_product_id = $2::uuid LIMIT 1`,
      [input.tenantId, cpRow.id]
    );
    let productId = prodExisting.rows[0]?.id ?? null;
    if (!productId) {
      const created = await productRepository.createProduct(input.tenantId, {
        name: cpRow.name,
        categoryId: cpRow.category_id,
        canonicalProductId: cpRow.id,
        companyId: derivedCompanyId,
        productType: 'INDUSTRIAL' as never,
      } as never);
      productId = (created as { id: string }).id;
    } else if (derivedCompanyId) {
      // Produto já materializado por outra empresa: o RAMO da empresa atual (derivada do
      // actor, W1) ainda governa. companyId omitido pelo cliente NÃO vira bypass.
      const { assertProductCategoryAllowedForCompany } = await import('./product-concept-guard');
      await assertProductCategoryAllowedForCompany(input.tenantId, cpRow.id, derivedCompanyId);
    }

    // 2) variante do TENANT (dona do estoque actor-scoped) com a PONTE canônica.
    //    sale_unit do estoque obedece o CHECK legado; a unidade COMERCIAL fica na oferta.
    const stockUnit = LEGACY_VARIANT_UNITS.has(input.saleUnit) ? input.saleUnit : 'un';
    let tenantVariantId: string;
    const tvExisting = await pool.query<{ id: string }>(
      `SELECT id FROM product_variants WHERE tenant_id = $1::uuid AND sku = $2 LIMIT 1`,
      [input.tenantId, sku]
    );
    if (tvExisting.rows[0]) {
      throw new ProductOfferingError(409, 'OFFER_SKU_TAKEN', `SKU interno '${sku}' já existe neste tenant.`);
    }
    const tvIns = await pool.query<{ id: string }>(
      `INSERT INTO product_variants (tenant_id, product_id, sku, sale_unit, canonical_variant_id, attributes, metadata)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      [input.tenantId, productId, sku, stockUnit, variant.id]
    );
    tenantVariantId = tvIns.rows[0].id;

    // 3) ATIVAÇÃO (relação loja × variante canônica) — auditável.
    const actIns = await pool.query<{ id: string }>(
      `INSERT INTO store_product_activations (tenant_id, store_id, product_id, status, canonical_variant_id, internal_sku, sale_unit)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'active', $4::uuid, $5, $6)
       RETURNING id`,
      [input.tenantId, input.storeActorId, productId, variant.id, sku, input.saleUnit]
    );

    // 4) OFERTA (relação comercial própria; nada de identidade copiada).
    const offerIns = await pool.query<{ id: string }>(
      `INSERT INTO product_offers (
         tenant_id, product_id, merchant_id, price_cents, available_quantity,
         location_region_id, location_city_id, is_active,
         canonical_variant_id, internal_sku, sale_unit, min_quantity, conditions, fulfillment, status
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, true, $8::uuid, $9, $10, $11, $12::jsonb, $13::jsonb, 'active')
       RETURNING id`,
      [
        input.tenantId, productId, input.storeActorId, input.priceCents,
        input.availableQuantity ?? null, input.locationRegionId ?? null, input.locationCityId ?? null,
        variant.id, sku, input.saleUnit, input.minQuantity ?? null,
        JSON.stringify(input.conditions ?? {}), JSON.stringify(input.fulfillment ?? {}),
      ]
    );

    return {
      created: true,
      result: {
        offerId: offerIns.rows[0].id,
        activationId: actIns.rows[0].id,
        productId,
        tenantVariantId,
        canonicalVariantId: variant.id,
        canonicalProductId: cpRow.id,
        internalSku: sku,
        priceCents: input.priceCents,
        status: 'active',
      },
    };
  },

  /** Atualiza a PRÓPRIA oferta (preço/quantidade/status). Cross-merchant → 403. */
  async updateOwnOffer(input: {
    tenantId: string;
    userId: string;
    offerId: string;
    priceCents?: number | null;
    availableQuantity?: number | null;
    status?: 'draft' | 'active' | 'inactive' | null;
  }): Promise<void> {
    const offer = await pool.query<{ merchant_id: string }>(
      `SELECT merchant_id FROM product_offers WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [input.offerId, input.tenantId]
    );
    if (offer.rowCount === 0) throw new ProductOfferingError(404, 'OFFER_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offer.rows[0].merchant_id);
    if (!canRep) {
      throw new ProductOfferingError(403, 'OFFER_ACTOR_NOT_REPRESENTABLE',
        'Empresa só altera a própria oferta (merchant não representável).');
    }
    if (input.priceCents != null && (!Number.isInteger(input.priceCents) || input.priceCents < 0)) {
      throw new ProductOfferingError(400, 'OFFER_PRICE_INVALID', 'priceCents inteiro ≥ 0.');
    }
    await pool.query(
      `UPDATE product_offers SET
         price_cents = COALESCE($3, price_cents),
         available_quantity = COALESCE($4, available_quantity),
         status = COALESCE($5, status),
         is_active = (COALESCE($5, status) = 'active'),
         updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [input.offerId, input.tenantId, input.priceCents ?? null, input.availableQuantity ?? null, input.status ?? null]
    );
  },
};
