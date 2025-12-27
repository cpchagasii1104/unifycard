// src/core/orchestrator/executors/work.executors.ts
//
// Executores do Orchestrator para eventos do módulo Work
// Integra com Memory Engine e AI Kernel

import type { UnificardEvent } from '@core/events/event-bus';
import { memoryService } from '@core/memory/memory.service';
import { AIKernel } from '@core/ai/ai-kernel';

/**
 * Handler para evento: work.job.created
 * Salva contexto no Memory Engine
 */
export async function onJobCreated(event: UnificardEvent): Promise<void> {
  const payload = event.payload as {
    jobId: string;
    userId: string;
    timestamp: string;
    requestId?: string;
  };

  // Salvar contexto no Memory Engine
  await memoryService.saveContext('job_created', {
    tenantId: event.tenantId,
    userId: payload.userId,
    jobId: payload.jobId,
    timestamp: payload.timestamp,
    requestId: payload.requestId,
  });
}

/**
 * Handler para evento: work.assignment.completed
 * - Salva contexto no Memory Engine
 * - Gera resumo da sessão via AI Kernel
 */
export async function onAssignmentCompleted(event: UnificardEvent): Promise<void> {
  const payload = event.payload as {
    assignmentId: string;
    jobId: string;
    workerId: string;
    userId: string;
    paymentTransactionId?: string;
    timestamp: string;
    requestId?: string;
  };

  // 1. Salvar contexto no Memory Engine
  await memoryService.saveContext('assignment_completed', {
    tenantId: event.tenantId,
    userId: payload.userId,
    jobId: payload.jobId,
    assignmentId: payload.assignmentId,
    workerId: payload.workerId,
    paymentTransactionId: payload.paymentTransactionId,
    timestamp: payload.timestamp,
    requestId: payload.requestId,
  });

  // 2. Gerar resumo da sessão via AI Kernel
  const aiKernel = AIKernel.getInstance();
  const summary = await aiKernel.summarizeWorkSession({
    tenantId: event.tenantId,
    userId: payload.userId,
    jobId: payload.jobId,
    assignmentId: payload.assignmentId,
    workerId: payload.workerId,
    timestamp: payload.timestamp,
  });

  // 3. Salvar resumo no Memory Engine também
  await memoryService.saveContext('work_session_summary', {
    tenantId: event.tenantId,
    userId: payload.userId,
    jobId: payload.jobId,
    assignmentId: payload.assignmentId,
    summary,
    timestamp: payload.timestamp,
  });
}








