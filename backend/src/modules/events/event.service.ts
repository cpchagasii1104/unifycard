// backend/src/modules/events/event.service.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

import { eventRepository } from './event.repository';
import type { Event, CreateEventInput, EventFilters } from './event.types';

/**
 * Service para Eventos
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Evento ≠ Order
 * - Tudo explícito, auditável e declarativo
 */
class EventService {
  /**
   * Cria evento
   */
  async createEvent(
    tenantId: string,
    input: CreateEventInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<Event> {
    // Converter datas se necessário
    const startAt = input.startAt instanceof Date ? input.startAt : new Date(input.startAt);
    const endAt = input.endAt instanceof Date ? input.endAt : new Date(input.endAt);

    // Validar datas
    if (endAt <= startAt) {
      throw new Error('endAt deve ser posterior a startAt');
    }

    const event = await eventRepository.createEvent(tenantId, {
      organizerActorId: input.organizerActorId,
      title: input.title,
      description: input.description || null,
      locationActorId: input.locationActorId || null,
      startAt,
      endAt,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_CREATED',
      eventId: event.id,
      createdByActorId,
      createdByUserId,
    });

    return event;
  }

  /**
   * Publica evento
   * 
   * 🔴 CORREÇÃO: NÃO cria CalendarEvent (agenda paralela proibida)
   * Evento deve usar Unified Availability como fonte de verdade temporal
   */
  async publishEvent(
    tenantId: string,
    eventId: string,
    publishedByActorId: string,
    publishedByUserId?: string
  ): Promise<Event> {
    const event = await eventRepository.publishEvent(tenantId, eventId, publishedByActorId);

    // 🔴 CORREÇÃO: Removida criação de CalendarEvent (agenda paralela)
    // Evento deve usar Unified Availability como fonte de verdade temporal
    // A availability é criada/verificada no core/events/event.service.ts

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_PUBLISHED',
      eventId: event.id,
      publishedByActorId,
      publishedByUserId,
    });

    return event;
  }

  /**
   * Cancela evento
   */
  async cancelEvent(
    tenantId: string,
    eventId: string,
    cancelledByActorId: string,
    cancelledByUserId?: string,
    cancellationReason?: string
  ): Promise<Event> {
    const event = await eventRepository.cancelEvent(tenantId, eventId, cancelledByActorId, cancellationReason || null);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_CANCELLED',
      eventId: event.id,
      cancelledByActorId,
      cancelledByUserId,
      cancellationReason,
    });

    return event;
  }

  /**
   * Lista eventos
   */
  async listEvents(tenantId: string, filters: EventFilters = {}): Promise<Event[]> {
    return await eventRepository.listEvents(tenantId, filters);
  }

  /**
   * Busca evento por ID
   */
  async getEventById(tenantId: string, eventId: string): Promise<Event | null> {
    return await eventRepository.getEventById(tenantId, eventId);
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      eventId: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      publishedByActorId?: string;
      publishedByUserId?: string | null;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      cancellationReason?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.createdByActorId || data.publishedByActorId || data.cancelledByActorId || null,
        actor_type: 'user',
        source: 'events',
        context: {
          event_id: data.eventId,
          created_by_user_id: data.createdByUserId,
          published_by_actor_id: data.publishedByActorId,
          published_by_user_id: data.publishedByUserId,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId,
          cancellation_reason: data.cancellationReason,
        },
      });
    } catch (error) {
      console.warn('[Event] Erro ao registrar auditoria:', error);
    }
  }
}

export const eventService = new EventService();

