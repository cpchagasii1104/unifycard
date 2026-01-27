"use strict";
// src/modules/work/work.events.ts
//
// Centraliza a emissão de eventos do módulo Work
// Integra com Orchestrator, AI Kernel e Memory Engine
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitJobCreated = emitJobCreated;
exports.emitApplicationCreated = emitApplicationCreated;
exports.emitAssignmentCreated = emitAssignmentCreated;
exports.emitAssignmentCompleted = emitAssignmentCompleted;
exports.getRequestId = getRequestId;
const event_bus_1 = require("@core/events/event-bus");
/**
 * Emite evento quando um job é criado
 */
async function emitJobCreated(tenantId, userId, jobId, requestId) {
    await event_bus_1.eventBus.publish({
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
async function emitApplicationCreated(tenantId, userId, applicationId, jobId, workerId, requestId) {
    await event_bus_1.eventBus.publish({
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
async function emitAssignmentCreated(tenantId, userId, assignmentId, jobId, workerId, requestId) {
    await event_bus_1.eventBus.publish({
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
async function emitAssignmentCompleted(tenantId, userId, assignmentId, jobId, workerId, paymentTransactionId, requestId) {
    await event_bus_1.eventBus.publish({
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
function getRequestId(req) {
    return req.requestId;
}
