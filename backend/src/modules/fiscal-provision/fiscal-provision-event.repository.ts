// backend/src/modules/fiscal-provision/fiscal-provision-event.repository.ts
// FISCAL-4E — DECISION-0179 D7/D9/D11 + DECISION-0182. Repository do CABEÇALHO append-only
// fiscal_provision_events. SEM métodos de UPDATE/DELETE (imutabilidade física por trigger é a última
// barreira). NÃO conhece Bank (só o domínio fiscal). Evidência, nunca saldo.
//
// SEPARAÇÃO SELADA (D11): identidade da operação = TUPLE externa (tenant_id, reference_type, reference_id);
// identidade do payload = fiscal_economic_context_fingerprint. O repository COMBINA os dois:
//   mesma tuple + MESMO fingerprint  → retorno idempotente;
//   mesma tuple + fingerprint DIFERENTE → IDEMPOTENCY_PAYLOAD_MISMATCH;
//   tuple diferente + mesmo fingerprint → operação distinta;
//   tenant diferente → isolamento (a tuple carrega tenant).
// Race-safe por advisory lock transacional na tuple+kind (DECISION-0179 D8/§14: advisory lock permitido).

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';

export class IdempotencyPayloadMismatchError extends Error {
  readonly statusCode = 409;
  constructor(referenceType: string, referenceId: string) {
    super(`IDEMPOTENCY_PAYLOAD_MISMATCH: mesma tuple (${referenceType}/${referenceId}) com fingerprint fiscal-econômico divergente`);
    this.name = 'IdempotencyPayloadMismatchError';
  }
}

export interface FiscalProvisionEventInput {
  tenantId: string;
  fiscalIdentityId: string;
  taxpayerKind: 'platform';
  currency: string;
  // tuple externa (idempotência) — NUNCA embutida no fingerprint
  referenceType: string;
  referenceId: string;
  // identidade do payload
  fiscalEconomicContextFingerprint: string;
  // conservação (centavos inteiros)
  commissionGrossCents: number;
  taxReserveCents: number;
  commissionDistributableCents: number;
  // continuação residual (DECISION-0182)
  sourceLineRef: Record<string, unknown>;
  destinationSnapshot: Record<string, unknown>;
  // territórios nomeados
  fiscalJurisdiction: Record<string, unknown>;
  buyerTerritory: Record<string, unknown> | null;
  // snapshot versionado
  snapshotVersion: number;
  fiscalSnapshot: Record<string, unknown>;
  // reversão
  eventKind: 'provision' | 'full_reversal';
  reversesEventId: string | null;
  status: string;
  occurredAt: Date;
  effectiveAt: Date;
}

export interface PersistedFiscalProvisionEvent {
  id: string;
  idempotent: boolean;
}

const LOCK_SQL = `SELECT pg_advisory_xact_lock(hashtext($1))`;
const FIND_SQL = `
  SELECT id::text, fiscal_economic_context_fingerprint
    FROM fiscal_provision_events
   WHERE tenant_id = $1::uuid AND reference_type = $2 AND reference_id = $3 AND event_kind = $4
   LIMIT 1`;
const INSERT_SQL = `
  INSERT INTO fiscal_provision_events
    (tenant_id, fiscal_identity_id, taxpayer_kind, currency, reference_type, reference_id,
     fiscal_economic_context_fingerprint, commission_gross_cents, tax_reserve_cents,
     commission_distributable_cents, source_line_ref, destination_snapshot, fiscal_jurisdiction,
     buyer_territory, snapshot_version, fiscal_snapshot, event_kind, reverses_event_id, status,
     occurred_at, effective_at)
  VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb,
          $14::jsonb, $15, $16::jsonb, $17, $18::uuid, $19, $20, $21)
  RETURNING id::text`;

class FiscalProvisionEventRepository {
  /**
   * Insere o evento fiscal (idempotente por tuple+fingerprint). `existingClient` fornecido → participa
   * da MESMA transação Bank do chamador (sem BEGIN/COMMIT/ROLLBACK/release próprios). Ausente →
   * transação própria coerente.
   */
  async insertProvisionEvent(input: FiscalProvisionEventInput, existingClient?: PoolClient): Promise<PersistedFiscalProvisionEvent> {
    const ownsTx = existingClient == null;
    const client = existingClient ?? (await getClientWithTenant(input.tenantId));
    try {
      if (ownsTx) await client.query('BEGIN');
      // serializa concorrência para a MESMA operação+kind (race-safe find-then-decide).
      await client.query(LOCK_SQL, [`fpe:${input.tenantId}:${input.referenceType}:${input.referenceId}:${input.eventKind}`]);
      const found = await client.query<{ id: string; fiscal_economic_context_fingerprint: string }>(
        FIND_SQL, [input.tenantId, input.referenceType, input.referenceId, input.eventKind]
      );
      if (found.rows.length > 0) {
        const row = found.rows[0]!;
        if (row.fiscal_economic_context_fingerprint !== input.fiscalEconomicContextFingerprint) {
          throw new IdempotencyPayloadMismatchError(input.referenceType, input.referenceId);
        }
        if (ownsTx) await client.query('COMMIT');
        return { id: row.id, idempotent: true };
      }
      const ins = await client.query<{ id: string }>(INSERT_SQL, [
        input.tenantId, input.fiscalIdentityId, input.taxpayerKind, input.currency, input.referenceType,
        input.referenceId, input.fiscalEconomicContextFingerprint, input.commissionGrossCents,
        input.taxReserveCents, input.commissionDistributableCents, JSON.stringify(input.sourceLineRef),
        JSON.stringify(input.destinationSnapshot), JSON.stringify(input.fiscalJurisdiction),
        input.buyerTerritory == null ? null : JSON.stringify(input.buyerTerritory), input.snapshotVersion,
        JSON.stringify(input.fiscalSnapshot), input.eventKind, input.reversesEventId, input.status,
        input.occurredAt, input.effectiveAt,
      ]);
      if (ownsTx) await client.query('COMMIT');
      return { id: ins.rows[0]!.id, idempotent: false };
    } catch (e) {
      if (ownsTx) { try { await client.query('ROLLBACK'); } catch { /* noop */ } }
      throw e;
    } finally {
      if (ownsTx) client.release();
    }
  }

  /** Localiza evento por tuple externa + kind (read-only). */
  async findByTuple(
    tenantId: string, referenceType: string, referenceId: string, eventKind: 'provision' | 'full_reversal',
    existingClient?: PoolClient
  ): Promise<{ id: string; fingerprint: string } | null> {
    const ownsClient = existingClient == null;
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    try {
      const res = await client.query<{ id: string; fiscal_economic_context_fingerprint: string }>(
        FIND_SQL, [tenantId, referenceType, referenceId, eventKind]
      );
      if (res.rows.length === 0) return null;
      return { id: res.rows[0]!.id, fingerprint: res.rows[0]!.fiscal_economic_context_fingerprint };
    } finally {
      if (ownsClient) client.release();
    }
  }

  /**
   * FISCAL-4E (DECISION-0179 D16 / DECISION-0183 D8): lê o CABEÇALHO completo do evento de provisão
   * original para o full reversal REUSAR amounts + snapshots (NUNCA recomputa imposto, NUNCA relê policy).
   * Read-only sobre a tabela append-only. Retorna os campos materiais + o mapa fiscal necessário à reversão.
   */
  async getProvisionEventById(
    tenantId: string, eventId: string, existingClient?: PoolClient
  ): Promise<FiscalProvisionEventRow | null> {
    const ownsClient = existingClient == null;
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    try {
      const res = await client.query<FiscalProvisionEventRow>(
        `SELECT id::text, tenant_id::text AS tenant_id, fiscal_identity_id::text AS fiscal_identity_id,
                taxpayer_kind, currency, reference_type, reference_id,
                fiscal_economic_context_fingerprint, commission_gross_cents::int AS commission_gross_cents,
                tax_reserve_cents::int AS tax_reserve_cents,
                commission_distributable_cents::int AS commission_distributable_cents,
                source_line_ref, destination_snapshot, fiscal_jurisdiction, buyer_territory,
                snapshot_version::int AS snapshot_version, fiscal_snapshot, event_kind,
                occurred_at, effective_at
           FROM fiscal_provision_events
          WHERE tenant_id = $1::uuid AND id = $2::uuid AND event_kind = 'provision'
          LIMIT 1`,
        [tenantId, eventId]
      );
      return res.rows[0] ?? null;
    } finally {
      if (ownsClient) client.release();
    }
  }
}

/** Row do cabeçalho fiscal_provision_events (read-only; usado pelo full reversal). */
export interface FiscalProvisionEventRow {
  id: string;
  tenant_id: string;
  fiscal_identity_id: string;
  taxpayer_kind: string;
  currency: string;
  reference_type: string;
  reference_id: string;
  fiscal_economic_context_fingerprint: string;
  commission_gross_cents: number;
  tax_reserve_cents: number;
  commission_distributable_cents: number;
  source_line_ref: Record<string, unknown>;
  destination_snapshot: Record<string, unknown>;
  fiscal_jurisdiction: Record<string, unknown>;
  buyer_territory: Record<string, unknown> | null;
  snapshot_version: number;
  fiscal_snapshot: Record<string, unknown>;
  event_kind: string;
  occurred_at: Date;
  effective_at: Date;
}

export const fiscalProvisionEventRepository = new FiscalProvisionEventRepository();
