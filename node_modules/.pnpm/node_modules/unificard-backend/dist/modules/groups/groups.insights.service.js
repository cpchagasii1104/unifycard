"use strict";
// src/modules/groups/groups.insights.service.ts
// SPRINT 3: INTEGRATED WITH UNIFY BANK
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsInsightsService = void 0;
const groups_repository_1 = require("./groups.repository");
const groups_service_1 = require("./groups.service");
const bank_integration_service_1 = require("../bank/bank-integration.service");
const memory_service_1 = require("@core/memory/memory.service");
class GroupsInsightsService {
    async getGroupInsights(tenantId, groupId) {
        const group = await groups_service_1.groupsService.getGroup(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const memberCount = members.length;
        // SPRINT 3: Buscar saldo do Unify Bank (fonte da verdade)
        const totalReceived = await bank_integration_service_1.bankIntegrationService.getGroupBalance(tenantId, groupId, 'BRL');
        // Buscar logs de participação do Memory (se método disponível)
        let participationLogs = [];
        try {
            if (typeof memory_service_1.memoryService.getContextsByUserId === 'function') {
                participationLogs = memory_service_1.memoryService.getContextsByUserId(groupId, 'group_participation') || [];
            }
        }
        catch (error) {
            console.error('Error getting participation logs from memory:', error);
        }
        // Gerar resumo via AI Kernel (placeholder)
        const aiSummary = await this.generateAISummary(tenantId, groupId, {
            name: group.name,
            memberCount,
            totalReceived,
        });
        return {
            groupId,
            name: group.name,
            totalReceived,
            memberCount,
            participationLogs: participationLogs.map((log) => ({
                action: log.action || 'unknown',
                timestamp: log.timestamp || new Date(),
                userId: log.userId || 'unknown',
            })),
            aiSummary,
        };
    }
    async generateAISummary(tenantId, groupId, data) {
        // TODO: Integrar com AI Kernel quando disponível
        // Por enquanto, retornar resumo simples
        return `Grupo ${data.name} com ${data.memberCount} membros. Total recebido: R$ ${data.totalReceived.toFixed(2)}`;
    }
}
exports.groupsInsightsService = new GroupsInsightsService();
