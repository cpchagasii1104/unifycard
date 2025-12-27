// src/modules/work/work.events.ts
//
// Centraliza a emissão de eventos do módulo Work
// Integra com Orchestrator, AI Kernel e Memory Engine

import { eventBus } from '@core/events/event-bus';
import type { FastifyRequest } from 'fastify';

/**
 * Emite evento quando um job é criado
 */
export async function emitJobCreated(
  tenantId: string,
  userId: string,
  jobId: string,
  requestId?: string
): Promise<void> {
  await eventBus.publish({
    tenantId,
    type: 'work.job.created',
    payload: {
      jobId,
      userId,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    },
  });
}

/**
 * Emite evento quando uma aplicação é criada
 */
export async function emitApplicationCreated(
  tenantId: string,
  userId: string,
  applicationId: string,
  jobId: string,
  workerId: string,
  requestId?: string
): Promise<void> {
  await eventBus.publish({
    tenantId,
    type: 'work.application.created',
    payload: {
      applicationId,
      jobId,
      workerId,
      userId,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    },
  });
}

/**
 * Emite evento quando um assignment é criado
 */
export async function emitAssignmentCreated(
  tenantId: string,
  userId: string,
  assignmentId: string,
  jobId: string,
  workerId: string,
  requestId?: string
): Promise<void> {
  await eventBus.publish({
    tenantId,
    type: 'work.assignment.created',
    payload: {
      assignmentId,
      jobId,
      workerId,
      userId,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    },
  });
}

/**
 * Emite evento quando um assignment é completado
 */
export async function emitAssignmentCompleted(
  tenantId: string,
  userId: string,
  assignmentId: string,
  jobId: string,
  workerId: string,
  paymentTransactionId?: string,
  requestId?: string
): Promise<void> {
  await eventBus.publish({
    tenantId,
    type: 'work.assignment.completed',
    payload: {
      assignmentId,
      jobId,
      workerId,
      userId,
      paymentTransactionId: paymentTransactionId || undefined,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    },
  });
}

/**
 * Helper para extrair requestId de um FastifyRequest
 */
export function getRequestId(req: FastifyRequest): string | undefined {
  return (req as any).requestId;
}








