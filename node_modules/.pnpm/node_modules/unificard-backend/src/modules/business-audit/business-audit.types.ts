// backend/src/modules/business-audit/business-audit.types.ts
// Tipos para Auditoria de Negócio
// 🔴 BLINDAGEM: Logs são IMUTÁVEIS (append-only)
// 🔴 BLINDAGEM: Logs NÃO mudam estado
// 🔴 BLINDAGEM: Logs NÃO disparam ações

/**
 * Tipo de ação auditada
 */
export type BusinessAuditAction =
  | 'booking_requested'
  | 'booking_decided'
  | 'booking_confirmed'
  | 'rfq_created'
  | 'quote_submitted'
  | 'rfq_converted'
  | 'bundle_confirmed'
  | 'financial_terms_confirmed'
  | 'service_order_created'
  | 'service_order_confirmed'
  | 'service_order_started'
  | 'service_order_completed'
  | 'service_order_cancelled'
  | 'permission_denied'
  | 'production_assisted_required'
  | 'agreement_created'
  | 'agreement_updated'
  | 'agreement_proposed'
  | 'agreement_accepted'
  | 'agreement_finalized'
  | 'agreement_bypass_attempted'
  | 'evidence_event_added'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'escrow_created'
  | 'funds_held'
  | 'milestone_reached'
  | 'funds_released'
  | 'refund_issued'
  | 'escrow_bypass_attempted'
  | 'trust_event_registered'
  | 'trust_score_updated'
  | 'trust_action_blocked'
  | 'bypass_detected'
  | 'off_platform_attempt'
  | 'ledger_entry_created'
  | 'payout_batch_created'
  | 'payout_executed'
  | 'payout_blocked'
  | 'payout_failed'
  | 'invoice_created'
  | 'invoice_issued'
  | 'invoice_cancelled'
  | 'risk_dashboard_viewed'
  | 'policy_created'
  | 'policy_activated'
  | 'policy_deactivated'
  | 'policy_decision_applied'
  | 'policy_decision_revoked'
  | 'MARKETPLACE_STORE_ONBOARDED'
  | 'MARKETPLACE_CATEGORY_IMPORTED'
  | 'MARKETPLACE_CATEGORY_IMPORT_UPDATED';

/**
 * Tipo de contexto da ação
 */
export type BusinessAuditContextType = 'event' | 'rfq' | 'booking' | 'service_order' | 'bundle' | 'split' | 'agreement' | 'evidence_pack' | 'escrow' | 'trust_profile' | 'ledger' | 'payout_batch' | 'payout_order' | 'invoice' | 'risk_command_center' | 'ACTOR';

/**
 * Log de auditoria de negócio
 */
export interface BusinessAuditLog {
  logId: string;
  tenantId: string;
  action: BusinessAuditAction;
  actorId: string;
  userId?: string | null;
  contextType: BusinessAuditContextType;
  contextId: string;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

/**
 * Input para criar log de auditoria
 */
export interface CreateBusinessAuditLogInput {
  action: BusinessAuditAction;
  actorId: string;
  userId?: string | null;
  contextType: BusinessAuditContextType;
  contextId: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para buscar logs
 */
export interface BusinessAuditLogFilters {
  actorId?: string;
  action?: BusinessAuditAction;
  contextType?: BusinessAuditContextType;
  contextId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

