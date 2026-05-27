/**
 * Disputas a partir de reconciliation_ledger_discrepancies apenas.
 * Criação só por mutação explícita; autoridade obrigatória; idempotência por UNIQUE(ledger_discrepancy_id).
 */

import type { PoolClient } from 'pg';
import { getClientWithTenant, runQueryWithTenant } from '@core/database/pool';
import { requestAndExecuteReversalSync } from '@modules/reversal/reversal.service';
import {
  getLedgerDiscrepancyById,
  type LedgerReconciliationDiscrepancyType,
} from './reconciliation.repository';
import { buildDisputeAuditPayload } from './reconciliation-dispute-audit.util';
import {
  insertReconciliationDisputeEventWithClient,
  listReconciliationDisputeEventsByDisputeId,
} from './reconciliation-dispute-event.repository';
import {
  findDisputeById,
  findDisputeByLedgerDiscrepancyId,
  insertReconciliationDisputeWithClient,
  updateDisputeStatusWithClient,
} from './reconciliation-dispute.repository';
import {
  CANONICAL_LEDGER_DISCREPANCY_TYPES,
  type CreateDisputeFromDiscrepancyResult,
  type DisputeAuthorityKind,
  type ReconciliationDisputeActor,
  type ReconciliationDisputeRow,
  type ReconciliationDisputeStatus,
} from './reconciliation-dispute.types';

const ALLOWED_CREATION_KINDS = new Set<DisputeAuthorityKind>(['system', 'admin', 'support']);

const CANONICAL_TYPE_SET = new Set<string>(CANONICAL_LEDGER_DISCREPANCY_TYPES);

/** Tipos cujo reference_id no motor é id de bank_transactions (reversal_engine). */
const REVERSAL_REFERENCE_TYPES: LedgerReconciliationDiscrepancyType[] = [
  'ledger_mismatch',
  'orphan_transaction',
];

export function assertAuthorityForDisputeMutation(actor: ReconciliationDisputeActor | null | undefined): void {
  if (!actor || typeof actor.kind !== 'string') {
    throw new Error('UNAUTHORIZED_DISPUTE_CREATION');
  }
  const k = actor.kind.trim().toLowerCase() as DisputeAuthorityKind;
  if (!ALLOWED_CREATION_KINDS.has(k)) {
    throw new Error('UNAUTHORIZED_DISPUTE_CREATION');
  }
}

function assertCanonicalDiscrepancyType(t: string): asserts t is LedgerReconciliationDiscrepancyType {
  if (!CANONICAL_TYPE_SET.has(t)) {
    throw new Error('INVALID_LEDGER_DISCREPANCY_TYPE');
  }
}

function actorKindNormalized(actor: ReconciliationDisputeActor): string {
  return actor.kind.trim().toLowerCase();
}

function actorIdOrNull(actor: ReconciliationDisputeActor): string | null {
  return actor.actorId != null && String(actor.actorId).trim() !== ''
    ? String(actor.actorId).trim()
    : null;
}

export type DisputeMutationOptions = {
  /** Só entra no payload de auditoria se enviado explicitamente na mutação. */
  reason?: string | null;
};

/**
 * Mutação de disputa + evento de auditoria na mesma transação.
 * Falha no INSERT do evento → ROLLBACK (sem estado sem trilha).
 */
async function withDisputeAuditTransaction<T>(
  tenantId: string,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');
    const out = await work(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * create_dispute_from_discrepancy(discrepancy_id, actor)
 * — idempotente: devolve disputa existente; não duplica.
 * — evento dispute_created só após INSERT real (não em replay idempotente).
 */
export async function createDisputeFromDiscrepancy(
  tenantId: string,
  ledgerDiscrepancyId: string,
  actor: ReconciliationDisputeActor,
  options?: DisputeMutationOptions
): Promise<CreateDisputeFromDiscrepancyResult> {
  assertAuthorityForDisputeMutation(actor);

  const discrepancy = await getLedgerDiscrepancyById(tenantId, ledgerDiscrepancyId);
  if (!discrepancy) {
    throw new Error('LEDGER_DISCREPANCY_NOT_FOUND');
  }
  assertCanonicalDiscrepancyType(discrepancy.type);
  if (discrepancy.resolved) {
    throw new Error('DISCREPANCY_ALREADY_RESOLVED');
  }

  const existing = await findDisputeByLedgerDiscrepancyId(tenantId, ledgerDiscrepancyId);
  if (existing) {
    return { dispute: existing, created: false, discrepancy };
  }

  const createdByKind = actor.kind.trim().toLowerCase() as DisputeAuthorityKind;
  const createdByActorId =
    actor.actorId != null && String(actor.actorId).trim() !== '' ? String(actor.actorId).trim() : null;

  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');
    const dispute = await insertReconciliationDisputeWithClient(client, tenantId, {
      ledgerDiscrepancyId,
      createdByKind,
      createdByActorId,
    });
    await insertReconciliationDisputeEventWithClient(client, tenantId, {
      disputeId: dispute.id,
      eventType: 'dispute_created',
      actorKind: actorKindNormalized(actor),
      actorId: actorIdOrNull(actor),
      fromStatus: null,
      toStatus: 'open',
      payload: buildDisputeAuditPayload(discrepancy, options?.reason),
    });
    await client.query('COMMIT');
    return { dispute, created: true, discrepancy };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    const code = (e as { code?: string })?.code;
    if (code === '23505') {
      const again = await findDisputeByLedgerDiscrepancyId(tenantId, ledgerDiscrepancyId);
      if (again) {
        return { dispute: again, created: false, discrepancy };
      }
    }
    throw e;
  } finally {
    client.release();
  }
}

function assertTransition(from: ReconciliationDisputeStatus, to: ReconciliationDisputeStatus): void {
  const allowed: Record<ReconciliationDisputeStatus, ReconciliationDisputeStatus[]> = {
    open: ['under_review', 'resolved'],
    under_review: ['resolved', 'reversed'],
    resolved: [],
    reversed: [],
  };
  if (!allowed[from]?.includes(to)) {
    throw new Error(`INVALID_DISPUTE_TRANSITION:${from}->${to}`);
  }
}

export async function moveDisputeToUnderReview(
  tenantId: string,
  disputeId: string,
  actor: ReconciliationDisputeActor,
  options?: DisputeMutationOptions
): Promise<ReconciliationDisputeRow> {
  assertAuthorityForDisputeMutation(actor);
  const d = await findDisputeById(tenantId, disputeId);
  if (!d) throw new Error('DISPUTE_NOT_FOUND');
  assertTransition(d.status, 'under_review');
  const disc = await getLedgerDiscrepancyById(tenantId, d.ledgerDiscrepancyId);
  if (!disc) throw new Error('LEDGER_DISCREPANCY_NOT_FOUND');

  return withDisputeAuditTransaction(tenantId, async (c) => {
    const updated = await updateDisputeStatusWithClient(
      c,
      tenantId,
      disputeId,
      'under_review',
      d.status
    );
    if (!updated) throw new Error('DISPUTE_UPDATE_FAILED');
    await insertReconciliationDisputeEventWithClient(c, tenantId, {
      disputeId,
      eventType: 'moved_to_under_review',
      actorKind: actorKindNormalized(actor),
      actorId: actorIdOrNull(actor),
      fromStatus: d.status,
      toStatus: 'under_review',
      payload: buildDisputeAuditPayload(disc, options?.reason),
    });
    return updated;
  });
}

export async function resolveDispute(
  tenantId: string,
  disputeId: string,
  actor: ReconciliationDisputeActor,
  options?: DisputeMutationOptions
): Promise<ReconciliationDisputeRow> {
  assertAuthorityForDisputeMutation(actor);
  const d = await findDisputeById(tenantId, disputeId);
  if (!d) throw new Error('DISPUTE_NOT_FOUND');
  assertTransition(d.status, 'resolved');
  const disc = await getLedgerDiscrepancyById(tenantId, d.ledgerDiscrepancyId);
  if (!disc) throw new Error('LEDGER_DISCREPANCY_NOT_FOUND');

  return withDisputeAuditTransaction(tenantId, async (c) => {
    const updated = await updateDisputeStatusWithClient(c, tenantId, disputeId, 'resolved', d.status);
    if (!updated) throw new Error('DISPUTE_UPDATE_FAILED');
    await insertReconciliationDisputeEventWithClient(c, tenantId, {
      disputeId,
      eventType: 'resolved',
      actorKind: actorKindNormalized(actor),
      actorId: actorIdOrNull(actor),
      fromStatus: d.status,
      toStatus: 'resolved',
      payload: buildDisputeAuditPayload(disc, options?.reason),
    });
    return updated;
  });
}

async function getBankTransactionAmountCents(tenantId: string, transactionId: string): Promise<number> {
  const row = await runQueryWithTenant<{ amount_cents: string }>(
    tenantId,
    `SELECT amount_cents::text FROM bank_transactions WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, transactionId]
  );
  if (!row) throw new Error('DISPUTE_REVERSAL_REFERENCE_NOT_A_BANK_TRANSACTION');
  return Number(row.amount_cents);
}

/**
 * Correção financeira: apenas reversal_engine; sem escrita manual em ledger/saldos.
 * Exige actorId explícito (UUID) para o registo de reversão.
 */
export async function executeDisputeFinancialReversal(
  tenantId: string,
  disputeId: string,
  actor: ReconciliationDisputeActor,
  options?: DisputeMutationOptions
): Promise<{
  dispute: ReconciliationDisputeRow;
  reversal: { reversalTransactionId: string; reversalTransactionIds: string[] };
}> {
  assertAuthorityForDisputeMutation(actor);
  if (!actor.actorId || String(actor.actorId).trim() === '') {
    throw new Error('ACTOR_ID_REQUIRED_FOR_REVERSAL');
  }
  const actorId = String(actor.actorId).trim();

  const dispute = await findDisputeById(tenantId, disputeId);
  if (!dispute) throw new Error('DISPUTE_NOT_FOUND');
  if (dispute.status !== 'under_review') {
    throw new Error('DISPUTE_MUST_BE_UNDER_REVIEW_FOR_REVERSAL');
  }

  const disc = await getLedgerDiscrepancyById(tenantId, dispute.ledgerDiscrepancyId);
  if (!disc) throw new Error('LEDGER_DISCREPANCY_NOT_FOUND');

  if (!REVERSAL_REFERENCE_TYPES.includes(disc.type)) {
    throw new Error('DISPUTE_REVERSAL_NOT_APPLICABLE_FOR_TYPE');
  }

  const amountCents = await getBankTransactionAmountCents(tenantId, disc.referenceId);

  const reversal = await requestAndExecuteReversalSync(tenantId, {
    originalTransactionId: disc.referenceId,
    actorId,
    reason: `reconciliation_dispute:${disputeId}`,
    amountCents,
    // DECISION-0052: reconciliação automática de dispute — sistêmico.
    reversalType: 'external_reversal',
    authoritySource: 'system',
  });

  assertTransition(dispute.status, 'reversed');

  const updated = await withDisputeAuditTransaction(tenantId, async (c) => {
    const row = await updateDisputeStatusWithClient(c, tenantId, disputeId, 'reversed', 'under_review');
    if (!row) throw new Error('DISPUTE_UPDATE_FAILED');
    await insertReconciliationDisputeEventWithClient(c, tenantId, {
      disputeId,
      eventType: 'reversed',
      actorKind: actorKindNormalized(actor),
      actorId: actorIdOrNull(actor),
      fromStatus: dispute.status,
      toStatus: 'reversed',
      payload: buildDisputeAuditPayload(disc, options?.reason),
    });
    return row;
  });

  return { dispute: updated, reversal };
}

export async function listDisputeAuditEvents(tenantId: string, disputeId: string) {
  const d = await findDisputeById(tenantId, disputeId);
  if (!d) throw new Error('DISPUTE_NOT_FOUND');
  return listReconciliationDisputeEventsByDisputeId(tenantId, disputeId);
}

export const reconciliationDisputeService = {
  assertAuthorityForDisputeMutation,
  createDisputeFromDiscrepancy,
  moveDisputeToUnderReview,
  resolveDispute,
  executeDisputeFinancialReversal,
  listDisputeAuditEvents,
};