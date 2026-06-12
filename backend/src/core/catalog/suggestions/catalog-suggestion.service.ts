// catalog-suggestion.service.ts
// DECISION-0117 A/B — porta de SUGESTÃO empresarial do catálogo canônico.
//
// Empresa cria OFERTA, não significado: a sugestão de produto INDUSTRIAL nasce
// scoped + unresolved (NOT READY — comércio bloqueado pelo guard vivo) e vai
// para a fila de curadoria humana. Duplicata (GTIN/fingerprint/marca
// NORMALIZADA) é vinculada, nunca duplicada. Produto LOCAL/artesanal nasce
// scoped sem GTIN, com dedup local; promoção a global só por curadoria.
//
// Autoridade: usuário autenticado, actor humano por LEITURA (regime PJ-B3 —
// nenhuma cura), vínculo canManageCompany com a empresa. Zero Bank writer.

import { pool } from '../../database/pool';
import { socialPortsRegistry } from '../../social/ports-registry';
import { companiesService } from '../../companies/companies.service';
import { canonicalProductCreationService } from '../canonical/canonical-product-creation.service';
import { canonicalConceptResolutionQueueService } from '../canonical/canonical-concept-resolution-queue.service';
import {
  canonicalVariantService,
  insertCatalogEvent,
  type CanonicalVariant,
} from '../canonical/canonical-variant.service';
import { normalizeBrandForIdentity } from '../canonical/catalog-identity';

export class CatalogSuggestionError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'CatalogSuggestionError';
  }
}

interface AuthorityContext {
  actorId: string;
}

/** Actor humano por LEITURA + canManageCompany — fail-closed (PJ-B3 estendido). */
async function assertCompanySuggestAuthority(input: {
  tenantId: string;
  userId: string;
  globalUserId: string;
  companyId: string;
}): Promise<AuthorityContext> {
  const actor = await socialPortsRegistry.getActorRepository().findByUserId(input.tenantId, input.userId);
  if (!actor?.actor_id) {
    throw new CatalogSuggestionError(
      403,
      'CATALOG_SUGGEST_ACTOR_MISSING',
      'Actor humano do usuário autenticado não existe — a sugestão de catálogo não cria/cura actors (C1 é o caminho canônico).'
    );
  }
  const canManage = await companiesService.canManageCompany(input.tenantId, input.companyId, input.globalUserId);
  if (!canManage) {
    throw new CatalogSuggestionError(
      403,
      'CATALOG_SUGGEST_FORBIDDEN',
      'Sem autoridade (canManageCompany) para sugerir itens de catálogo por esta empresa.'
    );
  }
  return { actorId: actor.actor_id };
}

export interface SuggestIndustrialProductInput {
  tenantId: string;
  userId: string;
  globalUserId: string;
  companyId: string;
  name: string;
  brand?: string | null;
  gtin?: string | null;
  categoryId: string;
  variant?: {
    variantName: string;
    gtin?: string | null;
    netContentValue?: number | null;
    netContentUnit?: string | null;
    packageType?: string | null;
    isReturnable?: boolean | null;
    discriminatorAttributes?: Record<string, unknown> | null;
  } | null;
}

export interface SuggestIndustrialProductResult {
  canonicalProductId: string;
  created: boolean;
  /** true quando a sugestão caiu numa identidade já existente (vinculada, não duplicada). */
  linkedToExisting: boolean;
  conceptResolutionStatus: string;
  pendingCuration: boolean;
  variant: CanonicalVariant | null;
}

export const catalogSuggestionService = {
  /**
   * Sugestão de produto INDUSTRIAL. Dedup em 3 camadas (fail-closed à duplicação):
   * GTIN → fingerprint (trigger) → marca NORMALIZADA (acento/caixa) + nome + categoria.
   * Caso novo: scoped + unresolved + fila pendente. NUNCA nasce global READY.
   */
  async suggestIndustrialProduct(input: SuggestIndustrialProductInput): Promise<SuggestIndustrialProductResult> {
    const auth = await assertCompanySuggestAuthority(input);

    const name = String(input.name ?? '').trim();
    const categoryId = String(input.categoryId ?? '').trim();
    if (!name || !categoryId) {
      throw new CatalogSuggestionError(400, 'CATALOG_SUGGEST_BAD_REQUEST', 'name e categoryId são obrigatórios.');
    }

    // Dedup adicional por MARCA NORMALIZADA (o trigger do banco não remove
    // acentos — "Nestlé"/"Nestle" colidiriam só aqui; pipeline é a única porta).
    const brandIdentity = normalizeBrandForIdentity(input.brand);
    let linkedToExisting = false;
    if (brandIdentity) {
      const candidates = await pool.query<{ id: string; brand: string | null }>(
        `SELECT id, brand FROM canonical_products
          WHERE type = 'INDUSTRIAL'
            AND LOWER(TRIM(name)) = LOWER(TRIM($2))
            AND category_id = $3::uuid
            AND ((scope = 'global' AND tenant_id IS NULL) OR (scope = 'scoped' AND tenant_id = $1::uuid))
          ORDER BY (scope = 'scoped') DESC, created_at ASC
          LIMIT 10`,
        [input.tenantId, name, categoryId]
      );
      const match = candidates.rows.find((c) => normalizeBrandForIdentity(c.brand) === brandIdentity);
      if (match) {
        const variant = input.variant
          ? (await canonicalVariantService.createGoverned({
              tenantId: input.tenantId,
              canonicalProductId: match.id,
              ...input.variant,
              createdByActorId: auth.actorId,
            })).variant
          : null;
        return {
          canonicalProductId: match.id,
          created: false,
          linkedToExisting: true,
          conceptResolutionStatus: 'existing',
          pendingCuration: false,
          variant,
        };
      }
    }

    const { row, created } = await canonicalProductCreationService.getOrCreateIndustrial({
      tenantId: input.tenantId,
      name,
      brand: input.brand ?? null,
      gtin: input.gtin ?? null,
      categoryId,
    });
    linkedToExisting = !created;

    if (created) {
      await insertCatalogEvent({
        entityType: 'canonical_product',
        entityId: row.id,
        eventType: 'product_suggested',
        payload: { companyId: input.companyId, gtin: input.gtin ?? null },
        actorId: auth.actorId,
        tenantId: input.tenantId,
      });
    }

    const variant = input.variant
      ? (await canonicalVariantService.createGoverned({
          tenantId: input.tenantId,
          canonicalProductId: row.id,
          ...input.variant,
          createdByActorId: auth.actorId,
        })).variant
      : null;

    return {
      canonicalProductId: row.id,
      created,
      linkedToExisting,
      conceptResolutionStatus: row.conceptResolutionStatus,
      pendingCuration: row.conceptResolutionStatus !== 'confirmed',
      variant,
    };
  },

  /**
   * Produto LOCAL/artesanal (DECISION-0117 B): nasce tenant-scoped, type='LOCAL',
   * SEM GTIN obrigatório, dedup local (fingerprint scoped via trigger + UNIQUE).
   * Usável apenas no escopo; promoção a global SÓ por curadoria humana.
   */
  async createLocalProduct(input: {
    tenantId: string;
    userId: string;
    globalUserId: string;
    companyId: string;
    name: string;
    description?: string | null;
    categoryId: string;
    attributes?: Record<string, unknown> | null;
  }): Promise<{ canonicalProductId: string; created: boolean; scope: string; type: string }> {
    const auth = await assertCompanySuggestAuthority(input);
    const name = String(input.name ?? '').trim();
    const categoryId = String(input.categoryId ?? '').trim();
    if (!name || !categoryId) {
      throw new CatalogSuggestionError(400, 'CATALOG_LOCAL_BAD_REQUEST', 'name e categoryId são obrigatórios.');
    }
    const attrsJson = JSON.stringify(
      input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)
        ? input.attributes
        : {}
    );

    try {
      const ins = await pool.query<{ id: string; scope: string; type: string }>(
        `INSERT INTO canonical_products (
           tenant_id, gtin, name, brand, images, attributes, category_id, type,
           created_by_actor_id, created_at, updated_at
         ) VALUES ($1::uuid, NULL, $2, NULL, '[]'::jsonb, $3::jsonb, $4::uuid, 'LOCAL', $5::uuid, NOW(), NOW())
         RETURNING id, scope, type`,
        [input.tenantId, name, attrsJson, categoryId, auth.actorId]
      );
      const row = ins.rows[0];
      await canonicalConceptResolutionQueueService.ensurePendingQueueEntryForCanonicalProduct(row.id);
      await insertCatalogEvent({
        entityType: 'canonical_product',
        entityId: row.id,
        eventType: 'local_product_created',
        payload: { companyId: input.companyId },
        actorId: auth.actorId,
        tenantId: input.tenantId,
      });
      return { canonicalProductId: row.id, created: true, scope: row.scope, type: row.type };
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        const existing = await pool.query<{ id: string; scope: string; type: string }>(
          `SELECT id, scope, type FROM canonical_products
            WHERE tenant_id = $1::uuid AND scope = 'scoped' AND type = 'LOCAL'
              AND fingerprint_v1 = canonical_product_fingerprint_v1(NULL, $2, NULL, $3::jsonb)
            LIMIT 1`,
          [input.tenantId, name, attrsJson]
        );
        if (existing.rows[0]) {
          return {
            canonicalProductId: existing.rows[0].id,
            created: false,
            scope: existing.rows[0].scope,
            type: existing.rows[0].type,
          };
        }
      }
      throw err;
    }
  },
};
