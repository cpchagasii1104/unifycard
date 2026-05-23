// src/core/orchestrator/executors/groups-activity.executors.ts

import { socialPortsRegistry } from '@core/social/ports-registry';
import { groupsRepository } from '../../../modules/groups/groups.repository';
import { memoryService } from '@core/memory/memory.service';
import { runQueryWithTenant } from '@core/database/pool';
import { withIdempotency } from '@core/events/idempotency-tracker';
import { canonicalLogger } from '@core/logging/canonical-logger';

/** 3.º segmento §4.12.1 — manter estável; reference_id no payload: transactionId. */
const ON_GROUP_FUND_RECEIVED_HANDLER = 'groups.activity.onGroupFundReceived';

/**
 * Handler para quando grupo recebe fundo via split
 * Cria auto-post econômico no feed do grupo
 * 
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 * - Idempotência: replay não cria posts duplicados
 */
export async function onGroupFundReceived(event: any): Promise<void> {
  // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
  if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
    canonicalLogger.error(null, 'Evento rejeitado: tenantId ausente ou inválido', {
      eventType: event.type,
      eventId: event.eventId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
    });
    throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for group.fund.received activity handler');
  }

  const { tenantId, payload } = event;
  const { groupId, amount, source, transactionId, assignmentId, jobId, workerUserId } = payload;

  // 🔴 IDEMPOTÊNCIA — §4.12.1: ex. group.fund.received:${transactionId}:groups.activity.onGroupFundReceived
  await withIdempotency(
    tenantId,
    event.eventId,
    event.type,
    ON_GROUP_FUND_RECEIVED_HANDLER,
    payload,
    async () => {

      try {
        // Buscar informações do grupo
        const group = await groupsRepository.findById(tenantId, groupId);
        if (!group) {
          console.warn('[groups-activity] group.impact.group_not_found', { groupId, tenantId });
          return;
        }

        // Buscar nome do worker (se disponível)
        let workerName = 'um membro';
        if (workerUserId) {
          try {
            // Buscar nome do usuário via global_users
            const userRow = await runQueryWithTenant<{ full_name: string | null }>(
              tenantId,
              `
              SELECT full_name FROM global_users WHERE global_user_id = $1 LIMIT 1
              `,
              [workerUserId]
            );
            if (userRow && userRow.full_name) {
              workerName = userRow.full_name;
            }
          } catch (error) {
            // Se não encontrar, usar placeholder
            console.warn('[groups-activity] group.impact.worker_name_fetch_failed', {
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
        const socialRepository = socialPortsRegistry.getSocialRepository();
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
        await memoryService.saveContext(`group_fund:${groupId}:${transactionId}`, {
          groupId,
          amount,
          source,
          transactionId,
          action: 'fund_received_auto_post',
        });

        console.log('[groups-activity] group.impact.post_created', {
          groupId,
          groupName: group.name,
          amount,
          transactionId,
          tenantId,
        });
      } catch (error) {
        console.error('[groups-activity] group.impact.post_failed', {
          groupId,
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw para idempotency tracker registrar erro
      }
    }
  );
}

