// src/core/profile/profile-education.service.ts
// Serviço para gerenciar eventos educacionais - MODELO 100% EVENT-BASED
// DOMÍNIO SEPARADO DO PROFISSIONAL
// Educação é TEMPORAL, DECLARATIVA e BASEADA EM EVENTOS APPEND-ONLY
// NÃO decide, NÃO filtra, NÃO bloqueia, NÃO gera score

import { runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import { identityService } from '../identity/identity.service';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from '../events/event-outbox.repository';
import type {
  EducationProfile,
  EducationEntry,
  EducationEvent,
  EducationEventType,
  CreateEducationEventInput,
} from './profile-education.types';
import { v4 as uuidv4 } from 'uuid';

class ProfileEducationService {
  /**
   * Cria um evento educacional (APPEND-ONLY)
   * Eventos são imutáveis e não podem ser alterados ou deletados
   */
  async createEducationEvent(
    tenantId: string,
    userId: string,
    input: CreateEducationEventInput
  ): Promise<EducationEvent> {
    // Buscar globalUserId e actorId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      throw new Error('Identidade do usuário não encontrada');
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar actor_id do usuário
    // 🔴 F-RLS-TENANT-CONTEXT: actors tem RLS+FORCE — tenant-context obrigatório.
    const { runQueryWithTenant } = await import('@core/database/pool');
    const actorRow = await runQueryWithTenant<{ actor_id: string }>(
      tenantId,
      `
      SELECT actor_id
      FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
      LIMIT 1
      `,
      [tenantId, userId]
    );

    if (!actorRow) {
      throw new Error('Actor não encontrado para o usuário');
    }

    const actorId = actorRow.actor_id;

    // Gerar educationId se não fornecido
    const educationId = input.payload.educationId || `edu-${uuidv4()}`;

    const eventType = input.eventType;
    const payload = {
      ...input.payload,
      educationId,
    };
    const metadata = {
      actorId,
      globalUserId,
      userId,
    };
    const createdAt = new Date();
    const eventId = outboxEventIdFromSeed(`${eventType}:${tenantId}:${educationId}`);

    const outboxClient = await getClientWithTenant(tenantId);
    try {
      await outboxClient.query('BEGIN');
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId,
        eventType,
        eventVersion: 1,
        payload,
        metadata,
      });
      await outboxClient.query('COMMIT');
    } catch (err) {
      await outboxClient.query('ROLLBACK');
      throw err;
    } finally {
      outboxClient.release();
    }

    return {
      eventId,
      tenantId,
      actorId,
      eventType: input.eventType,
      payload: payload as any,
      createdAt: createdAt.toISOString(),
      version: 1,
      metadata,
    };
  }

  /**
   * Lista eventos educacionais de um actor (APPEND-ONLY)
   */
  async listEducationEvents(
    tenantId: string,
    userId: string
  ): Promise<EducationEvent[]> {
    // Buscar globalUserId e actorId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      return [];
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar actor_id
    // 🔴 F-RLS-TENANT-CONTEXT: actors tem RLS+FORCE — tenant-context obrigatório.
    const { runQueryWithTenant } = await import('@core/database/pool');
    const actorRow = await runQueryWithTenant<{ actor_id: string }>(
      tenantId,
      `
      SELECT actor_id
      FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
      LIMIT 1
      `,
      [tenantId, userId]
    );

    if (!actorRow) {
      return [];
    }

    const actorId = actorRow.actor_id;

    // Buscar eventos educacionais do event_log
    const eventsRows = await runQueriesWithTenant<{
      event_id: string;
      event_type: string;
      event_version: number;
      payload: any;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT 
        event_id,
        event_type,
        event_version,
        payload,
        metadata,
        created_at
      FROM event_log
      WHERE tenant_id = $1
        AND event_type LIKE 'educacao.%'
        AND (metadata->>'actorId')::text = $2
      ORDER BY created_at DESC
      `,
      [tenantId, actorId]
    );

    return eventsRows.map((row) => ({
      eventId: row.event_id,
      tenantId,
      actorId,
      eventType: row.event_type as EducationEventType,
      payload: row.payload,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      version: row.event_version,
      metadata: row.metadata || {},
    }));
  }

  /**
   * Busca perfil educacional (READ-MODEL derivado dos eventos)
   * Projeção reconstruída a partir dos eventos educacionais
   */
  async getEducationProfile(
    tenantId: string,
    userId: string
  ): Promise<EducationProfile | null> {
    // Buscar globalUserId
    const identity = await identityService.getIdentityProfile(userId, tenantId);
    if (!identity || !identity.global.globalUserId) {
      return null;
    }

    const globalUserId = identity.global.globalUserId;

    // Buscar todos os eventos educacionais
    const events = await this.listEducationEvents(tenantId, userId);

    // Agrupar eventos por educationId e construir read-model
    const educationMap = new Map<string, EducationEntry>();

    for (const event of events) {
      const educationId = event.payload.educationId;
      
      if (!educationId) {
        continue;
      }

      // Buscar ou criar entrada
      let entry = educationMap.get(educationId);
      if (!entry) {
        entry = {
          educationId,
          type: event.payload.type,
          institution: event.payload.institution,
          course: event.payload.course,
          startDate: event.payload.startDate,
          endDate: event.payload.endDate ?? null,
          description: event.payload.description,
          currentStatus: event.eventType,
          events: [],
        };
        educationMap.set(educationId, entry);
      }

      // Atualizar campos do payload (eventos mais recentes sobrescrevem campos)
      if (event.payload.type) entry.type = event.payload.type;
      if (event.payload.institution !== undefined) entry.institution = event.payload.institution;
      if (event.payload.course !== undefined) entry.course = event.payload.course;
      if (event.payload.startDate !== undefined) entry.startDate = event.payload.startDate;
      if (event.payload.endDate !== undefined) entry.endDate = event.payload.endDate;
      if (event.payload.description !== undefined) entry.description = event.payload.description;

      // Atualizar status para o evento mais recente
      const existingEvent = entry.events?.find(e => e.eventType === event.eventType);
      if (!existingEvent || new Date(existingEvent.createdAt) < ((event.createdAt as unknown) instanceof Date ? (event.createdAt as unknown as Date) : new Date(event.createdAt as string))) {
        entry.currentStatus = event.eventType;
      }

      // Adicionar evento ao histórico
      if (entry.events) {
        entry.events.push({
          eventType: event.eventType,
          createdAt: (event.createdAt as unknown) instanceof Date ? (event.createdAt as unknown as Date).toISOString() : String(event.createdAt),
          metadata: event.metadata,
        });
      }
    }

    // Converter map para array
    const education: EducationEntry[] = Array.from(educationMap.values());

    return {
      globalUserId,
      education,
    };
  }
}

export const profileEducationService = new ProfileEducationService();

