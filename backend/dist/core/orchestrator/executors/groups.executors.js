"use strict";
// src/core/orchestrator/executors/groups.executors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGroupCreated = handleGroupCreated;
exports.handleGroupMemberJoined = handleGroupMemberJoined;
exports.handleGroupMemberLeft = handleGroupMemberLeft;
exports.handleGroupFundReceived = handleGroupFundReceived;
exports.registerGroupEventHandlers = registerGroupEventHandlers;
const memory_service_1 = require("@core/memory/memory.service");
/**
 * Executores para eventos de grupos
 * Salva contexto no Memory e envia para AI Kernel
 */
/**
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleGroupCreated(event) {
    // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        console.error('[GroupsExecutor] ❌ Evento rejeitado: tenantId ausente ou inválido', {
            eventType: event.type,
            eventId: event.eventId,
            tenantId: event.tenantId,
            timestamp: new Date().toISOString(),
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for group.created handler');
    }
    const { tenantId, payload } = event;
    const { groupId, name, ownerUserId } = payload;
    // Salvar no Memory
    await memory_service_1.memoryService.saveContext(`group_created:${groupId}`, {
        userId: ownerUserId,
        contextType: 'group_created',
        metadata: {
            groupId,
            name,
            action: 'created',
        },
    });
    // TODO: Enviar para AI Kernel gerar resumo
}
/**
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleGroupMemberJoined(event) {
    // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        console.error('[GroupsExecutor] ❌ Evento rejeitado: tenantId ausente ou inválido', {
            eventType: event.type,
            eventId: event.eventId,
            tenantId: event.tenantId,
            timestamp: new Date().toISOString(),
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for group.member.joined handler');
    }
    const { tenantId, payload } = event;
    const { groupId, userId, role } = payload;
    // Salvar no Memory
    await memory_service_1.memoryService.saveContext(`group_participation:${groupId}:${userId}`, {
        userId,
        contextType: 'group_participation',
        metadata: {
            groupId,
            action: 'joined',
            role,
        },
    });
}
/**
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleGroupMemberLeft(event) {
    // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        console.error('[GroupsExecutor] ❌ Evento rejeitado: tenantId ausente ou inválido', {
            eventType: event.type,
            eventId: event.eventId,
            tenantId: event.tenantId,
            timestamp: new Date().toISOString(),
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for group.member.left handler');
    }
    const { tenantId, payload } = event;
    const { groupId, userId } = payload;
    // Salvar no Memory
    await memory_service_1.memoryService.saveContext(`group_participation:${groupId}:${userId}`, {
        userId,
        contextType: 'group_participation',
        metadata: {
            groupId,
            action: 'left',
        },
    });
}
/**
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleGroupFundReceived(event) {
    // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        console.error('[GroupsExecutor] ❌ Evento rejeitado: tenantId ausente ou inválido', {
            eventType: event.type,
            eventId: event.eventId,
            tenantId: event.tenantId,
            timestamp: new Date().toISOString(),
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for group.fund.received handler');
    }
    const { tenantId, payload } = event;
    const { groupId, amount, source, transactionId } = payload;
    // Salvar no Memory
    await memory_service_1.memoryService.saveContext(`group_fund:${groupId}:${transactionId}`, {
        userId: groupId, // Usar groupId como identificador
        contextType: 'group_fund',
        metadata: {
            groupId,
            amount,
            source,
            transactionId,
            action: 'fund_received',
        },
    });
    // Chamar handler de auto-post (se fastify disponível)
    // Nota: Este handler será chamado de forma assíncrona
    // O auto-post será criado via groups-activity.executors.ts
}
// Registrar handlers no EventBus (se método subscribe disponível)
// Por enquanto, eventos são publicados via eventBus.publish() e podem ser consumidos por outros módulos
// TODO: Implementar sistema de subscribers quando necessário
function registerGroupEventHandlers() {
    // EventBus atual usa publish/subscribe pattern
    // Handlers podem ser registrados em outros lugares se necessário
    // Por enquanto, eventos são apenas publicados
}
