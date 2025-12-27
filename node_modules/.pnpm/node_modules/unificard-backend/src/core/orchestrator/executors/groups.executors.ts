// src/core/orchestrator/executors/groups.executors.ts

import { memoryService } from '@core/memory/memory.service';
import { eventBus } from '@core/events/event-bus';

/**
 * Executores para eventos de grupos
 * Salva contexto no Memory e envia para AI Kernel
 */

export async function handleGroupCreated(event: any): Promise<void> {
  const { tenantId, payload } = event;
  const { groupId, name, ownerUserId } = payload;

  // Salvar no Memory
  await memoryService.saveContext(`group_created:${groupId}`, {
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

export async function handleGroupMemberJoined(event: any): Promise<void> {
  const { tenantId, payload } = event;
  const { groupId, userId, role } = payload;

  // Salvar no Memory
  await memoryService.saveContext(`group_participation:${groupId}:${userId}`, {
    userId,
    contextType: 'group_participation',
    metadata: {
      groupId,
      action: 'joined',
      role,
    },
  });
}

export async function handleGroupMemberLeft(event: any): Promise<void> {
  const { tenantId, payload } = event;
  const { groupId, userId } = payload;

  // Salvar no Memory
  await memoryService.saveContext(`group_participation:${groupId}:${userId}`, {
    userId,
    contextType: 'group_participation',
    metadata: {
      groupId,
      action: 'left',
    },
  });
}

export async function handleGroupFundReceived(event: any): Promise<void> {
  const { tenantId, payload } = event;
  const { groupId, amount, source, transactionId } = payload;

  // Salvar no Memory
  await memoryService.saveContext(`group_fund:${groupId}:${transactionId}`, {
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
export function registerGroupEventHandlers(): void {
  // EventBus atual usa publish/subscribe pattern
  // Handlers podem ser registrados em outros lugares se necessário
  // Por enquanto, eventos são apenas publicados
}

