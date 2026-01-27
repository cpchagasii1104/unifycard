// backend/src/modules/automation/scheduled-action.types.ts
// SPRINT 67: SCHEDULED ACTIONS (AUTOMAÇÃO PROGRAMADA E AUDITÁVEL)

/**
 * Tipo de ação programada
 */
export type ScheduledActionType = 'PAYMENT_EXECUTION' | 'FISCAL_ISSUE' | 'PAYOUT_EXECUTION';

/**
 * Status da ação programada
 */
export type ScheduledActionStatus = 'SCHEDULED' | 'EXECUTED' | 'CANCELLED' | 'FAILED';

/**
 * Ação programada
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Sem heurística
 * - Sem IA
 * - Sem execução silenciosa
 * - Toda execução deve gerar audit event
 * - Falha nunca bloqueia sistema
 */
export interface ScheduledAction {
  id: string;
  tenantId: string;
  actionType: ScheduledActionType;
  referenceType: string; // Ex: 'payment_intent', 'fiscal_document', 'payout'
  referenceId: string;
  scheduledFor: Date;
  status: ScheduledActionStatus;
  policySnapshot: Record<string, any> | null;
  createdByActorId: string;
  createdByUserId: string | null;
  executedAt: Date | null;
  executionErrorCode: string | null;
  executionErrorMessage: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para agendar ação
 */
export interface ScheduleActionInput {
  actionType: ScheduledActionType;
  referenceType: string;
  referenceId: string;
  scheduledFor: Date;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar ações programadas
 */
export interface ScheduledActionFilters {
  actionType?: ScheduledActionType;
  status?: ScheduledActionStatus;
  referenceType?: string;
  referenceId?: string;
  scheduledForFrom?: Date;
  scheduledForTo?: Date;
  limit?: number;
  offset?: number;
}







