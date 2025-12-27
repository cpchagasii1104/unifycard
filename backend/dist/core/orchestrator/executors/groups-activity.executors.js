"use strict";
// src/core/orchestrator/executors/groups-activity.executors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onGroupFundReceived = onGroupFundReceived;
const groups_repository_1 = require("../../../modules/groups/groups.repository");
const memory_service_1 = require("@core/memory/memory.service");
const social_repository_1 = require("../../../modules/social/social.repository");
const pool_1 = require("@core/database/pool");
/**
 * Handler para quando grupo recebe fundo via split
 * Cria auto-post econômico no feed do grupo
 */
async function onGroupFundReceived(event) {
    const { tenantId, payload } = event;
    const { groupId, amount, source, transactionId, assignmentId, jobId, workerUserId } = payload;
    try {
        // Buscar informações do grupo
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            console.warn(`Group ${groupId} not found for auto-post creation`);
            return;
        }
        // Buscar nome do worker (se disponível)
        let workerName = 'um membro';
        if (workerUserId) {
            try {
                // Buscar nome do usuário via global_users
                const userRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT full_name FROM global_users WHERE global_user_id = $1 LIMIT 1
          `, [workerUserId]);
                if (userRow && userRow.full_name) {
                    workerName = userRow.full_name;
                }
            }
            catch (error) {
                // Se não encontrar, usar placeholder
                console.warn('Could not fetch worker name:', error);
            }
        }
        // Criar conteúdo do auto-post
        const content = `O grupo ${group.name} recebeu R$ ${amount.toFixed(2)} graças à atividade de ${workerName}!`;
        // Criar post automático diretamente no repository (sem passar fastify)
        const socialRepo = new social_repository_1.SocialRepository();
        await socialRepo.create({
            tenantId,
            globalUserId: 'system', // Auto-post do sistema
            content,
            media: [],
            intent: 'economic_impact',
            confidence: 1.0,
            categories: [],
            suggestedActions: [],
            metadata: {
                groupId,
                splitAmount: amount,
                assignmentId,
                jobId,
                transactionId,
                source: 'economic_impact',
                type: 'system_auto_post',
                workerUserId,
            },
        });
        // Salvar no Memory
        await memory_service_1.memoryService.saveContext(`group_fund:${groupId}:${transactionId}`, {
            groupId,
            amount,
            source,
            transactionId,
            action: 'fund_received_auto_post',
        });
        console.log({
            tenantId,
            groupId,
            amount,
            transactionId,
            'social.action': 'auto_post_created',
            source: 'social_layer',
        }, 'Auto-post created for group fund received');
    }
    catch (error) {
        console.error({
            tenantId,
            groupId,
            err: error,
            'social.action': 'auto_post_error',
            source: 'social_layer',
        }, 'Error creating auto-post for group fund received');
    }
}
//# sourceMappingURL=groups-activity.executors.js.map