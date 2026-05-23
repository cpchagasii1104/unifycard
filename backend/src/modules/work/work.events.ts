// src/modules/work/work.events.ts
//
// Centraliza a emissão de eventos do módulo Work
// Integra com Orchestrator, AI Kernel e Memory Engine

import type { FastifyRequest } from 'fastify';
import { insertWorkEventOutbox } from './work-event-outbox.helper';

/**
 * Emite evento quando um job é criado
 */
export async function emitJobCreated(
  tenantId: string,
  userId: string,
  jobId: string,
  requestId?: string
): Promise<void> {
  await insertWorkEventOutbox(
    tenantId,
    'work.job.created',
    jobId,
    'work.events',
    {
      jobId,
      userId,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    }
  );
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
  await insertWorkEventOutbox(
    tenantId,
    'work.application.created',
    applicationId,
    'work.events',
    {
      applicationId,
      jobId,
      workerId,
      userId,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    }
  );
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
  await insertWorkEventOutbox(
    tenantId,
    'work.assignment.created',
    assignmentId,
    'work.events',
    {
      assignmentId,
      jobId,
      workerId,
      userId,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    }
  );
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
  await insertWorkEventOutbox(
    tenantId,
    'work.assignment.completed',
    assignmentId,
    'work.events',
    {
      assignmentId,
      jobId,
      workerId,
      userId,
      paymentTransactionId: paymentTransactionId || undefined,
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
    }
  );
}

/**
 * Helper para extrair requestId de um FastifyRequest
 */
export function getRequestId(req: FastifyRequest): string | undefined {
  return (req as any).requestId;
}
















