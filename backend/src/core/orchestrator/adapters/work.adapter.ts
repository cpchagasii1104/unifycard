// src/core/orchestrator/adapters/work.adapter.ts
// Adapter para traduzir eventos do módulo Work para formato canônico

import type { UnificardEvent } from '@core/events/event-bus';
import type { CanonicalEvent, CanonicalEventType } from '../contracts/canonical-event';
import { canonicalOrchestrator } from '../canonical-orchestrator.service';

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
  // Tentar de várias fontes
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
 * Traduz evento do Work para formato canônico
 */
function translateWorkEvent(event: UnificardEvent): CanonicalEvent | null {
  try {
    const payload = event.payload as any;
    const metadata = event.metadata || {};

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
      amount,
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
    console.error('[WorkAdapter] Erro ao traduzir evento:', error);
    return null;
  }
}

/**
 * Handler para eventos do Work
 */
export async function handleWorkEvent(event: UnificardEvent): Promise<void> {
  // Filtrar apenas eventos do Work
  if (!event.type.startsWith('work.')) {
    return;
  }

  const canonicalEvent = translateWorkEvent(event);
  if (!canonicalEvent) {
    return; // Evento não pôde ser traduzido
  }

  // Enviar para o orchestrator canônico
  await canonicalOrchestrator.receiveEvent(canonicalEvent);
}

/**
 * Registra handlers para todos os tipos de eventos do Work
 */
export function registerWorkAdapters(): void {
  // Importar eventBus de forma segura (evitar circular dependency)
  const { eventBus } = require('@core/events/event-bus');

  // Eventos principais do Work que devem ser traduzidos
  const workEventTypes = [
    'work.job.created',
    'work.assignment.created',
    'work.assignment.completed',
    'work.assignment.paid',
    'work.application.created',
    'work.worker.created',
    'work.worker.updated',
  ];

  for (const eventType of workEventTypes) {
    try {
      eventBus.registerHandler(eventType, handleWorkEvent);
    } catch (error) {
      console.warn(`[WorkAdapter] Erro ao registrar handler para ${eventType}:`, error);
    }
  }
}

