// backend/src/modules/marketplace/accounts-payable.types.ts
// SPRINT 70: ACCOUNTS PAYABLE (CONTAS A PAGAR)

/**
 * Status da conta a pagar
 */
export type AccountsPayableStatus = 'OPEN' | 'SCHEDULED' | 'PAID' | 'CANCELLED';

/**
 * Tipo de referência
 */
export type AccountsPayableReferenceType = 'PURCHASE_ORDER' | 'MANUAL';

/**
 * Conta a Pagar
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
export interface AccountsPayable {
  id: string;
  tenantId: string;
  supplierId: string;
  referenceType: AccountsPayableReferenceType;
  referenceId: string;
  amountCents: number;
  currency: string;
  dueDate: Date;
  status: AccountsPayableStatus;
  scheduledActionId: string | null;
  paidAt: Date | null;
  paidByActorId: string | null;
  paidByUserId: string | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar conta a partir de Purchase Order
 */
export interface CreateFromPurchaseOrderInput {
  purchaseOrderId: string;
  amountCents: number;
  currency?: string;
  dueDate: Date | string;
  metadata?: Record<string, any>;
}

/**
 * Input para criar conta manual
 */
export interface CreateManualPayableInput {
  supplierId: string;
  amountCents: number;
  currency?: string;
  dueDate: Date | string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para agendar pagamento
 */
export interface SchedulePaymentInput {
  scheduledFor: Date | string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar contas
 */
export interface AccountsPayableFilters {
  supplierId?: string;
  status?: AccountsPayableStatus;
  referenceType?: AccountsPayableReferenceType;
  referenceId?: string;
  dueDateFrom?: Date | string;
  dueDateTo?: Date | string;
  limit?: number;
  offset?: number;
}






