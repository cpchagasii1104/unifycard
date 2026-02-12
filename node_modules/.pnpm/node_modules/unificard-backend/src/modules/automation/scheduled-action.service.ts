// backend/src/modules/automation/scheduled-action.service.ts
// SPRINT 67: SCHEDULED ACTIONS (AUTOMAÇÃO PROGRAMADA E AUDITÁVEL)

import { scheduledActionRepository } from './scheduled-action.repository';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  ScheduledAction,
  ScheduleActionInput,
  ScheduledActionFilters,
} from './scheduled-action.types';

/**
 * Service para ações programadas
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - NÃO decide se executa
 * - NÃO cria economia nova
 * - NÃO executa nada automaticamente sem trilho
 * - É totalmente auditável, cancelável e governado por policy
 * - Append-only (status muda, mas registros não desaparecem)
 * - Sem heurística
 * - Sem IA
 * - Sem execução silenciosa
 * - Toda execução deve gerar audit event
 * - Falha nunca bloqueia sistema
 */
class ScheduledActionService {
  /**
   * Agenda uma ação para execução futura
   * 
   * Valida:
   * - Referência existe
   * - Policy permite agendamento
   * - scheduled_for é no futuro
   */
  async scheduleAction(
    tenantId: string,
    input: ScheduleActionInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<ScheduledAction> {
    // 1. Validar scheduled_for é no futuro
    const now = new Date();
    if (input.scheduledFor <= now) {
      throw new Error('scheduled_for deve ser no futuro');
    }

    // 2. Validar referência existe (depende do tipo)
    await this.validateReference(tenantId, input.referenceType, input.referenceId);

    // 3. Validar policy permite agendamento
    const policySnapshot = await this.getPolicySnapshot(tenantId, input.actionType);
    if (!this.isSchedulingAllowed(policySnapshot, input.actionType)) {
      throw new Error(`Agendamento não permitido pela policy para ${input.actionType}`);
    }

    // 4. Criar ação programada
    const action = await scheduledActionRepository.createAction(tenantId, {
      actionType: input.actionType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      scheduledFor: input.scheduledFor,
      policySnapshot,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata,
    });

    // 5. Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SCHEDULED_ACTION_CREATED',
      actionId: action.id,
      actionType: input.actionType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      scheduledFor: input.scheduledFor,
      createdByActorId,
      createdByUserId,
    });

    return action;
  }

  /**
   * Cancela uma ação programada
   * 
   * Apenas permite cancelar se status = SCHEDULED
   */
  async cancelAction(
    tenantId: string,
    actionId: string,
    cancelledByActorId?: string,
    cancelledByUserId?: string
  ): Promise<ScheduledAction> {
    const action = await scheduledActionRepository.cancelAction(tenantId, actionId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SCHEDULED_ACTION_CANCELLED',
      actionId: action.id,
      actionType: action.actionType,
      referenceType: action.referenceType,
      referenceId: action.referenceId,
      cancelledByActorId: cancelledByActorId || action.createdByActorId,
      cancelledByUserId: cancelledByUserId || action.createdByUserId,
    });

    return action;
  }

  /**
   * Executa ações vencidas
   * 
   * Busca ações com scheduled_for <= now e status = SCHEDULED
   * Executa uma a uma (try/catch isolado)
   */
  async executeDueActions(tenantId: string, now: Date = new Date()): Promise<{
    executed: number;
    failed: number;
    results: Array<{ actionId: string; success: boolean; error?: string }>;
  }> {
    const dueActions = await scheduledActionRepository.getDueActions(tenantId, now);

    const results: Array<{ actionId: string; success: boolean; error?: string }> = [];
    let executed = 0;
    let failed = 0;

    for (const action of dueActions) {
      try {
        await this.executeSingleAction(tenantId, action.id);
        executed++;
        results.push({ actionId: action.id, success: true });
      } catch (error: any) {
        failed++;
        const errorMessage = error.message || 'Erro desconhecido';
        results.push({ actionId: action.id, success: false, error: errorMessage });
        // Não bloquear outras execuções
        console.error(`[ScheduledAction] Erro ao executar ação ${action.id}:`, error);
      }
    }

    return { executed, failed, results };
  }

  /**
   * Executa uma ação específica
   * 
   * Revalida policy antes de executar
   * Chama o serviço apropriado baseado em action_type
   */
  async executeSingleAction(tenantId: string, actionId: string): Promise<void> {
    const action = await scheduledActionRepository.getActionById(tenantId, actionId);

    if (!action) {
      throw new Error(`Ação programada não encontrada: ${actionId}`);
    }

    if (action.status !== 'SCHEDULED') {
      throw new Error(`Ação não está agendada (status: ${action.status})`);
    }

    // 1. Revalidar policy antes de executar
    const currentPolicy = await this.getPolicySnapshot(tenantId, action.actionType);
    if (!this.isExecutionAllowed(currentPolicy, action.actionType)) {
      await scheduledActionRepository.markAsFailed(
        tenantId,
        actionId,
        'POLICY_DENIED',
        'Execução negada pela policy atual'
      );
      throw new Error('Execução negada pela policy atual');
    }

    try {
      // 2. Executar ação baseada no tipo
      switch (action.actionType) {
        case 'PAYMENT_EXECUTION':
          await this.executePayment(tenantId, action);
          break;
        case 'FISCAL_ISSUE':
          await this.executeFiscalIssue(tenantId, action);
          break;
        case 'PAYOUT_EXECUTION':
          await this.executePayout(tenantId, action);
          break;
        default:
          throw new Error(`Tipo de ação não suportado: ${action.actionType}`);
      }

      // 3. Marcar como executada
      await scheduledActionRepository.markAsExecuted(tenantId, actionId);

      // 4. Registrar auditoria
      await this.recordAudit(tenantId, {
        eventType: 'SCHEDULED_ACTION_EXECUTED',
        actionId: action.id,
        actionType: action.actionType,
        referenceType: action.referenceType,
        referenceId: action.referenceId,
      });
    } catch (error: any) {
      // 5. Marcar como falhada
      const errorCode = error.code || 'EXECUTION_ERROR';
      const errorMessage = error.message || 'Erro desconhecido na execução';
      await scheduledActionRepository.markAsFailed(tenantId, actionId, errorCode, errorMessage);

      // 6. Registrar auditoria de falha
      await this.recordAudit(tenantId, {
        eventType: 'SCHEDULED_ACTION_FAILED',
        actionId: action.id,
        actionType: action.actionType,
        referenceType: action.referenceType,
        referenceId: action.referenceId,
        errorCode,
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Lista ações programadas com filtros
   */
  async listActions(tenantId: string, filters: ScheduledActionFilters = {}): Promise<ScheduledAction[]> {
    return await scheduledActionRepository.listActions(tenantId, filters);
  }

  /**
   * Busca ação por ID
   */
  async getActionById(tenantId: string, actionId: string): Promise<ScheduledAction | null> {
    return await scheduledActionRepository.getActionById(tenantId, actionId);
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Valida que referência existe
   */
  private async validateReference(
    tenantId: string,
    referenceType: string,
    referenceId: string
  ): Promise<void> {
    // Implementação depende do tipo de referência
    // Por enquanto, apenas validação básica
    if (!referenceId) {
      throw new Error('reference_id é obrigatório');
    }

    // TODO: Validar que referência existe no banco
    // Ex: se referenceType = 'payment_intent', verificar que payment_intent existe
  }

  /**
   * Obtém snapshot da policy no momento do agendamento
   */
  private async getPolicySnapshot(
    tenantId: string,
    actionType: string
  ): Promise<Record<string, any>> {
    // Por enquanto, retornar snapshot vazio
    // Futuro: ler policies relevantes e fazer snapshot
    return {
      actionType,
      timestamp: new Date().toISOString(),
      // Adicionar policies relevantes aqui
    };
  }

  /**
   * Verifica se agendamento é permitido pela policy
   */
  private isSchedulingAllowed(policySnapshot: Record<string, any>, actionType: string): boolean {
    // Por padrão, permitir agendamento
    // Futuro: validar policy específica
    return true;
  }

  /**
   * Verifica se execução é permitida pela policy
   */
  private isExecutionAllowed(policySnapshot: Record<string, any>, actionType: string): boolean {
    // Por padrão, permitir execução
    // Futuro: validar policy específica
    return true;
  }

  /**
   * Executa pagamento
   */
  private async executePayment(tenantId: string, action: ScheduledAction): Promise<void> {
    const { paymentExecutionService } = await import('../marketplace/payment-execution.service');
    
    // SPRINT 87: Suportar subscription
    if (action.referenceType === 'subscription') {
      const { subscriptionService } = await import('../subscriptions/subscription.service');
      const idempotencyKey = action.metadata?.idempotencyKey || `subscription-${action.referenceId}-${action.id}`;
      await subscriptionService.executeSubscriptionAction(tenantId, action.referenceId, idempotencyKey);
      return;
    }

    // SPRINT 70: Suportar accounts_payable
    if (action.referenceType === 'accounts_payable') {
      // Para accounts_payable, precisamos criar PaymentIntent primeiro (futuro)
      // Por enquanto, apenas marcar payable como pago
      const { accountsPayableService } = await import('../marketplace/accounts-payable.service');
      const payable = await accountsPayableService.getPayableById(tenantId, action.referenceId);
      
      if (!payable) {
        throw new Error(`Conta a pagar não encontrada: ${action.referenceId}`);
      }

      if (payable.status !== 'SCHEDULED') {
        throw new Error(`Conta a pagar não está agendada (status: ${payable.status})`);
      }

      // Marcar como paga (pagamento real será implementado no futuro com PaymentIntent)
      await accountsPayableService.markAsPaid(
        tenantId,
        payable.id,
        action.createdByActorId,
        action.createdByUserId || undefined
      );

      // TODO: Futuro - criar PaymentIntent e executar pagamento real
      return;
    }

    // Caso padrão: payment_intent (marketplace)
    const paymentIntentId = action.referenceId; // Assumindo que reference_id é o payment_intent_id

    await paymentExecutionService.executePayment(tenantId, {
      paymentIntentId,
      buyerActorId: action.metadata.buyerActorId,
      sellerActorId: action.metadata.sellerActorId,
      actingUserId: action.createdByUserId || undefined,
    });
  }

  /**
   * Executa emissão fiscal
   */
  private async executeFiscalIssue(tenantId: string, action: ScheduledAction): Promise<void> {
    const { fiscalIssuanceService } = await import('../marketplace/fiscal-issuance.service');
    
    const documentId = action.referenceId; // Assumindo que reference_id é o fiscal_document_id

    await fiscalIssuanceService.issueDocument(tenantId, documentId);
  }

  /**
   * Executa payout
   */
  private async executePayout(tenantId: string, action: ScheduledAction): Promise<void> {
    const { payoutService } = await import('../marketplace/payout.service');
    
    const paymentIntentId = action.referenceId; // Assumindo que reference_id é o payment_intent_id

    await payoutService.executePayout(tenantId, {
      paymentIntentId,
      actingUserId: action.createdByUserId || undefined,
    });
  }

  /**
   * Registra evento de auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      actionId: string;
      actionType: string;
      referenceType: string;
      referenceId: string;
      scheduledFor?: Date;
      createdByActorId?: string;
      createdByUserId?: string | null;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.createdByActorId || data.cancelledByActorId || null,
        actor_type: 'user',
        source: 'automation',
        context: {
          action_id: data.actionId,
          action_type: data.actionType,
          reference_type: data.referenceType,
          reference_id: data.referenceId,
          scheduled_for: data.scheduledFor?.toISOString(),
          created_by_user_id: data.createdByUserId,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId,
          error_code: data.errorCode,
          error_message: data.errorMessage,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[ScheduledAction] Erro ao registrar auditoria:', error);
    }
  }
}

export const scheduledActionService = new ScheduledActionService();

