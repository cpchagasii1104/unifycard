"use strict";
// src/core/orchestrator/executors/work.executors.ts
//
// Executores do Orchestrator para eventos do módulo Work
// Integra com Memory Engine e AI Kernel
Object.defineProperty(exports, "__esModule", { value: true });
exports.onJobCreated = onJobCreated;
exports.onAssignmentCompleted = onAssignmentCompleted;
const memory_service_1 = require("@core/memory/memory.service");
const ai_kernel_1 = require("@core/ai/ai-kernel");
/**
 * Handler para evento: work.job.created
 * Salva contexto no Memory Engine
 */
async function onJobCreated(event) {
    const payload = event.payload;
    // Salvar contexto no Memory Engine
    await memory_service_1.memoryService.saveContext('job_created', {
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
async function onAssignmentCompleted(event) {
    const payload = event.payload;
    // 1. Salvar contexto no Memory Engine
    await memory_service_1.memoryService.saveContext('assignment_completed', {
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
    const aiKernel = ai_kernel_1.AIKernel.getInstance();
    const summary = await aiKernel.summarizeWorkSession({
        tenantId: event.tenantId,
        userId: payload.userId,
        jobId: payload.jobId,
        assignmentId: payload.assignmentId,
        workerId: payload.workerId,
        timestamp: payload.timestamp,
    });
    // 3. Salvar resumo no Memory Engine também
    await memory_service_1.memoryService.saveContext('work_session_summary', {
        tenantId: event.tenantId,
        userId: payload.userId,
        jobId: payload.jobId,
        assignmentId: payload.assignmentId,
        summary,
        timestamp: payload.timestamp,
    });
}
//# sourceMappingURL=work.executors.js.map