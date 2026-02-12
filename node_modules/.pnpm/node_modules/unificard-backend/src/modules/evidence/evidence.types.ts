// backend/src/modules/evidence/evidence.types.ts
// Camada de Evidências & Resolução de Disputas
// 🔴 BLINDAGEM: Append-only, imutável, sem decisões automáticas

/**
 * Tipo de contexto do evidence pack
 */
export type EvidenceContextType = 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement' | 'thread';

/**
 * Status de disputa
 */
export type DisputeStatus = 'NONE' | 'OPEN' | 'IN_MEDIATION' | 'RESOLVED';

/**
 * Tipo de evento na timeline
 */
export type EvidenceEventType =
  | 'message_sent'
  | 'agreement_created'
  | 'agreement_updated'
  | 'agreement_proposed'
  | 'agreement_accepted'
  | 'agreement_finalized'
  | 'booking_created'
  | 'booking_decided'
  | 'booking_confirmed'
  | 'service_order_created'
  | 'service_order_confirmed'
  | 'bundle_created'
  | 'bundle_confirmed'
  | 'financial_terms_confirmed'
  | 'bypass_attempted'
  | 'bypass_detected'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'ledger_entry_created'
  | 'payout_batch_created'
  | 'payout_executed'
  | 'payout_blocked'
  | 'payout_failed'
  | 'invoice_created'
  | 'invoice_issued'
  | 'invoice_cancelled'
  | 'policy_decision_applied'
  | 'policy_decision_revoked';

/**
 * Evento na timeline de evidências
 */
export interface EvidenceEvent {
  eventId: string;
  eventType: EvidenceEventType;
  timestamp: Date;
  actorId: string;
  userId: string | null;
  data: Record<string, any>; // Dados específicos do evento
  source: 'chat' | 'agreement' | 'audit' | 'system'; // Origem do evento
  sourceId: string | null; // ID da entidade origem (messageId, agreementId, etc)
}

/**
 * Evidence Pack (Dossiê Imutável)
 * 
 * REGRAS:
 * - Append-only: eventos são adicionados, nunca removidos
 * - Imutável após criação
 * - Consolida automaticamente chat, agreements, audit logs
 * - Usado para disputas, mediação e auditoria
 */
export interface EvidencePack {
  packId: string;
  tenantId: string;
  contextType: EvidenceContextType;
  contextId: string;
  disputeStatus: DisputeStatus;
  openedAt: Date | null;
  resolvedAt: Date | null;
  retentionUntil: Date | null; // Data de retenção (configurável)
  timeline: EvidenceEvent[]; // Timeline ordenada e imutável
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar/atualizar evidence pack
 */
export interface CreateEvidencePackInput {
  contextType: EvidenceContextType;
  contextId: string;
  retentionDays?: number; // Dias de retenção (padrão: 365)
}

/**
 * Input para abrir disputa
 */
export interface OpenDisputeInput {
  reason: string;
  openedByActorId: string;
  openedByUserId?: string | null;
}

/**
 * Input para resolver disputa
 */
export interface ResolveDisputeInput {
  resolution: string;
  resolvedByActorId: string;
  resolvedByUserId?: string | null;
}

/**
 * Filtros para buscar evidence packs
 */
export interface EvidencePackFilters {
  contextType?: EvidenceContextType;
  contextId?: string;
  disputeStatus?: DisputeStatus;
  limit?: number;
  offset?: number;
}

/**
 * Formato de exportação
 */
export type ExportFormat = 'json' | 'pdf';


