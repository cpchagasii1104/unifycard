// catalog-curation.service.ts
// DECISION-0117 B/G — curadoria HUMANA do catálogo canônico.
//
// Empresa NÃO cria canônico global READY: sugestões nascem scoped+unresolved
// (NOT READY — o commerce guard vivo bloqueia uso). O CURADOR (papel admin
// explícito; sem system actor improvisado) aprova/rejeita/vincula/mescla e
// pode promover scoped→global. Merge é redirect append-only (sem rewrite):
// referências antigas resolvem para o vencedor; ofertas não são destruídas.

import { pool } from '../../database/pool';
import { recordConceptResolutionHumanConfirmedAudit } from '../canonical/canonical-concept-resolution-audit';
import { insertCatalogEvent } from '../canonical/canonical-variant.service';

export class CatalogCurationError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'CatalogCurationError';
  }
}

export interface CurationQueueItem {
  queueId: string;
  canonicalProductId: string;
  productName: string;
  productBrand: string | null;
  productGtin: string | null;
  productType: string;
  productScope: string;
  tenantId: string | null;
  status: string;
  createdAt: string;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export const catalogCurationService = {
  /** Fila pendente de produtos (canonical_concept_resolution_queue) + serviços pendentes. */
  async listPending(): Promise<{
    products: CurationQueueItem[];
    services: Array<{ canonicalServiceId: string; name: string; slug: string; tenantId: string | null; conceptId: string }>;
  }> {
    const products = await pool.query<{
      queue_id: string;
      canonical_product_id: string;
      name: string;
      brand: string | null;
      gtin: string | null;
      type: string;
      scope: string;
      tenant_id: string | null;
      status: string;
      created_at: Date;
    }>(
      `SELECT q.id AS queue_id, q.canonical_product_id, cp.name, cp.brand, cp.gtin, cp.type,
              cp.scope, cp.tenant_id, q.status, q.created_at
         FROM canonical_concept_resolution_queue q
         JOIN canonical_products cp ON cp.id = q.canonical_product_id
        WHERE q.status = 'pending'
        ORDER BY q.created_at ASC`
    );
    const services = await pool.query<{ id: string; name: string; slug: string; tenant_id: string | null; concept_id: string }>(
      `SELECT id, name, slug, tenant_id, concept_id FROM canonical_services
        WHERE status = 'pending_curation' ORDER BY created_at ASC`
    );
    return {
      products: products.rows.map((r) => ({
        queueId: r.queue_id,
        canonicalProductId: r.canonical_product_id,
        productName: r.name,
        productBrand: r.brand,
        productGtin: r.gtin,
        productType: r.type,
        productScope: r.scope,
        tenantId: r.tenant_id,
        status: r.status,
        createdAt: r.created_at.toISOString(),
      })),
      services: services.rows.map((r) => ({
        canonicalServiceId: r.id,
        name: r.name,
        slug: r.slug,
        tenantId: r.tenant_id,
        conceptId: r.concept_id,
      })),
    };
  },

  /**
   * Aprovação humana: confirma o CONCEPT do canônico (unresolved→confirmed →
   * READY) e fecha a fila. Opcionalmente promove scoped→global (fail-closed em
   * colisão de GTIN/fingerprint global). Transacional + auditoria humana.
   */
  async approveProduct(input: {
    canonicalProductId: string;
    conceptId: string;
    curatorActorId: string;
    tenantId: string;
    promoteToGlobal?: boolean;
  }): Promise<{ canonicalProductId: string; conceptId: string; scope: string }> {
    const concept = await pool.query<{ concept_id: string; domain: string }>(
      `SELECT concept_id, domain FROM concepts WHERE concept_id = $1::uuid LIMIT 1`,
      [input.conceptId]
    );
    if (concept.rowCount === 0) {
      throw new CatalogCurationError(404, 'CONCEPT_NOT_FOUND', 'CONCEPT inexistente (Lei 7).');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cp = await client.query<{ id: string; scope: string; tenant_id: string | null; concept_resolution_status: string }>(
        `SELECT id, scope, tenant_id, concept_resolution_status
           FROM canonical_products WHERE id = $1::uuid LIMIT 1 FOR UPDATE`,
        [input.canonicalProductId]
      );
      if (cp.rowCount === 0) {
        throw new CatalogCurationError(404, 'CANONICAL_PRODUCT_NOT_FOUND', 'Produto canônico inexistente.');
      }

      let scope = cp.rows[0].scope;
      if (input.promoteToGlobal && scope !== 'global') {
        try {
          await client.query(
            `UPDATE canonical_products SET scope = 'global', tenant_id = NULL, updated_at = NOW()
              WHERE id = $1::uuid`,
            [input.canonicalProductId]
          );
          scope = 'global';
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new CatalogCurationError(
              409,
              'GLOBAL_PROMOTION_COLLISION',
              'Promoção a global colide com identidade global existente (GTIN/fingerprint) — vincule como duplicata (fail-closed).'
            );
          }
          throw err;
        }
      }

      await client.query(
        `UPDATE canonical_products
            SET concept_id = $2::uuid, concept_resolution_status = 'confirmed', updated_at = NOW()
          WHERE id = $1::uuid`,
        [input.canonicalProductId, input.conceptId]
      );
      await client.query(
        `UPDATE canonical_concept_resolution_queue
            SET status = 'approved', resolved_concept_id = $2::uuid, resolved_at = NOW(), resolved_by_actor_id = $3::uuid
          WHERE canonical_product_id = $1::uuid AND status = 'pending'`,
        [input.canonicalProductId, input.conceptId, input.curatorActorId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    void recordConceptResolutionHumanConfirmedAudit({
      tenantId: input.tenantId,
      actorId: input.curatorActorId,
      canonicalProductId: input.canonicalProductId,
      conceptId: input.conceptId,
    }).catch(() => {});
    await insertCatalogEvent({
      entityType: 'canonical_product',
      entityId: input.canonicalProductId,
      eventType: 'curation_approved',
      payload: { conceptId: input.conceptId, promotedToGlobal: input.promoteToGlobal === true },
      actorId: input.curatorActorId,
      tenantId: input.tenantId,
    });
    return { canonicalProductId: input.canonicalProductId, conceptId: input.conceptId, scope: input.promoteToGlobal ? 'global' : 'scoped' };
  },

  /** Rejeição humana: fila → rejected; canônico permanece unresolved (nunca READY). */
  async rejectProduct(input: { canonicalProductId: string; curatorActorId: string; tenantId: string; reason?: string }): Promise<void> {
    const r = await pool.query(
      `UPDATE canonical_concept_resolution_queue
          SET status = 'rejected', resolved_at = NOW(), resolved_by_actor_id = $2::uuid
        WHERE canonical_product_id = $1::uuid AND status = 'pending'`,
      [input.canonicalProductId, input.curatorActorId]
    );
    if ((r.rowCount ?? 0) === 0) {
      throw new CatalogCurationError(404, 'QUEUE_ENTRY_NOT_PENDING', 'Sem item pendente de curadoria para este canônico.');
    }
    await insertCatalogEvent({
      entityType: 'canonical_product',
      entityId: input.canonicalProductId,
      eventType: 'curation_rejected',
      payload: { reason: input.reason ?? null },
      actorId: input.curatorActorId,
      tenantId: input.tenantId,
    });
  },

  /**
   * Vincular sugestão a item EXISTENTE (duplicata detectada pelo curador):
   * sugestão vira redirect do existente (duplicate_of) + fila fechada.
   * Referências antigas seguem resolvendo (G).
   */
  async linkProductAsDuplicate(input: {
    duplicateCanonicalProductId: string;
    winnerCanonicalProductId: string;
    curatorActorId: string;
    tenantId: string;
  }): Promise<void> {
    await this.mergeProducts({
      duplicateCanonicalProductId: input.duplicateCanonicalProductId,
      winnerCanonicalProductId: input.winnerCanonicalProductId,
      curatorActorId: input.curatorActorId,
      tenantId: input.tenantId,
    });
    await pool.query(
      `UPDATE canonical_concept_resolution_queue
          SET status = 'rejected', resolved_at = NOW(), resolved_by_actor_id = $2::uuid
        WHERE canonical_product_id = $1::uuid AND status = 'pending'`,
      [input.duplicateCanonicalProductId, input.curatorActorId]
    );
  },

  /**
   * Merge curatorial de produtos canônicos (G): duplicate → winner via
   * duplicate_of (redirect). Append-only; histórico/eventos preservados;
   * ofertas NÃO são destruídas (products.canonical_product_id intacto —
   * leitores resolvem o redirect). Idempotente.
   */
  async mergeProducts(input: {
    duplicateCanonicalProductId: string;
    winnerCanonicalProductId: string;
    curatorActorId: string;
    tenantId: string;
  }): Promise<void> {
    if (input.duplicateCanonicalProductId === input.winnerCanonicalProductId) {
      throw new CatalogCurationError(400, 'MERGE_SELF', 'Canônico não pode ser merge de si mesmo.');
    }
    const rows = await pool.query<{ id: string; duplicate_of_canonical_product_id: string | null }>(
      `SELECT id, duplicate_of_canonical_product_id FROM canonical_products WHERE id = ANY($1::uuid[])`,
      [[input.duplicateCanonicalProductId, input.winnerCanonicalProductId]]
    );
    const dup = rows.rows.find((r) => r.id === input.duplicateCanonicalProductId);
    const winner = rows.rows.find((r) => r.id === input.winnerCanonicalProductId);
    if (!dup || !winner) {
      throw new CatalogCurationError(404, 'CANONICAL_PRODUCT_NOT_FOUND', 'Produto canônico inexistente no merge.');
    }
    if (dup.duplicate_of_canonical_product_id === winner.id) return; // idempotente
    if (winner.duplicate_of_canonical_product_id) {
      throw new CatalogCurationError(409, 'MERGE_WINNER_IS_DUPLICATE', 'Vencedor já é redirect de outro canônico.');
    }
    await pool.query(
      `UPDATE canonical_products
          SET duplicate_of_canonical_product_id = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid`,
      [dup.id, winner.id]
    );
    await insertCatalogEvent({
      entityType: 'canonical_product',
      entityId: dup.id,
      eventType: 'product_merged_into',
      payload: { winnerCanonicalProductId: winner.id },
      actorId: input.curatorActorId,
      tenantId: input.tenantId,
    });
  },

  /** Resolve redirect de merge do PRODUTO até o vencedor (máx. 5 saltos). */
  async resolveProductRedirect(canonicalProductId: string): Promise<string> {
    const r = await pool.query<{ winner_id: string }>(
      `WITH RECURSIVE chain AS (
         SELECT id, duplicate_of_canonical_product_id, 0 AS depth
           FROM canonical_products WHERE id = $1::uuid
         UNION ALL
         SELECT cp.id, cp.duplicate_of_canonical_product_id, c.depth + 1
           FROM canonical_products cp
           JOIN chain c ON cp.id = c.duplicate_of_canonical_product_id
          WHERE c.depth < 5
       )
       SELECT id AS winner_id FROM chain ORDER BY depth DESC LIMIT 1`,
      [canonicalProductId]
    );
    return r.rows[0]?.winner_id ?? canonicalProductId;
  },
};
