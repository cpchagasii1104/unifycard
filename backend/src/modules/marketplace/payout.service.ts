// backend/src/modules/marketplace/payout.service.ts
// SPRINT 40.2: MARKETPLACE EXECUÇÃO - Payout Real
// Service para execução de payouts reais

import { v4 as uuidv4 } from 'uuid';
import { paymentIntentService } from './payment-intent.service';
import { paymentSplitService } from './payment-split.service';
import { bankAccountService } from '../bank/bank-account.service';
import { bankTransactionService } from '../bank/bank-transaction.service';
import { getClientWithTenant } from '@core/database/pool';
import type { PayoutTransaction, ExecutePayoutInput } from './payout.types';
import type { BankCurrency } from '../bank/bank-account.types';

/** Repo migrado para Bank - fail-fast até migração */
const payoutTransactionRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('PayoutTransaction migrated to Bank')),
});

/**
 * Service para execução de payouts
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Payout segue exatamente o split declarado
 * - Nenhum valor é recalculado
 * - Falha em um payout não cancela os outros
 * - NÃO recalcular valores
 * - NÃO alterar splits
 */
class PayoutService {
  /**
   * Executa payout para todos os splits de um payment intent
   * 
   * Fluxo:
   * 1. Validar que PaymentIntent está AUTHORIZED e tem splits
   * 2. Para cada split:
   *    - Criar payout_transaction PENDING
   *    - Chamar Bank transfer (plataforma → recipient)
   *    - Se sucesso: salvar bank_transaction_id, status = SUCCESS
   *    - Se falha: status = FAILED, salvar error_code
   * 3. Não abortar payouts restantes se um falhar
   */
  async executePayout(
    tenantId: string,
    input: ExecutePayoutInput & { idempotencyKey?: string }
  ): Promise<PayoutTransaction[]> {
    const { paymentIntentId, actingUserId, idempotencyKey } = input;

    // 1. Validar que PaymentIntent está AUTHORIZED
    const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${paymentIntentId}`);
    }

    if (intent.status !== 'AUTHORIZED') {
      throw new Error(
        `Payout só pode ser executado para payment intents AUTHORIZED. Status atual: ${intent.status}`
      );
    }

    // 2. Validar que existem splits definidos
    const splits = await paymentSplitService.getSplitsByIntent(tenantId, paymentIntentId);

    if (splits.length === 0) {
      throw new Error(`Nenhum split definido para payment intent ${paymentIntentId}`);
    }

    // 3. Resolver conta da plataforma (fee account)
    const platformAccount = await bankAccountService.getSystemAccount(
      tenantId,
      'fee',
      intent.currency as BankCurrency
    );

    if (!platformAccount) {
      throw new Error(`Conta da plataforma (fee) não encontrada para moeda ${intent.currency}`);
    }

    // 4. Executar payout para cada split
    const results: PayoutTransaction[] = [];

    for (const split of splits) {
      try {
        // SPRINT 41.2: Idempotência - verificar se já existe payout com mesma key
        const splitIdempotencyKey = idempotencyKey ? `${idempotencyKey}-${split.id}` : undefined;
        
        if (splitIdempotencyKey) {
          const existing = await payoutTransactionRepository.getTransactionByIdempotencyKey(
            tenantId,
            paymentIntentId,
            split.id,
            splitIdempotencyKey
          );
          if (existing) {
            // Retornar payout existente (idempotente)
            results.push(existing);
            continue;
          }
        }

        // Criar payout_transaction PENDING
        const payoutTransaction = await payoutTransactionRepository.createTransaction(
          tenantId,
          paymentIntentId,
          split.id,
          split.recipientActorId,
          split.amountCents,
          intent.currency,
          splitIdempotencyKey
        );

        try {
          // Resolver conta do recipient
          const recipientAccountId = await this.resolveActorAccount(
            tenantId,
            split.recipientActorId,
            intent.currency as BankCurrency
          );

          const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
          const authorship = buildSystemAuthorship({
            actingForAccountId: platformAccount.accountId,
          });
          const eventId = uuidv4();
          const bankResult = await bankTransactionService.transfer(tenantId, {
            eventId,
            fromAccountId: platformAccount.accountId,
            toAccountId: recipientAccountId,
            amountCents: split.amountCents,
            currency: intent.currency as BankCurrency,
            transactionType: 'transfer',
            description: `Marketplace payout: Split ${split.id}`,
            metadata: {
              payment_intent_id: paymentIntentId,
              payment_split_id: split.id,
              recipient_actor_id: split.recipientActorId,
              split_role: split.role,
              acting_user_id: actingUserId,
              context: 'marketplace_payout',
            },
            authorship,
          });

          // Se sucesso: salvar bank_transaction_id, status = SUCCESS
          const successTransaction = await payoutTransactionRepository.markAsSuccess(
            tenantId,
            payoutTransaction.id,
            bankResult.transactionId
          );

          // Registrar auditoria
          await this.recordAudit(tenantId, {
            paymentIntentId,
            paymentSplitId: split.id,
            recipientActorId: split.recipientActorId,
            transactionId: bankResult.transactionId,
            result: 'SUCCESS',
            actingUserId,
          });

          results.push(successTransaction);
        } catch (error: any) {
          // Se falha: status = FAILED, salvar error_code
          const errorCode = error.code || error.message?.substring(0, 100) || 'UNKNOWN_ERROR';

          const failedTransaction = await payoutTransactionRepository.markAsFailed(
            tenantId,
            payoutTransaction.id,
            errorCode
          );

          // Registrar auditoria
          await this.recordAudit(tenantId, {
            paymentIntentId,
            paymentSplitId: split.id,
            recipientActorId: split.recipientActorId,
            transactionId: null,
            result: 'FAILED',
            errorCode,
            actingUserId,
          });

          results.push(failedTransaction);

          // SPRINT 50: Gerar alerta automático quando payout falha
          try {
            const { automationService } = await import('../automation/automation.service');
            await automationService.processEvent(tenantId, {
              eventType: 'PAYOUT_FAILED',
              tenantId,
              entityType: 'payout',
              entityId: payoutTransaction.id,
              context: {
                paymentIntentId,
                paymentSplitId: split.id,
                recipientActorId: split.recipientActorId,
                errorCode,
                amountCents: split.amountCents,
                eventId: uuidv4(),
              },
            });
          } catch (alertError) {
            // Log mas não bloqueia tratamento de falha
            console.warn(`[PayoutService] Erro ao gerar alerta para payout falho:`, alertError);
          }

          // Não abortar payouts restantes - continuar loop
          console.error(
            `[PayoutService] Erro ao executar payout para split ${split.id}:`,
            error
          );
        }
      } catch (error: any) {
        // Erro ao criar payout_transaction - logar mas continuar
        console.error(
          `[PayoutService] Erro ao criar payout transaction para split ${split.id}:`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Resolve conta bancária de um actor
   */
  private async resolveActorAccount(
    tenantId: string,
    actorId: string,
    currency: BankCurrency
  ): Promise<string> {
    const client = await getClientWithTenant(tenantId);

    try {
      // Buscar actor para determinar tipo
      const actorResult = await client.query<{
        actor_type: string;
        user_id: string | null;
        company_id: string | null;
      }>(
        `
        SELECT actor_type, user_id, company_id
        FROM actors
        WHERE tenant_id = $1 AND actor_id = $2
        LIMIT 1
        `,
        [tenantId, actorId]
      );

      if (actorResult.rows.length === 0) {
        throw new Error(`Actor não encontrado: ${actorId}`);
      }

      const actor = actorResult.rows[0];

      // Resolver conta baseado no tipo
      if (actor.actor_type === 'user' && actor.user_id) {
        const account = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: actor.user_id,
          ownerType: 'user',
          currency,
        });
        return account.accountId;
      } else if (actor.actor_type === 'page' && actor.company_id) {
        const account = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: actor.company_id,
          ownerType: 'company',
          currency,
        });
        return account.accountId;
      } else {
        throw new Error(`Tipo de actor não suportado: ${actor.actor_type}`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Registra auditoria do payout
   */
  private async recordAudit(
    tenantId: string,
    data: {
      paymentIntentId: string;
      paymentSplitId: string;
      recipientActorId: string;
      transactionId: string | null;
      result: 'SUCCESS' | 'FAILED';
      errorCode?: string;
      actingUserId?: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: 'MARKETPLACE_PAYOUT_EXECUTED',
        severity: data.result === 'SUCCESS' ? 'low' : 'medium',
        actor_id: data.recipientActorId ?? null,
        actor_type: 'user', // Assumindo user para recipient
        company_id: undefined,
        employee_id: undefined,
        source: 'marketplace_payout',
        context: {
          payment_intent_id: data.paymentIntentId,
          payment_split_id: data.paymentSplitId,
          recipient_actor_id: data.recipientActorId,
          bank_transaction_id: data.transactionId,
          result: data.result,
          error_code: data.errorCode,
          acting_user_id: data.actingUserId,
        },
      });
    } catch (auditErr) {
      // Não falhar execução se auditoria falhar
      console.error('[AuditService] Erro ao registrar evento MARKETPLACE_PAYOUT_EXECUTED:', auditErr);
    }
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<PayoutTransaction | null> {
    return await payoutTransactionRepository.getTransactionById(tenantId, transactionId);
  }

  /**
   * Lista transações de um payment intent
   */
  async getPayoutsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PayoutTransaction[]> {
    return await payoutTransactionRepository.listTransactionsByIntent(tenantId, paymentIntentId);
  }
}

export const payoutService = new PayoutService();


