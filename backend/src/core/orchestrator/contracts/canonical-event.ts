// src/core/orchestrator/contracts/canonical-event.ts
// Contrato canônico de evento para orquestração entre módulos

/**
 * Contrato canônico de evento
 * Formato padronizado para comunicação entre módulos
 */
export interface CanonicalEvent {
  eventId: string;
  eventType: string;
  sourceModule: string;
  tenantId: string;
  regionId?: string;
  userId?: string;
  amountCents: number;
  currency?: string;
  occurredAt: string; // ISO date string
  metadata?: Record<string, unknown>;
}

/**
 * Tipos de eventos canônicos suportados
 */
export type CanonicalEventType =
  | 'transaction.created'
  | 'transaction.completed'
  | 'payment.processed'
  | 'service.completed'
  | 'service.created'
  | 'user.action'
  | 'region.fund.credited'
  | 'group.fund.credited'
  | 'other';












