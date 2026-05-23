// Governance Execution Worker — executa propostas aprovadas após o prazo de votação.
// Não altera bank_transactions nem bank_ledger. Somente escrita em governance_proposals e financial_alerts.

import {
  listOpenProposalsPastDeadline,
  closeVotingForProposal,
  listApprovedPendingExecution,
  markProposalExecuted,
} from '@modules/governance/governance-proposal-repository';
import { createFinancialAlert } from '@modules/alerts/financial-alert-repository';
import { createDistribution } from '@modules/treasury/treasury-distribution-repository';
import { createCommitment } from '@modules/governance-funding-commitment/governance-funding-commitment.repository';

const INTERVAL_MS = 60_000;

const TREASURY_DISTRIBUTION_PROPOSAL_TYPES = ['regional_fund_distribution', 'community_project_funding'] as const;

/**
 * Execução da proposta: registra treasury_distribution e/ou governance_funding quando aplicável.
 * Não escreve em bank_transactions nem bank_ledger.
 */
async function executeProposalAction(
  tenantId: string,
  proposalType: string,
  payload: Record<string, unknown>,
  proposalId: string
): Promise<void> {
  if (TREASURY_DISTRIBUTION_PROPOSAL_TYPES.includes(proposalType as any)) {
    const treasuryAccountId = payload?.treasury_account_id as string | undefined;
    const amountCents = payload?.amount_cents as number | undefined;
    const referenceId = (payload?.reference_id as string) ?? null;
    if (treasuryAccountId && amountCents != null && Number(amountCents) > 0) {
      await createDistribution(tenantId, {
        treasuryAccountId,
        proposalId,
        referenceId,
        amountCents: Number(amountCents),
        distributionType: proposalType,
      });
    }
  }

  if (proposalType === 'community_project_funding') {
    const treasuryAccountId = payload?.treasury_account_id as string | undefined;
    const projectReference = (payload?.project_reference as string) ?? null;
    const amountCents = payload?.amount_cents as number | undefined;
    const currency = (payload?.currency as string) ?? 'BRL';
    if (treasuryAccountId && amountCents != null && Number(amountCents) > 0) {
      await createCommitment(tenantId, {
        proposalId,
        treasuryAccountId,
        amountCents: Number(amountCents),
        currency,
        projectReference,
      });
    }
  }
}

async function runGovernanceExecutionCycle(): Promise<void> {
  try {
    // 1) Fechar votação de propostas open com prazo vencido
    const openPastDeadline = await listOpenProposalsPastDeadline();
    for (const p of openPastDeadline) {
      await closeVotingForProposal(p.tenantId, p.id);
    }

    // 2) Executar propostas aprovadas com prazo vencido e ainda não executadas
    const approved = await listApprovedPendingExecution();
    for (const p of approved) {
      await executeProposalAction(p.tenantId, p.proposalType, p.payload, p.id);
      await markProposalExecuted(p.tenantId, p.id);
      await createFinancialAlert(p.tenantId, {
        alertType: 'GOVERNANCE_PROPOSAL_EXECUTED',
        referenceId: p.id,
        severity: 'info',
        message: `Governance proposal executed: ${p.proposalType} (id=${p.id})`,
      });
    }
  } catch (err) {
    console.error('[GovernanceExecutionWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startGovernanceExecutionWorker(): void {
  if (intervalId !== null) return;
  runGovernanceExecutionCycle().catch((err) =>
    console.error('[GovernanceExecutionWorker] Initial run error:', err)
  );
  intervalId = setInterval(runGovernanceExecutionCycle, INTERVAL_MS);
  console.log('[GovernanceExecutionWorker] Started (interval 60s, governance execution)');
}