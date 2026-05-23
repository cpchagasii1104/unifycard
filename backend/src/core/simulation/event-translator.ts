// src/core/simulation/event-translator.ts
// Utilitário para traduzir eventos do event_log para CanonicalEvent

import type { UnificardEvent } from '../events/event-bus';
import type { CanonicalEvent, CanonicalEventType } from '../orchestrator/contracts/canonical-event';

/**
 * Mapeia tipos de eventos do Work para tipos canônicos
 */
function mapWorkEventType(eventType: string): CanonicalEventType {
  if (eventType === 'work.assignment.paid' || eventType === 'work_assignment_payment') {
    return 'payment.processed';
  }
  if (eventType === 'work.assignment.completed') {
    return 'service.completed';
  }
  if (eventType === 'work.job.created') {
    return 'service.created';
  }
  if (eventType === 'work.assignment.created') {
    return 'transaction.created';
  }
  return 'other';
}

/**
 * Extrai regionId do payload ou metadata
 */
function extractRegionId(payload: any, metadata?: Record<string, unknown>): string | undefined {
  return (
    payload?.regionId ||
    payload?.regionAccountId ||
    metadata?.regionId ||
    metadata?.regionAccountId ||
    undefined
  );
}

/**
 * Extrai userId do payload
 */
function extractUserId(payload: any): string | undefined {
  return payload?.workerUserId || payload?.clientUserId || payload?.userId || undefined;
}

/**
 * Extrai amount do payload
 */
function extractAmount(payload: any): number | undefined {
  if (typeof payload?.amount === 'number') {
    return payload.amount;
  }
  if (typeof payload?.agreedRate === 'number') {
    return payload.agreedRate;
  }
  if (typeof payload?.totalAmount === 'number') {
    return payload.totalAmount;
  }
  return undefined;
}

/**
 * Traduz evento do event_log para formato canônico
 */
export function translateEventToCanonical(event: UnificardEvent): CanonicalEvent | null {
  try {
    const payload = event.payload as any;
    const metadata = event.metadata || {};

    // Apenas eventos do Work por enquanto
    if (!event.type.startsWith('work.')) {
      return null;
    }

    const canonicalType = mapWorkEventType(event.type);

    // Extrair informações do payload
    const regionId = extractRegionId(payload, metadata);
    const userId = extractUserId(payload);
    const amount = extractAmount(payload);

    // Construir evento canônico
    const canonicalEvent: CanonicalEvent = {
      eventId: event.eventId,
      eventType: canonicalType,
      sourceModule: 'work',
      tenantId: event.tenantId,
      regionId,
      userId,
      amountCents: amount ?? 0,
      currency: payload?.currency || metadata?.currency || 'BRL',
      occurredAt: event.createdAt.toISOString(),
      metadata: {
        originalEventType: event.type,
        ...payload,
        ...metadata,
      },
    };

    return canonicalEvent;
  } catch (error) {
    console.error('[EventTranslator] Erro ao traduzir evento:', error);
    return null;
  }
}











