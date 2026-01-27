// src/modules/social/event-feed.handlers.ts
// Handlers para criar posts no feed social quando eventos são criados/publicados

import { eventBus } from '@core/events/event-bus';
import { SocialRepository } from './social.repository';
import { runQueryWithTenant } from '@core/database/pool';
import type { UnificardEvent } from '@core/events/event-bus';

const socialRepository = new SocialRepository();

/**
 * Cria post no feed quando evento é criado
 * 
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleEventCreated(event: UnificardEvent): Promise<void> {
  // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
  if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
    console.error('[EventFeedHandler] ❌ Evento rejeitado: tenantId ausente ou inválido', {
      eventType: event.type,
      eventId: event.eventId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
    });
    throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for event.created handler');
  }

  try {
    const { tenantId, payload } = event;
    
    // Extrair dados do evento
    const eventId = payload?.eventId || payload?.id;
    const actorId = payload?.actorId;
    const globalUserId = payload?.globalUserId || payload?.createdByGlobalUserId;
    const title = payload?.title;
    const description = payload?.description;
    const eventType = payload?.eventType;
    
    if (!eventId || !actorId || !globalUserId || !title) {
      console.warn('[EventFeedHandler] Dados incompletos para criar post de evento:', {
        eventId,
        actorId,
        globalUserId,
        title,
      });
      return;
    }

    // Buscar dados completos do evento
    const eventRow = await runQueryWithTenant<{
      id: string;
      title: string;
      description: string | null;
      event_type: string;
      actor_id: string;
      created_by_global_user_id: string | null;
      start_time: Date;
      end_time: Date;
      status: string;
    }>(
      tenantId,
      `
        SELECT id, title, description, event_type, actor_id, 
               created_by_global_user_id, start_time, end_time, status
        FROM events
        WHERE id = $1
        LIMIT 1
      `,
      [eventId]
    );

    if (!eventRow) {
      console.warn('[EventFeedHandler] Evento não encontrado:', eventId);
      return;
    }

    // Criar conteúdo do post
    const content = description 
      ? `${title}\n\n${description}`
      : title;

    // Criar post no feed com referência ao evento
    await socialRepository.create({
      tenantId,
      globalUserId: (eventRow.created_by_global_user_id || globalUserId) as string,
      content: content as string,
      type: 'event',
      visibility: 'PUBLIC',
      media: [],
      intent: 'event',
      confidence: null,
      categories: [],
      suggestedActions: [],
      metadata: {
        event_id: eventId,
        event_type: (eventType || eventRow.event_type) as string,
        actor_id: eventRow.actor_id,
        start_time: eventRow.start_time.toISOString(),
        end_time: eventRow.end_time.toISOString(),
        status: eventRow.status,
      },
      eventId: eventId as string,
    });

    console.log('[EventFeedHandler] Post criado no feed para evento:', eventId);
  } catch (error) {
    // Não quebra criação do evento se feed falhar
    console.error('[EventFeedHandler] Erro ao criar post no feed para evento:', error);
  }
}

/**
 * Cria/atualiza post no feed quando evento é publicado
 * 
 * 🔴 GARANTIA CANÔNICA: Event & Async Context Safety
 * - tenantId é obrigatório e validado antes de processar
 */
async function handleEventPublished(event: UnificardEvent): Promise<void> {
  // 🔴 GUARD CANÔNICO: Validar tenantId antes de processar
  if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
    console.error('[EventFeedHandler] ❌ Evento rejeitado: tenantId ausente ou inválido', {
      eventType: event.type,
      eventId: event.eventId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
    });
    throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for event.published handler');
  }

  try {
    const { tenantId, payload } = event;
    
    const eventId = payload?.eventId || payload?.id;
    
    if (!eventId) {
      console.warn('[EventFeedHandler] EventId não encontrado no payload:', payload);
      return;
    }

    // Verificar se já existe post para este evento
    const existingPost = await runQueryWithTenant<{ post_id: string }>(
      tenantId,
      `
        SELECT post_id
        FROM posts
        WHERE tenant_id = $1 AND event_id = $2
        LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (existingPost) {
      // Atualizar post existente para refletir status publicado
      await runQueryWithTenant(
        tenantId,
        `
          UPDATE posts
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{status}',
            '"PUBLISHED"'
          )
          WHERE post_id = $1
        `,
        [existingPost.post_id]
      );
      console.log('[EventFeedHandler] Post atualizado para evento publicado:', eventId);
    } else {
      // Se não existe post, criar um (pode acontecer se evento foi criado antes do handler)
      await handleEventCreated(event);
    }
  } catch (error) {
    console.error('[EventFeedHandler] Erro ao processar publicação de evento:', error);
  }
}

/**
 * Registra handlers de eventos para feed social
 */
export function registerEventFeedHandlers(): void {
  // Handler para evento criado
  eventBus.registerHandler('event.created', handleEventCreated);
  
  // Handler para evento publicado
  eventBus.registerHandler('event.published', handleEventPublished);
  
  console.log('[EventFeedHandler] Handlers de eventos registrados para feed social');
}














