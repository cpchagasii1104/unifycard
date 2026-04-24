// Governance Financial Action Worker — processa ações financeiras de governança via PaymentIntent.
// Não escreve em bank_transactions nem bank_ledger. Apenas utiliza o PaymentIntent Engine existente.

import {
  listPendingActions,
  markActionProcessed,
  markActionFailed,
} from '@modules/governance/governance-financial-action-repository';

const INTERVAL_MS = 60_000;
const BATCH_LIMIT = 50;

async function processAction(
  action: Awaited<ReturnType<typeof listPendingActions>>[number]
): Promise<void> {
  const payload = action.payload as Record<string, unknown>;
  const orderId = payload?.order_id as string | undefined;
  const amountCents = payload?.amount_cents as number | undefined;
  const actorId = payload?.actor_id as string | undefined;

  if (!orderId || amountCents == null || Number(amountCents) <= 0) {
    await markActionFailed(action.tenantId, action.id);
    return;
  }

  const { createPaymentIntent } = await import('@modules/payments/payment-intent-repository');
  await createPaymentIntent(action.tenantId, {
    referenceId: orderId,
    gateway: 'internal',
    actorId: actorId ?? null,
    amountCents: Number(amountCents),
    currency: (payload?.currency as string) || 'BRL',
    source: 'governance',
    metadata: {
      governance_action_id: action.id,
      action_type: action.actionType,
      proposal_id: action.proposalId,
      order_id: orderId,
    },
  });
  await markActionProcessed(action.tenantId, action.id);
}

async function runGovernanceFinancialActionCycle(): Promise<void> {
  try {
    const pending = await listPendingActions(BATCH_LIMIT);
    for (const action of pending) {
      try {
        await processAction(action);
      } catch (err) {
        console.error('[GovernanceFinancialActionWorker] Action failed', action.id, err);
        try {
          await markActionFailed(action.tenantId, action.id);
        } catch (e) {
          console.error('[GovernanceFinancialActionWorker] markActionFailed error', action.id, e);
        }
      }
    }
  } catch (err) {
    console.error('[GovernanceFinancialActionWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startGovernanceFinancialActionWorker(): void {
  if (intervalId !== null) return;
  runGovernanceFinancialActionCycle().catch((err) =>
    console.error('[GovernanceFinancialActionWorker] Initial run error:', err)
  );
  intervalId = setInterval(runGovernanceFinancialActionCycle, INTERVAL_MS);
  console.log('[GovernanceFinancialActionWorker] Started (interval 60s, governance financial actions)');
}