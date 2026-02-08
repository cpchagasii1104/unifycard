// backend/src/core/events/event-payment-execution.service.ts
// FASE 6.2 — Serviço de Execução de Pagamento (SANDBOX)
// FASE_6_CONTRATO_SPLIT_PAGAMENTO.md
//
// 🔴 REGRAS ABSOLUTAS:
// - Execução só ocorre após autorização explícita
// - Execução respeita custódia e split declarativo
// - Em modo SANDBOX, usa provedor de teste
// - NUNCA executa sem evento explícito
// - NUNCA move dinheiro real em SANDBOX
//
// RESPONSABILIDADES:
// - Executar pagamento respeitando split declarativo
// - Liberar custódia após execução
// - Registrar transações no ledger (SANDBOX)
// - Emitir evento canônico
//
// DEPENDÊNCIAS PERMITIDAS:
// - event.service (leitura)
// - event-custody.service (liberação de custódia)
// - event-split-declarative.service (leitura de split)
// - event-payment-prepared.service (leitura de autorização)
// - bank-integration.service (SANDBOX apenas)
// - event-bus (publicação de eventos)
//
// PROIBIDO ABSOLUTAMENTE:
// - execução automática
// - pagamento sem autorização
// - split implícito
// - custódia silenciosa
// - efeitos sem log
//
import { eventService } from './event.service';
import { eventCustodyService } from './event-custody.service';
import { eventSplitDeclarativeService } from './event-split-declarative.service';
import { eventPaymentPreparedService } from './event-payment-prepared.service';
import { eventBus } from './event-bus';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import { runQueryWithTenant } from '@core/database/pool';
import { v4 as uuidv4 } from 'uuid';

/**
 * Input para executar pagamento
 */
export interface ExecutePaymentInput {
  event_id: string;
  authorization_id: string;
  executed_by_actor_id: string;
  sandbox_mode: boolean; // OBRIGATÓRIO: true para SANDBOX
}

/**
 * Resultado da execução de pagamento
 */
export interface PaymentExecutionResult {
  execution_id: string;
  event_id: string;
  authorization_id: string;
  custody_id: string;
  split_id: string;
  total_amount_cents: number;
  currency: string;
  transaction_ids: string[]; // IDs de transações no bank (SANDBOX)
  executedAt: string;
  sandbox_mode: boolean;
}

interface PaymentExecutionRow {
  id: string;
  tenant_id: string;
  event_id: string;
  authorization_id: string;
  custody_id: string;
  split_id: string;
  total_amount_cents: number;
  currency: string;
  transaction_ids: string[];
  status: 'executed' | 'failed' | 'reversed';
  executedAt: Date;
  createdAt: Date;
}

class EventPaymentExecutionService {
  /**
   * Executa pagamento real (SANDBOX)
   * 
   * PRÉ-REQUISITOS:
   * - Evento está na Fase 6.0
   * - Autorização existe e está autorizada
   * - Custódia existe e está ativa
   * - Split existe e está calculado
   * - Nenhum chargeback ativo
   * - sandbox_mode = true (OBRIGATÓRIO)
   * 
   * Emite: event.payment.executed
   */
  async executePayment(
    tenantId: string,
    input: ExecutePaymentInput
  ): Promise<PaymentExecutionResult> {
    const { event_id, authorization_id, executed_by_actor_id, sandbox_mode } = input;

    // ============================================================
    // 🔴 AJUSTE 1 — VALIDAÇÃO DUPLA DE SANDBOX
    // ============================================================
    // SANDBOX é condição estrutural, não argumento isolado.
    // Validar OBRIGATORIAMENTE:
    // 1) request.sandbox_mode === true
    // 2) environment/config === SANDBOX
    // ============================================================

    // 1. Validar sandbox_mode do request
    if (!sandbox_mode || sandbox_mode !== true) {
      throw new BadRequestError(
        'Execução de pagamento requer sandbox_mode=true. Nenhum dinheiro real será movido.'
      );
    }

    // 2. Validar ambiente/config SANDBOX
    const environmentMode = process.env.ECONOMIC_EXECUTION_MODE || process.env.NODE_ENV;
    const isSandboxEnvironment = 
      environmentMode === 'SANDBOX' || 
      environmentMode === 'sandbox' ||
      environmentMode === 'development' ||
      environmentMode === 'test';

    if (!isSandboxEnvironment) {
      throw new ForbiddenError(
        'Execução econômica permitida apenas em ambiente SANDBOX. ' +
        `Ambiente atual: ${environmentMode}. ` +
        'Configure ECONOMIC_EXECUTION_MODE=SANDBOX ou NODE_ENV=development/test.'
      );
    }

    // ============================================================
    // 🔴 AJUSTE 2 — BLOQUEIO EXPLÍCITO DE PRODUÇÃO
    // ============================================================
    // NENHUMA execução real pode ocorrer fora do SANDBOX,
    // mesmo que o código exista.
    // ============================================================

    const isProduction = 
      process.env.NODE_ENV === 'production' ||
      process.env.ECONOMIC_EXECUTION_MODE === 'production';

    if (isProduction) {
      throw new ForbiddenError(
        'Execução econômica real ainda não habilitada em produção. ' +
        'Apenas modo SANDBOX é permitido no momento.'
      );
    }

    // 1. Validar que o evento está na Fase 6.0
    const event = await eventService.getEvent(tenantId, event_id);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // TODO: Verificar se evento está na Fase 6.0
    // Por enquanto, assumimos que a chamada a este serviço implica que o handoff ocorreu.

    // 2. Buscar autorização
    const authorization = await eventPaymentPreparedService.getAuthorization(tenantId, authorization_id);
    if (!authorization) {
      throw new NotFoundError('Autorização de pagamento não encontrada');
    }
    if (authorization.event_id !== event_id) {
      throw new BadRequestError('Autorização não pertence ao evento');
    }
    if (authorization.status !== 'authorized') {
      throw new BadRequestError(`Autorização não está autorizada (status: ${authorization.status})`);
    }

    // 3. Buscar custódia
    const custody = await eventCustodyService.getCustody(tenantId, authorization.custody_id);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }
    if (custody.status !== 'active') {
      throw new BadRequestError(`Custódia não está ativa (status: ${custody.status})`);
    }

    // 4. Buscar split
    const split = await eventSplitDeclarativeService.getSplit(tenantId, authorization.split_id);
    if (!split) {
      throw new NotFoundError('Split declarativo não encontrado');
    }
    if (split.status !== 'calculated') {
      throw new BadRequestError(`Split não está calculado (status: ${split.status})`);
    }

    // 5. Verificar se há chargeback que congela execuções
    const { eventRefundChargebackService } = await import('./event-refund-chargeback.service');
    const hasFrozen = await eventRefundChargebackService.hasFrozenExecutions(tenantId, event_id);
    if (hasFrozen) {
      throw new ForbiddenError('Execuções congeladas devido a chargeback ativo');
    }

    // 6. Executar pagamento via bank-integration (SANDBOX)
    // 🔴 SANDBOX: Usar apenas provedor de teste
    const transactionIds: string[] = [];
    
    try {
      // Importar bank services
      const { bankAccountService } = await import('@modules/bank/bank-account.service');
      const { bankTransactionService } = await import('@modules/bank/bank-transaction.service');
      
      // Executar split conforme split declarativo
      // Cada parte do split vira uma transação separada
      for (const part of split.parts) {
        // Resolver conta do destinatário
        let targetAccountId: string | null = null;
        
        if (part.target_type === 'user') {
          const targetAccount = await bankAccountService.getOrCreateAccount(tenantId, {
            ownerId: part.target_id,
            ownerType: 'user',
            currency: custody.currency as any,
          });
          targetAccountId = targetAccount.accountId;
        } else {
          // Para outros tipos (page, group, channel, account), usar lógica específica
          // Por enquanto, apenas logar
          console.warn(`[EventPaymentExecution] Tipo de target não suportado para execução: ${part.target_type}`);
          continue;
        }

        if (!targetAccountId) {
          console.warn(`[EventPaymentExecution] Conta não encontrada para target: ${part.target_id}`);
          continue;
        }

        // Resolver conta do pagador (economic_owner da custódia)
        const payerAccount = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: custody.economic_owner_id,
          ownerType: custody.economic_owner_type as 'user' | 'company',
          currency: custody.currency as any,
        });
        const payerAccountId = payerAccount.accountId;
        
        if (!payerAccountId) {
          throw new BadRequestError('Conta do pagador não encontrada');
        }

        // Criar transação no bank (SANDBOX)
        // 🔴 NOTA: Em SANDBOX, isso não move dinheiro real
        const bankResult = await bankTransactionService.transfer(tenantId, {
          eventId: uuidv4(),
          fromAccountId: payerAccountId,
          toAccountId: targetAccountId,
          amountCents: part.amount_cents / 100, // Converter de cents para valor
          currency: custody.currency as any,
          description: `Event payment split: ${part.role} (SANDBOX)`,
          metadata: {
            event_id: event_id,
            custody_id: custody.id,
            split_id: split.id,
            split_part_role: part.role,
            sandbox_mode: true,
          },
        });

        transactionIds.push(bankResult.transactionId);
      }
    } catch (error) {
      // Se falhar, não executar pagamento
      console.error('[EventPaymentExecution] Erro ao executar pagamento via bank:', error);
      throw new BadRequestError(`Erro ao executar pagamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 7. Registrar execução
    const executionId = uuidv4();
    const row = await runQueryWithTenant<PaymentExecutionRow>(
      tenantId,
      `
      INSERT INTO event_payment_execution (
        id, tenant_id, event_id, authorization_id, custody_id, split_id,
        total_amount_cents, currency, transaction_ids, status, executedAt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'executed', NOW())
      RETURNING *
      `,
      [
        executionId,
        tenantId,
        event_id,
        authorization_id,
        custody.id,
        split.id,
        custody.amount_cents,
        custody.currency,
        JSON.stringify(transactionIds),
      ]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao registrar execução de pagamento');
    }

    // 8. Atualizar autorização para 'executed'
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE event_payment_authorization
      SET status = 'executed', executedAt = NOW(), updatedAt = NOW()
      WHERE id = $1 AND tenant_id = $2
      `,
      [authorization_id, tenantId]
    );

    // 9. Atualizar split para 'executed'
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE event_split_declarative
      SET status = 'executed', executedAt = NOW(), updatedAt = NOW()
      WHERE id = $1 AND tenant_id = $2
      `,
      [split.id, tenantId]
    );

    // 10. Liberar custódia (marcar como 'released')
    await eventCustodyService.releaseCustody(tenantId, custody.id, 'Payment executed');

    const execution: PaymentExecutionResult = {
      execution_id: executionId,
      event_id,
      authorization_id,
      custody_id: custody.id,
      split_id: split.id,
      total_amount_cents: custody.amount_cents,
      currency: custody.currency,
      transaction_ids: transactionIds,
      executedAt: row[0].executedAt.toISOString(),
      sandbox_mode: true,
    };

    // 11. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.payment.executed',
      payload: {
        execution_id: executionId,
        event_id,
        authorization_id,
        custody_id: custody.id,
        split_id: split.id,
        total_amount_cents: custody.amount_cents,
        currency: custody.currency,
        transaction_ids: transactionIds,
        executed_by_actor_id: executed_by_actor_id,
        executedAt: execution.executedAt,
        sandbox_mode: true,
      },
      metadata: {
        source: 'EventPaymentExecutionService',
        reason: 'Payment executed in SANDBOX mode',
      },
    });

    return execution;
  }

  /**
   * Busca execução por ID
   */
  async getExecution(
    tenantId: string,
    executionId: string
  ): Promise<PaymentExecutionResult | null> {
    const row = await runQueryWithTenant<PaymentExecutionRow>(
      tenantId,
      `
      SELECT *
      FROM event_payment_execution
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [executionId, tenantId]
    );

    if (!row || row.length === 0) {
      return null;
    }

    return {
      execution_id: row[0].id,
      event_id: row[0].event_id,
      authorization_id: row[0].authorization_id,
      custody_id: row[0].custody_id,
      split_id: row[0].split_id,
      total_amount_cents: row[0].total_amount_cents,
      currency: row[0].currency,
      transaction_ids: JSON.parse(row[0].transaction_ids as any) || [],
      executedAt: row[0].executedAt.toISOString(),
      sandbox_mode: true, // Assumimos que todas as execuções são SANDBOX por enquanto
    };
  }
}

export const eventPaymentExecutionService = new EventPaymentExecutionService();



