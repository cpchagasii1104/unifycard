// src/core/orchestrator/executors/groups.executors.ts

import { memoryService } from '@core/memory/memory.service';
import { eventBus } from '@core/events/event-bus';

/**
 * Executores para eventos de grupos
 * Salva contexto no Memory e envia para AI Kernel
 */

/**
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
export async function handleGroupCreated(event: any): Promise<void> {
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
  const { groupId, name, ownerActorId, ownerUserId } = payload;
  const ownerActorForMemory = ownerActorId ?? ownerUserId;

  // Salvar no Memory
  await memoryService.saveContext(`group_created:${groupId}`, {
    userId: ownerActorForMemory,
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
export async function handleGroupMemberJoined(event: any): Promise<void> {
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

/**
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
export async function handleGroupMemberLeft(event: any): Promise<void> {
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
  await memoryService.saveContext(`group_participation:${groupId}:${userId}`, {
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
export async function handleGroupFundReceived(event: any): Promise<void> {
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
// Por enquanto, eventos seguem pipeline outbox → worker; consumo via handlers registados no bus
// TODO: Implementar sistema de subscribers quando necessário
export function registerGroupEventHandlers(): void {
  // EventBus atual usa publish/subscribe pattern
  // Handlers podem ser registrados em outros lugares se necessário
  // Por enquanto, eventos são apenas publicados
}

