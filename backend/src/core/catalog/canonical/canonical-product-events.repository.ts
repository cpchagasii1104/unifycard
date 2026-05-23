// canonical-product-events.repository.ts
// OBSERVABILITY ONLY — NÃO USAR PARA DECISÃO DE NEGÓCIO
// §5A PLANO_FASE_ATUAL: escrita de eventos canônicos gerados na camada de aplicação.
//
// Os triggers PG cobrem:
//   - 'created': AFTER INSERT em canonical_products
//   - 'concept_*': AFTER UPDATE OF concept_resolution_status
//
// Este repository cobre APENAS o que os triggers não alcançam:
//   - 'gtin_collision_blocked': gerado no catch do INSERT (exceção 23505)
//
// REGRA: canonical_product_events é append-only.
//   Nunca gerar UPDATE ou DELETE nessa tabela.

import { pool, runQueriesWithTenant } from '@core/database/pool';

export type CanonicalEventType =
  | 'created'
  | 'concept_resolved'
  | 'concept_resolution_pending'
  | 'concept_suggestion_auto'
  | 'governance_status_changed'
  | 'gtin_collision_blocked'
  | 'backfill_category';

export interface InsertCanonicalProductEventInput {
  canonicalProductId: string;
  tenantId: string | null;
  eventType: CanonicalEventType;
  payload: Record<string, unknown>;
  actorId?: string | null;
}

/**
 * Insere evento manualmente (para casos não cobertos pelos triggers PG).
 * Uso principal: 'gtin_collision_blocked' no catch do INSERT.
 * Chamar com `.catch(() => {})` — não deve bloquear o fluxo principal.
 */
export async function insertCanonicalProductEvent(
  input: InsertCanonicalProductEventInput
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO canonical_product_events
         (canonical_product_id, event_type, payload, actor_id, tenant_id, created_at)
       VALUES ($1::uuid, $2, $3::jsonb, $4, $5, now())`,
      [
        input.canonicalProductId,
        input.eventType,
        JSON.stringify(input.payload),
        input.actorId ?? null,
        input.tenantId ?? null,
      ]
    );
  } finally {
    client.release();
  }
}

export interface CanonicalProductEventRow {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

/**
 * Lista eventos de um canônico para backoffice/debug.
 * Usa runQueriesWithTenant (retorna T[] — múltiplas linhas).
 * runQueryWithTenant retorna T|undefined (uma linha) — não usar aqui.
 */
export async function listCanonicalProductEvents(
  tenantId: string,
  canonicalProductId: string,
  limit = 50
): Promise<CanonicalProductEventRow[]> {
  const rows = await runQueriesWithTenant<{
    id: string;
    event_type: string;
    payload: unknown;
    created_at: Date;
  }>(
    tenantId,
    `SELECT id, event_type, payload, created_at
     FROM canonical_product_events
     WHERE canonical_product_id = $2::uuid
     ORDER BY created_at DESC
     LIMIT $3`,
    [tenantId, canonicalProductId, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    payload: r.payload,
    createdAt: r.created_at instanceof Date
      ? r.created_at.toISOString()
      : String(r.created_at),
  }));
}