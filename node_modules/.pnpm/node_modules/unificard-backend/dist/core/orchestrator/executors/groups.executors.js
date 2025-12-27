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
async function handleGroupCreated(event) {
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
async function handleGroupMemberJoined(event) {
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
async function handleGroupMemberLeft(event) {
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
async function handleGroupFundReceived(event) {
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
//# sourceMappingURL=groups.executors.js.map