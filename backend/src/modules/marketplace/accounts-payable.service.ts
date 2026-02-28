// backend/src/modules/marketplace/accounts-payable.service.ts
// SPRINT 70: ACCOUNTS PAYABLE (CONTAS A PAGAR)

import { scheduledActionService } from '../../modules/automation/scheduled-action.service';
import type {
  AccountsPayable,
  CreateFromPurchaseOrderInput,
  CreateManualPayableInput,
  SchedulePaymentInput,
  AccountsPayableFilters,
} from './accounts-payable.types';

/** Repo migrado para Bank - fail-fast até migração */
const accountsPayableRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('AccountsPayable migrated to Bank')),
});

/**
 * Service para Contas a Pagar
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Não criar PaymentIntent automaticamente
 * - Não emitir fiscal
 * - Não pagar automaticamente
 * - Pagamento real só ocorre quando scheduled action executa
 */
class AccountsPayableService {
  /**
   * Cria conta a pagar a partir de Purchase Order
   * 
   * SPRINT 70: Chamado automaticamente quando PO é RECEIVED
   */
  async createFromPurchaseOrder(
    tenantId: string,
    input: CreateFromPurchaseOrderInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<AccountsPayable> {
    // 1. Buscar Purchase Order para validar e obter supplier_id
    const { purchaseOrderRepository } = await import('./purchase-order.repository');
    const order = await purchaseOrderRepository.getPurchaseOrderById(tenantId, input.purchaseOrderId);

    if (!order) {
      throw new Error(`Purchase Order não encontrada: ${input.purchaseOrderId}`);
    }

    // Validar que ordem está em RECEIVED ou COMPLETED
    if (!['RECEIVED', 'COMPLETED'].includes(order.status)) {
      throw new Error(`Purchase Order não está em RECEIVED ou COMPLETED (status: ${order.status})`);
    }

    // Converter dueDate se necessário
    const dueDate = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);

    // 2. Criar conta a pagar
    const payable = await accountsPayableRepository.createPayable(tenantId, {
      supplierId: order.supplierId,
      referenceType: 'PURCHASE_ORDER',
      referenceId: input.purchaseOrderId,
      amountCents: input.amountCents,
      currency: input.currency || 'BRL',
      dueDate,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: {
        ...input.metadata,
        purchase_order_id: input.purchaseOrderId,
        purchase_order_number: order.orderNumber,
      },
    });

    // 3. Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_PAYABLE_CREATED_FROM_PO',
      payableId: payable.id,
      purchaseOrderId: input.purchaseOrderId,
      status: payable.status,
      createdByActorId,
      createdByUserId,
    });

    return payable;
  }

  /**
   * Cria conta a pagar manual
   */
  async createManualPayable(
    tenantId: string,
    input: CreateManualPayableInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<AccountsPayable> {
    // Validar supplier existe
    const { supplierRepository } = await import('./supplier.repository');
    const supplier = await supplierRepository.getSupplierById(tenantId, input.supplierId);

    if (!supplier) {
      throw new Error(`Fornecedor não encontrado: ${input.supplierId}`);
    }

    // Converter dueDate se necessário
    const dueDate = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);

    // Criar conta a pagar
    const payable = await accountsPayableRepository.createPayable(tenantId, {
      supplierId: input.supplierId,
      referenceType: 'MANUAL',
      referenceId: `manual-${Date.now()}`, // ID único para referência manual
      amountCents: input.amountCents,
      currency: input.currency || 'BRL',
      dueDate,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: {
        ...input.metadata,
        description: input.description,
        manual: true,
      },
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_PAYABLE_CREATED_MANUAL',
      payableId: payable.id,
      status: payable.status,
      createdByActorId,
      createdByUserId,
    });

    return payable;
  }

  /**
   * Agenda pagamento (cria scheduled_action)
   * 
   * SPRINT 70: Cria scheduled_action tipo PAYMENT_EXECUTION
   */
  async schedulePayment(
    tenantId: string,
    payableId: string,
    input: SchedulePaymentInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<AccountsPayable> {
    // 1. Buscar conta
    const payable = await accountsPayableRepository.getPayableById(tenantId, payableId);
    if (!payable) {
      throw new Error(`Conta não encontrada: ${payableId}`);
    }

    if (payable.status !== 'OPEN') {
      throw new Error(`Conta não está em OPEN (status: ${payable.status})`);
    }

    // 2. Converter scheduledFor se necessário
    const scheduledFor = input.scheduledFor instanceof Date ? input.scheduledFor : new Date(input.scheduledFor);

    // Validar scheduledFor é no futuro
    const now = new Date();
    if (scheduledFor <= now) {
      throw new Error('scheduledFor deve ser no futuro');
    }

    // 3. Criar scheduled_action
    const scheduledAction = await scheduledActionService.scheduleAction(
      tenantId,
      {
        actionType: 'PAYMENT_EXECUTION',
        referenceType: 'accounts_payable',
        referenceId: payableId,
        scheduledFor,
        metadata: {
          ...input.metadata,
          payable_id: payableId,
          supplier_id: payable.supplierId,
          amount_cents: payable.amountCents,
          currency: payable.currency,
        },
      },
      createdByActorId,
      createdByUserId
    );

    // 4. Atualizar conta para SCHEDULED
    const scheduledPayable = await accountsPayableRepository.schedulePayment(
      tenantId,
      payableId,
      scheduledAction.id
    );

    // 5. Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_PAYABLE_SCHEDULED',
      payableId: scheduledPayable.id,
      scheduledActionId: scheduledAction.id,
      status: scheduledPayable.status,
      scheduledFor: scheduledFor.toISOString(),
      createdByActorId,
      createdByUserId,
    });

    return scheduledPayable;
  }

  /**
   * Marca conta como paga
   * 
   * SPRINT 70: Chamado quando scheduled_action executa com sucesso
   */
  async markAsPaid(
    tenantId: string,
    payableId: string,
    paidByActorId: string,
    paidByUserId?: string
  ): Promise<AccountsPayable> {
    // 1. Buscar conta
    const payable = await accountsPayableRepository.getPayableById(tenantId, payableId);
    if (!payable) {
      throw new Error(`Conta não encontrada: ${payableId}`);
    }

    if (!['OPEN', 'SCHEDULED'].includes(payable.status)) {
      throw new Error(`Conta não pode ser marcada como paga (status: ${payable.status})`);
    }

    // 2. Marcar como paga
    const paidPayable = await accountsPayableRepository.markAsPaid(
      tenantId,
      payableId,
      paidByActorId,
      paidByUserId || null
    );

    // 3. Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_PAYABLE_PAID',
      payableId: paidPayable.id,
      status: paidPayable.status,
      paidByActorId,
      paidByUserId,
    });

    return paidPayable;
  }

  /**
   * Cancela conta a pagar
   */
  async cancelPayable(
    tenantId: string,
    payableId: string,
    cancelledByActorId: string,
    cancelledByUserId?: string,
    cancellationReason?: string
  ): Promise<AccountsPayable> {
    // 1. Buscar conta
    const payable = await accountsPayableRepository.getPayableById(tenantId, payableId);
    if (!payable) {
      throw new Error(`Conta não encontrada: ${payableId}`);
    }

    if (!['OPEN', 'SCHEDULED'].includes(payable.status)) {
      throw new Error(`Conta não pode ser cancelada (status: ${payable.status})`);
    }

    // 2. Se tiver scheduled_action, cancelar também
    if (payable.scheduledActionId) {
      try {
        await scheduledActionService.cancelAction(
          tenantId,
          payable.scheduledActionId,
          cancelledByActorId,
          cancelledByUserId
        );
      } catch (error) {
        // Não bloquear se cancelamento de scheduled_action falhar
        console.warn(`[AccountsPayable] Erro ao cancelar scheduled_action ${payable.scheduledActionId}:`, error);
      }
    }

    // 3. Cancelar conta
    const cancelledPayable = await accountsPayableRepository.cancelPayable(
      tenantId,
      payableId,
      cancelledByActorId,
      cancelledByUserId || null,
      cancellationReason || null
    );

    // 4. Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_PAYABLE_CANCELLED',
      payableId: cancelledPayable.id,
      status: cancelledPayable.status,
      cancelledByActorId,
      cancelledByUserId,
      cancellationReason,
    });

    return cancelledPayable;
  }

  /**
   * Lista contas com filtros
   */
  async listPayables(tenantId: string, filters: AccountsPayableFilters = {}): Promise<AccountsPayable[]> {
    return await accountsPayableRepository.listPayables(tenantId, filters);
  }

  /**
   * Busca conta por ID
   */
  async getPayableById(tenantId: string, payableId: string): Promise<AccountsPayable | null> {
    return await accountsPayableRepository.getPayableById(tenantId, payableId);
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Registra evento de auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      payableId: string;
      purchaseOrderId?: string;
      scheduledActionId?: string;
      status?: string;
      scheduledFor?: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      paidByActorId?: string;
      paidByUserId?: string | null;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      cancellationReason?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'medium',
        actor_id: data.createdByActorId || data.paidByActorId || data.cancelledByActorId || null,
        actor_type: 'user',
        source: 'automation',
        context: {
          payable_id: data.payableId,
          purchase_order_id: data.purchaseOrderId,
          scheduled_action_id: data.scheduledActionId,
          status: data.status,
          scheduled_for: data.scheduledFor,
          created_by_user_id: data.createdByUserId,
          paid_by_actor_id: data.paidByActorId,
          paid_by_user_id: data.paidByUserId,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId,
          cancellation_reason: data.cancellationReason,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[AccountsPayable] Erro ao registrar auditoria:', error);
    }
  }
}

export const accountsPayableService = new AccountsPayableService();






