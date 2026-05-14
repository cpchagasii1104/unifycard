// backend/src/core/unifybank/bank-p2p-transfer.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de transferência P2P entre usuários

import { v4 as uuidv4 } from 'uuid';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { pilotEventsService } from '../pilot/pilot-events.service';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

export interface P2PTransferParams {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  eventId: string;
}

export interface P2PTransferResult {
  transaction: {
    transactionId: string;
    eventId: string;
    amountCents: number;
    currency: string;
    createdAt: Date;
  };
  fromAccountBalanceCents: number;
  toAccountBalanceCents: number;
  fromUserId: string;
  toUserId: string;
}

class BankP2PTransferService {
  /**
   * Executa transferência P2P entre dois usuários
   * 
   * GARANTIAS:
   * - Transação SQL atômica (via transactionService)
   * - Validação de saldo (>= amount)
   * - Idempotência via eventId
   * - Ledger imutável (double-entry)
   * - fromUserId !== toUserId
   * - toUserId deve existir
   * 
   * @param tenantId - ID do tenant
   * @param params - Parâmetros da transferência
   * @returns Resultado da transferência
   */
  async transferP2P(
    tenantId: string,
    params: P2PTransferParams
  ): Promise<P2PTransferResult> {
    const { fromUserId, toUserId, amountCents, eventId } = params;

    // 1. Validações básicas
    if (amountCents <= 0) {
      const error = new Error('Amount must be greater than zero');
      (error as any).statusCode = 400;
      throw error;
    }

    if (fromUserId === toUserId) {
      const error = new Error('Cannot transfer to yourself');
      (error as any).statusCode = 400;
      throw error;
    }

    // 2. Verificar se toUserId existe (buscar global_user_id)
    const toGlobalUserId = await resolveGlobalUserId(toUserId, tenantId);
    if (!toGlobalUserId) {
      const error = new Error('Destination user not found');
      (error as any).statusCode = 404;
      throw error;
    }

    // AUTORIDADE: fail-closed — qualquer erro ou ausência de actor bloqueia.
    // Sem try/catch: erro 403 e erro de infraestrutura resultam igualmente em bloqueio.
    // Actor não resolvido = bloqueio (não bypass silencioso).
    // Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §2, LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
    const { resolveActorIdForWalletOwner } = await import('@modules/risk-identity/risk-permissions');
    const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
    const fromActorId = await resolveActorIdForWalletOwner(tenantId, fromUserId);
    if (!fromActorId) {
      throw Object.assign(new Error('ACTOR_ID_NOT_RESOLVED'), { statusCode: 400 });
    }
    await requireFinancialRiskClearance(tenantId, {
      actorId: fromActorId,
      action: 'financial_transfer',
      amountCents,
    });

    // 3. Resolver contas dos usuários no Unify Bank
    const bankAccount = bankPortsRegistry.getBankAccount();
    const fromAccount = await bankAccount.getOrCreateAccount(tenantId, {
      ownerId: fromUserId,
      ownerType: 'user',
      currency: 'BRL',
    });

    const toAccount = await bankAccount.getOrCreateAccount(tenantId, {
      ownerId: toUserId,
      ownerType: 'user',
      currency: 'BRL',
    });

    // 4. Validar saldo do remetente (deve ser >= amountCents)
    const fromBalance = await bankAccount.getBalance(tenantId, fromAccount.accountId);
    if (fromBalance.balanceCents < amountCents) {
      const error = new Error('Insufficient balance');
      (error as any).statusCode = 400;
      throw error;
    }

    // 5. SPRINT 36.2: Validar limite diário (enforcement) — fail-closed
    // Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §2 (UNIFICARD_PLANO_MESTRE_v2_1 — PASSO 1B)
    const bankLimit = bankPortsRegistry.getBankLimit();
    await bankLimit.validateLimit(
      tenantId,
      fromUserId,
      'transfer',
      amountCents,
      fromUserId
    );

    // Resolver actor do remetente para autoria
    const fromActor = await ensureUserActor(tenantId, fromUserId);

    // Construir autoria (ownership: remetente é dono da conta origem)
    const { buildFinancialAuthorshipFromRequest } = await import('@modules/bank/financial-authorship.helper');
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: fromUserId,
      actingForActorId: fromActor.actor_id,
      actingForAccountId: fromAccount.accountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: fromActor.actor_id,
        userId: fromUserId,
        decidedAt: new Date().toISOString(),
      },
    });

    // 5. Executar transferência usando Unify Bank (context: p2p_transfer, 0% fee)
    const bankTransaction = bankPortsRegistry.getBankTransaction();
    const result = await bankTransaction.createTransactionWithSplit(tenantId, {
      eventId,
      fromAccountId: fromAccount.accountId,
      amountCents,
      currency: 'BRL',
      context: 'p2p_transfer',
      revenueShareAccountId: toAccount.accountId,
      fromUserId,
      description: `P2P transfer: ${fromUserId} → ${toUserId}`,
      concept_id: 'split-payment', // P2P-1: concept canônico existente (não criar concept novo — DECISION-C2-009/010)
      metadata: {
        type: 'p2p_transfer',
        fromUserId,
        toUserId,
      },
      authorship,
    });

    // 6. Obter saldos atualizados
    const fromBalanceAfter = await bankAccount.getBalance(tenantId, fromAccount.accountId);
    const toBalanceAfter = await bankAccount.getBalance(tenantId, toAccount.accountId);

    // SPRINT 13: Observar primeira transação (assíncrono, não bloqueia)
    pilotEventsService.recordEvent(tenantId, {
      eventType: 'first_transaction',
      actorId: fromUserId,
      actorType: 'user',
      metadata: {
        transactionType: 'p2p_transfer',
        amountCents,
      },
    }).catch((err) => {
      // Erro silencioso - não quebrar fluxo
      console.warn('[PilotObserver] Erro ao registrar evento de transação:', err);
    });

    return {
      transaction: {
        transactionId: result.transaction.transactionId,
        eventId,
        amountCents: result.transaction.amountCents ?? amountCents,
        currency: 'BRL',
        createdAt: result.transaction.createdAt,
      },
      fromAccountBalanceCents: fromBalanceAfter.balanceCents,
      toAccountBalanceCents: toBalanceAfter.balanceCents,
      fromUserId,
      toUserId,
    };
  }
}

export const bankP2PTransferService = new BankP2PTransferService();
























