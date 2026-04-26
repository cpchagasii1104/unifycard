// Bank Settlement Worker — processa bank_settlements (status = pending): seller_payout → bank_settlement.
// Usa bankTransactionService.transfer e bank-settlement repository.
//
// §4.12.1 (07_NOMENCLATURA_CANONICA): dois efeitos irreversíveis isolados —
// transferência ledger vs marcação `sent`, para retry após falha a meio não duplicar transfer.

import {
  getBankSettlementById,
  listPendingSettlements,
  updateSettlementStatus,
} from '@modules/bank-settlement/bank-settlement-repository';
import type { BankSettlement } from '@modules/bank-settlement/bank-settlement-repository';
import { checkCircuitBreaker } from '@modules/circuit-breaker/financial-circuit-breaker-guard';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import type { BankCurrency } from '@modules/bank/bank-account.types';
import { withIdempotency } from '@core/events/idempotency-tracker';
import { BadRequestError, NotFoundError } from '@core/errors';
import { canonicalLogger } from '@core/logging/canonical-logger';

const INTERVAL_MS = 10_000;
const BATCH_LIMIT = 50;
let intervalId: ReturnType<typeof setInterval> | null = null;

const IDEMPOTENCY_EVENT_TYPE = 'bank.settlement.process';

/** Efeito 1: transferência seller_payout → bank_settlement. */
const HANDLER_SETTLEMENT_TRANSFER = 'bankSettlement.applyTransfer';

/** Efeito 2: persistir estado `sent` no registo de settlement. */
const HANDLER_SETTLEMENT_MARK_SENT = 'bankSettlement.markSettlementSent';

interface TransferStepResult {
  transactionId: string;
}

/**
 * Transferência + atualização de estado em blocos idempotentes separados.
 * Chave canónica (semântica): bank.settlement.process:${settlementId}:${handler_name}
 *
 * Exportado para reprocessamento manual (runbook) quando o fluxo fica em `processing`.
 */
export async function executeSettlementEffects(settlement: BankSettlement): Promise<void> {
  const tenantId = settlement.tenantId;

  const transferPayload = {
    settlementId: settlement.id,
    payoutId: settlement.payoutId,
    amountCents: settlement.amountCents,
    currency: settlement.currency,
  };

  await withIdempotency<TransferStepResult>(
    tenantId,
    settlement.id,
    IDEMPOTENCY_EVENT_TYPE,
    HANDLER_SETTLEMENT_TRANSFER,
    transferPayload,
    async () => {
      await bankAccountService.ensurePlatformAccounts(tenantId, settlement.currency as 'BRL');
      const sellerPayoutAccount = await bankAccountService.getPlatformLifecycleAccount(
        tenantId,
        'seller_payout',
        settlement.currency as 'BRL'
      );
      const bankSettlementAccount = await bankAccountService.getPlatformLifecycleAccount(
        tenantId,
        'bank_settlement',
        settlement.currency as 'BRL'
      );
      if (!sellerPayoutAccount || !bankSettlementAccount) {
        throw new Error('seller_payout or bank_settlement account not found');
      }
      const authorship = buildSystemAuthorship({ actingForAccountId: sellerPayoutAccount.accountId });
      const tr = await bankTransactionService.transfer(tenantId, {
        eventId: settlement.id,
        fromAccountId: sellerPayoutAccount.accountId,
        toAccountId: bankSettlementAccount.accountId,
        amountCents: settlement.amountCents,
        currency: settlement.currency as BankCurrency,
        transactionType: 'transfer',
        description: `Bank settlement: ${settlement.id}`,
        metadata: undefined,
        referenceType: 'bank_settlement',
        referenceId: settlement.id,
        treasurySource: 'treasury:settlement',
        authorship,
        concept_id: 'bank-external-settlement',
      });
      return { transactionId: tr.transactionId };
    }
  );

  const sentPayload = { settlementId: settlement.id };
  await withIdempotency<{ sent: true }>(
    tenantId,
    settlement.id,
    IDEMPOTENCY_EVENT_TYPE,
    HANDLER_SETTLEMENT_MARK_SENT,
    sentPayload,
    async () => {
      await updateSettlementStatus(tenantId, settlement.id, 'sent');
      return { sent: true };
    }
  );
}

/**
 * Reprocessamento manual seguro: volta a executar os mesmos efeitos idempotentes
 * (ledger + mark `sent`). Não duplica transfer se já tiver sucesso registado.
 *
 * @throws NotFoundError se o settlement não existir
 * @throws BadRequestError se o status não for `processing`
 */
export async function reprocessSettlement(settlementId: string): Promise<void> {
  const settlement = await getBankSettlementById(settlementId);
  if (!settlement) {
    throw new NotFoundError(`Settlement não encontrado: ${settlementId}`);
  }
  if (settlement.status !== 'processing') {
    throw new BadRequestError(
      `Reprocessamento só é permitido em status processing (atual: ${settlement.status})`
    );
  }
  canonicalLogger.info(null, 'Reprocessamento manual de settlement (processing)', {
    action: 'reprocess_settlement',
    settlementId,
    tenantId: settlement.tenantId,
  });
  await executeSettlementEffects(settlement);
}

async function runBankSettlementCycle(): Promise<void> {
  try {
    const settlements = await listPendingSettlements(BATCH_LIMIT);
    for (const settlement of settlements) {
      try {
        await checkCircuitBreaker(settlement.tenantId, 'settlements');
        console.log('PROCESSING_BANK_SETTLEMENT', settlement.id);
        await updateSettlementStatus(settlement.tenantId, settlement.id, 'processing');
        await executeSettlementEffects(settlement);
        console.log('BANK_SETTLEMENT_SENT', settlement.id);
      } catch (err) {
        console.error('[BankSettlementWorker] Settlement failed', settlement.id, err);
        try {
          await updateSettlementStatus(settlement.tenantId, settlement.id, 'failed');
        } catch (e) {
          console.error('[BankSettlementWorker] Failed to update status to failed', settlement.id, e);
        }
      }
    }
  } catch (err) {
    console.error('[BankSettlementWorker] Cycle error:', err);
  }
}

export function startBankSettlementWorker(): void {
  if (intervalId !== null) return;
  runBankSettlementCycle().catch((err) => console.error('[BankSettlementWorker] Initial run error:', err));
  intervalId = setInterval(runBankSettlementCycle, INTERVAL_MS);
  console.log('[BankSettlementWorker] Started (interval 10s, batch limit 50)');
}