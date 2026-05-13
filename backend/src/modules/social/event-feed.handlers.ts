// src/modules/social/event-feed.handlers.ts
// Handlers para criar posts no feed social quando eventos são criados/publicados

import { eventBus } from '@core/events/event-bus';
import { runQueryWithTenant } from '@core/database/pool';
import type { UnificardEvent } from '@core/events/event-bus';

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

  const { tenantId, payload } = event;

  const eventId = payload?.eventId || payload?.id;
  const description = payload?.description;
  const eventType = payload?.eventType;

  if (!eventId) {
    console.warn('[EventFeedHandler] Dados incompletos para criar post de evento:', { eventId });
    return;
  }

  const eventRow = await runQueryWithTenant<{
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    actor_id: string;
    metadata: Record<string, unknown> | null;
    datetime_start: Date | null;
    datetime_end: Date | null;
    status: string;
  }>(
    tenantId,
    `
        SELECT id, title, description, event_type, actor_id, metadata,
               datetime_start, datetime_end, status
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

  // Resolver globalUserId (legacy audit field; armazenado em metadata) — não-bloqueante
  let globalUserId = (payload?.globalUserId || payload?.createdByGlobalUserId) as
    | string
    | undefined;
  const meta = eventRow.metadata ?? {};
  if (!globalUserId && typeof meta.created_by_global_user_id === 'string') {
    globalUserId = meta.created_by_global_user_id;
  }
  if (!globalUserId && eventRow.actor_id) {
    const link = await runQueryWithTenant<{ global_user_id: string | null }>(
      tenantId,
      `
        SELECT u.global_user_id::text AS global_user_id
        FROM actors a
        INNER JOIN users u ON u.user_id = a.user_id AND u.tenant_id = a.tenant_id
        WHERE a.id = $1 AND a.tenant_id = $2
        LIMIT 1
      `,
      [eventRow.actor_id, tenantId]
    );
    if (link?.global_user_id) {
      globalUserId = link.global_user_id;
    }
  }

  const title = (payload?.title ?? eventRow.title) as string | undefined;
  if (!eventRow.actor_id || !title) {
    console.warn('[EventFeedHandler] Dados incompletos para criar post de evento:', {
      eventId,
      actorId: eventRow.actor_id,
      title,
    });
    return;
  }

  const content = description ? `${title}\n\n${description}` : title;

  // INSERT canônico alinhado com migration soberana 20260530300000_social_posts.sql
  // Schema atual: id, tenant_id, actor_id (NOT NULL FK actors), content, post_type, intent,
  // intent_metadata JSONB, targeting JSONB, metadata JSONB. Drift do social.repository.create
  // (que espera schema antigo com global_user_id/type/visibility/media/etc.) é DT separada
  // — refactor completo de social.repository.ts cascateia em 20+ arquivos.
  await runQueryWithTenant(
    tenantId,
    `
      INSERT INTO posts (
        tenant_id, actor_id, content, post_type, intent, intent_metadata, metadata
      )
      VALUES ($1, $2, $3, 'system_auto_post', 'event', $4::jsonb, $5::jsonb)
    `,
    [
      tenantId,
      eventRow.actor_id,
      content as string,
      JSON.stringify({
        event_id: eventId,
        event_type: (eventType || eventRow.event_type) as string,
        datetime_start: eventRow.datetime_start?.toISOString() ?? null,
        datetime_end: eventRow.datetime_end?.toISOString() ?? null,
        status: eventRow.status,
      }),
      JSON.stringify({
        type: 'event',
        visibility: 'PUBLIC',
        ...(globalUserId && { created_by_global_user_id: globalUserId }),
      }),
    ]
  );

  console.log('[EventFeedHandler] Post criado no feed para evento:', eventId);
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

  const { tenantId, payload } = event;

  const eventId = payload?.eventId || payload?.id;

  if (!eventId) {
    console.warn('[EventFeedHandler] EventId não encontrado no payload:', payload);
    return;
  }

  // Schema canônico: posts.id (não post_id); event_id armazenado em intent_metadata
  // (alinhado com handleEventCreated acima após F11).
  const existingPost = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `
        SELECT id
        FROM posts
        WHERE tenant_id = $1 AND intent_metadata->>'event_id' = $2
        LIMIT 1
      `,
    [tenantId, eventId]
  );

  if (existingPost) {
    await runQueryWithTenant(
      tenantId,
      `
          UPDATE posts
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{status}',
            '"PUBLISHED"'
          )
          WHERE id = $1
        `,
      [existingPost.id]
    );
    console.log('[EventFeedHandler] Post atualizado para evento publicado:', eventId);
  } else {
    await handleEventCreated(event);
  }
}

// 🔴 HANDLER CANÔNICO: SERVICE_PAYMENT_EXECUTED → impact_ledger
// Bank emite → Impact observa (sem acoplamento direto)
// §7 LEI_COERENCIA_SISTEMICA_UNIFICARD
async function handleServicePaymentExecutedImpact(event: UnificardEvent): Promise<void> {
    try {
      const tenantId = event.tenantId ?? event.payload?.tenantId;
      const payerActorId = event.payload?.payerActorId ?? event.payload?.actorId;
      const paymentId = event.payload?.paymentId ?? event.payload?.executionId ?? event.payload?.id;
      const amountCents = (event.payload?.amountCents as number | undefined) ?? (event.payload?.totalAmountCents as number | undefined) ?? 0;

      if (!tenantId || !payerActorId || !paymentId) {
        console.warn('[impact] handleServicePaymentExecutedImpact: payload incompleto', event.payload);
        return;
      }

      const { impactService } = await import('./impact.service');
      const delta = Math.min(10, Math.round(amountCents / 1000));

      await impactService.recordImpact({
        tenantId: tenantId as string,
        actor: {
          actor_id: payerActorId as string,
          actor_type: (event.payload?.payerActorType as 'user' | 'page') ?? 'user',
        },
        eventType: 'SERVICE_PAYMENT_EXECUTED',
        delta,
        sourceType: 'service_payment',
        sourceId: paymentId as string,
        metadata: { amountCents },
      });
    } catch (err) {
      console.warn('[impact] handleServicePaymentExecutedImpact falhou:', err);
    }
  }

  /**
   * Registra handlers de eventos para feed social
   */
  export function registerEventFeedHandlers(): void {
    eventBus.registerHandler('event.created', 'social.event_feed.event_created', handleEventCreated);

    eventBus.registerHandler('event.published', 'social.event_feed.event_published', handleEventPublished);

    eventBus.registerHandler(
      'SERVICE_PAYMENT_EXECUTED',
      'social.impact.service_payment_executed',
      handleServicePaymentExecutedImpact
    );
  
  console.log('[EventFeedHandler] Handlers de eventos registrados para feed social');
}















