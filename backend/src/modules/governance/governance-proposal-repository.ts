// Governance Proposal Repository — tabela governance_proposals.
// Não altera bank_transactions nem bank_ledger.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type ProposalStatus = 'open' | 'approved' | 'rejected' | 'executed';

export interface GovernanceProposal {
  id: string;
  tenantId: string;
  proposalType: string;
  referenceId: string | null;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votingDeadline: string;
  executedAt: string | null;
  createdAt: string;
}

interface GovernanceProposalRow {
  id: string;
  tenant_id: string;
  proposal_type: string;
  reference_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  votes_for: string;
  votes_against: string;
  voting_deadline: Date;
  executed_at: Date | null;
  created_at: Date;
}

function toProposal(row: GovernanceProposalRow): GovernanceProposal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    proposalType: row.proposal_type,
    referenceId: row.reference_id,
    payload: row.payload || {},
    status: row.status as ProposalStatus,
    votesFor: parseInt(String(row.votes_for), 10),
    votesAgainst: parseInt(String(row.votes_against), 10),
    votingDeadline: row.voting_deadline.toISOString(),
    executedAt: row.executed_at ? row.executed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export interface CreateProposalInput {
  proposalType: string;
  referenceId?: string | null;
  payload?: Record<string, unknown>;
  votingDeadline: Date;
}

/**
 * Cria uma proposta com status 'open'.
 */
export async function createProposal(
  tenantId: string,
  input: CreateProposalInput
): Promise<GovernanceProposal> {
  const row = await runQueryWithTenant<GovernanceProposalRow>(
    tenantId,
    `INSERT INTO governance_proposals (tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline)
     VALUES ($1, $2, $3, $4::jsonb, 'open', 0, 0, $5)
     RETURNING id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at`,
    [
      tenantId,
      input.proposalType,
      input.referenceId ?? null,
      JSON.stringify(input.payload ?? {}),
      input.votingDeadline,
    ]
  );
  if (!row) throw new Error('createProposal: insert failed');
  return toProposal(row);
}

/**
 * Registra voto (for ou against). Só permite se status = 'open' e voting_deadline >= now().
 */
export async function voteProposal(
  tenantId: string,
  proposalId: string,
  vote: 'for' | 'against'
): Promise<GovernanceProposal> {
  const row = await runQueryWithTenant<GovernanceProposalRow>(
    tenantId,
    vote === 'for'
      ? `UPDATE governance_proposals
         SET votes_for = votes_for + 1
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' AND voting_deadline >= now()
         RETURNING id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at`
      : `UPDATE governance_proposals
         SET votes_against = votes_against + 1
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' AND voting_deadline >= now()
         RETURNING id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at`,
    [proposalId, tenantId]
  );
  if (!row) throw new Error('voteProposal: proposal not found or voting closed');
  return toProposal(row);
}

/**
 * Lista propostas com status 'open'. Opcionalmente por tenant.
 */
export async function listOpenProposals(
  tenantId?: string
): Promise<GovernanceProposal[]> {
  const query =
    tenantId === undefined
      ? `SELECT id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at
         FROM governance_proposals WHERE status = 'open' ORDER BY created_at DESC`
      : `SELECT id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at
         FROM governance_proposals WHERE tenant_id = $1 AND status = 'open' ORDER BY created_at DESC`;
  const result = await pool.query<GovernanceProposalRow>(
    query,
    tenantId === undefined ? [] : [tenantId]
  );
  return result.rows.map(toProposal);
}

/**
 * Lista propostas aprovadas com prazo vencido e ainda não executadas (para o worker).
 */
export async function listApprovedPendingExecution(): Promise<GovernanceProposal[]> {
  const result = await pool.query<GovernanceProposalRow>(
    `SELECT id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at
     FROM governance_proposals
     WHERE status = 'approved' AND voting_deadline < now() AND executed_at IS NULL
     ORDER BY voting_deadline ASC`
  );
  return result.rows.map(toProposal);
}

/**
 * Marca proposta como executada (executed_at = now(), status = 'executed').
 */
export async function markProposalExecuted(
  tenantId: string,
  proposalId: string
): Promise<GovernanceProposal> {
  const row = await runQueryWithTenant<GovernanceProposalRow>(
    tenantId,
    `UPDATE governance_proposals
     SET executed_at = now(), status = 'executed'
     WHERE id = $1 AND tenant_id = $2 AND status = 'approved' AND executed_at IS NULL
     RETURNING id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at`,
    [proposalId, tenantId]
  );
  if (!row) throw new Error('markProposalExecuted: proposal not found or already executed');
  return toProposal(row);
}

/**
 * Fecha votação: define status = 'approved' ou 'rejected' conforme votos (chamado pelo worker).
 */
export async function closeVotingForProposal(
  tenantId: string,
  proposalId: string
): Promise<GovernanceProposal | null> {
  const row = await runQueryWithTenant<GovernanceProposalRow>(
    tenantId,
    `UPDATE governance_proposals
     SET status = CASE WHEN votes_for > votes_against THEN 'approved' ELSE 'rejected' END
     WHERE id = $1 AND tenant_id = $2 AND status = 'open' AND voting_deadline < now()
     RETURNING id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at`,
    [proposalId, tenantId]
  );
  return row ? toProposal(row) : null;
}

/**
 * Lista propostas open com voting_deadline < now() (para fechar votação no worker).
 */
export async function listOpenProposalsPastDeadline(): Promise<GovernanceProposal[]> {
  const result = await pool.query<GovernanceProposalRow>(
    `SELECT id, tenant_id, proposal_type, reference_id, payload, status, votes_for, votes_against, voting_deadline, executed_at, created_at
     FROM governance_proposals
     WHERE status = 'open' AND voting_deadline < now()
     ORDER BY voting_deadline ASC`
  );
  return result.rows.map(toProposal);
}