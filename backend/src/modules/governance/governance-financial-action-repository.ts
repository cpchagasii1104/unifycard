// Governance Financial Action Repository — tabela governance_financial_actions.
// Não escreve em bank_transactions nem bank_ledger. Ações são processadas via PaymentIntent.
// F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149): listagem de pendências é
// TENANT-SCOPED — o worker itera tenants (tenant-loop); governance_financial_actions está sob
// RLS+FORCE desde 20260702170000.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type GovernanceActionStatus = 'pending' | 'processed' | 'failed';

export interface GovernanceFinancialAction {
  id: string;
  tenantId: string;
  proposalId: string;
  actionType: string;
  referenceId: string | null;
  payload: Record<string, unknown>;
  status: GovernanceActionStatus;
  createdAt: string;
  processedAt: string | null;
}

interface GovernanceFinancialActionRow {
  id: string;
  tenant_id: string;
  proposal_id: string;
  action_type: string;
  reference_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  created_at: Date;
  processed_at: Date | null;
}

function toAction(row: GovernanceFinancialActionRow): GovernanceFinancialAction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    proposalId: row.proposal_id,
    actionType: row.action_type,
    referenceId: row.reference_id,
    payload: row.payload || {},
    status: row.status as GovernanceActionStatus,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export interface CreateFinancialActionInput {
  proposalId: string;
  actionType: string;
  referenceId?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Cria uma ação financeira com status 'pending'.
 */
export async function createFinancialAction(
  tenantId: string,
  input: CreateFinancialActionInput
): Promise<GovernanceFinancialAction> {
  const row = await runQueryWithTenant<GovernanceFinancialActionRow>(
    tenantId,
    `INSERT INTO governance_financial_actions (tenant_id, proposal_id, action_type, reference_id, payload, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
     RETURNING id, tenant_id, proposal_id, action_type, reference_id, payload, status, created_at, processed_at`,
    [
      tenantId,
      input.proposalId,
      input.actionType,
      input.referenceId ?? null,
      JSON.stringify(input.payload ?? {}),
    ]
  );
  if (!row) throw new Error('createFinancialAction: insert failed');
  return toAction(row);
}

/**
 * Lista ações com status 'pending' DE UM TENANT (para o worker, dentro do tenant-loop).
 * TENANT-SCOPED (DECISION-0149) — compatível com RLS+FORCE em governance_financial_actions.
 */
export async function listPendingActions(
  tenantId: string,
  limit = 50
): Promise<GovernanceFinancialAction[]> {
  const rows = await runQueriesWithTenant<GovernanceFinancialActionRow>(
    tenantId,
    `SELECT id, tenant_id, proposal_id, action_type, reference_id, payload, status, created_at, processed_at
     FROM governance_financial_actions
     WHERE status = 'pending' AND tenant_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [tenantId, limit]
  );
  return rows.map(toAction);
}

/**
 * Marca ação como processada (status = 'processed', processed_at = now()).
 */
export async function markActionProcessed(
  tenantId: string,
  actionId: string
): Promise<GovernanceFinancialAction> {
  const row = await runQueryWithTenant<GovernanceFinancialActionRow>(
    tenantId,
    `UPDATE governance_financial_actions
     SET status = 'processed', processed_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id, tenant_id, proposal_id, action_type, reference_id, payload, status, created_at, processed_at`,
    [actionId, tenantId]
  );
  if (!row) throw new Error('markActionProcessed: action not found or not pending');
  return toAction(row);
}

/**
 * Marca ação como falha (status = 'failed', processed_at = now()).
 */
export async function markActionFailed(
  tenantId: string,
  actionId: string
): Promise<GovernanceFinancialAction> {
  const row = await runQueryWithTenant<GovernanceFinancialActionRow>(
    tenantId,
    `UPDATE governance_financial_actions
     SET status = 'failed', processed_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id, tenant_id, proposal_id, action_type, reference_id, payload, status, created_at, processed_at`,
    [actionId, tenantId]
  );
  if (!row) throw new Error('markActionFailed: action not found or not pending');
  const act = toAction(row);
  const payload = act.payload || {};
  const actorForRisk =
    (typeof payload.actor_id === 'string' && payload.actor_id) ||
    (typeof payload.target_actor_id === 'string' && payload.target_actor_id) ||
    (typeof payload.actorId === 'string' && payload.actorId) ||
    null;
  if (actorForRisk) {
    const { recordActorRiskEventAsync } = await import('@modules/risk-identity/risk-hooks');
    recordActorRiskEventAsync(tenantId, actorForRisk, 'governance_action_failed', actionId, {
      proposal_id: act.proposalId,
      action_type: act.actionType,
    });
  }
  return act;
}