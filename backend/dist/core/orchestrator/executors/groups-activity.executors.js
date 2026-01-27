"use strict";
// src/core/orchestrator/executors/groups-activity.executors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onGroupFundReceived = onGroupFundReceived;
const ports_registry_1 = require("@core/social/ports-registry");
const groups_repository_1 = require("../../../modules/groups/groups.repository");
const memory_service_1 = require("@core/memory/memory.service");
const pool_1 = require("@core/database/pool");
const devLog_1 = require("@utils/devLog");
const idempotency_tracker_1 = require("@core/events/idempotency-tracker");
const canonical_logger_1 = require("@core/logging/canonical-logger");
/**
 * Handler para quando grupo recebe fundo via split
 * Cria auto-post econômico no feed do grupo
 *
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 * - Idempotência: replay não cria posts duplicados
 */
async function onGroupFundReceived(event) {
    // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
        canonical_logger_1.canonicalLogger.error(null, 'Evento rejeitado: tenantId ausente ou inválido', {
            eventType: event.type,
            eventId: event.eventId,
            tenantId: event.tenantId,
            timestamp: new Date().toISOString(),
        });
        throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for group.fund.received activity handler');
    }
    const { tenantId, payload } = event;
    const { groupId, amount, source, transactionId, assignmentId, jobId, workerUserId } = payload;
    // 🔴 IDEMPOTÊNCIA: Garantir que replay não cria posts duplicados
    await (0, idempotency_tracker_1.withIdempotency)(tenantId, event.eventId, event.type, 'groups.activity.onGroupFundReceived', payload, async () => {
        try {
            // Buscar informações do grupo
            const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
            if (!group) {
                devLog_1.devLog.warn('group.impact.group_not_found', { groupId, tenantId });
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
                    devLog_1.devLog.warn('group.impact.worker_name_fetch_failed', {
                        workerUserId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            // Formatar valor
            const amountFormatted = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
            }).format(amount);
            // Criar conteúdo do auto-post
            const content = `O grupo "${group.name}" recebeu ${amountFormatted} de impacto econômico! 🎉`;
            // Criar post automático diretamente no repository (sem passar fastify)
            const socialRepository = ports_registry_1.socialPortsRegistry.getSocialRepository();
            await socialRepository.create({
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
            devLog_1.devLog.success('group.impact.post_created', {
                groupId,
                groupName: group.name,
                amount,
                transactionId,
                tenantId,
            });
        }
        catch (error) {
            devLog_1.devLog.error('group.impact.post_failed', {
                groupId,
                tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error; // Re-throw para idempotency tracker registrar erro
        }
    });
}
