// backend/src/modules/contextual-messaging/contextual-thread.types.ts
// Tipos para Mensageria Contextual
// 🔴 BLINDAGEM: NÃO toma decisões automáticas
// 🔴 BLINDAGEM: NÃO muda status automaticamente
// 🔴 BLINDAGEM: Comunicação apenas informativa

/**
 * Tipo de contexto da thread
 */
export type ContextualThreadType = 'event' | 'rfq' | 'booking' | 'service_order';

/**
 * Thread contextual vinculada a um contexto específico
 */
export interface ContextualThread {
  threadId: string;
  tenantId: string;
  contextType: ContextualThreadType;
  contextId: string; // eventId, rfqId, bookingId, ou serviceOrderId
  title?: string | null; // Título opcional da thread
  participantActorIds: string[]; // Actors participantes
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mensagem em uma thread contextual
 */
export interface ContextualMessage {
  messageId: string;
  threadId: string;
  tenantId: string;
  senderActorId: string; // Actor que enviou a mensagem
  senderUserId?: string | null; // User que enviou (opcional, para auditoria)
  content: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para criar thread
 */
export interface CreateContextualThreadInput {
  contextType: ContextualThreadType;
  contextId: string;
  title?: string | null;
  participantActorIds: string[];
  metadata?: Record<string, any>;
}

/**
 * Input para enviar mensagem
 */
export interface SendContextualMessageInput {
  threadId: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para buscar threads
 */
export interface ContextualThreadFilters {
  contextType?: ContextualThreadType;
  contextId?: string;
  participantActorId?: string; // Threads onde este actor participa
  limit?: number;
  offset?: number;
}





