// src/core/events/event.service.ts
// Service de eventos conforme CONTRATO DE EVENTOS v1
// FASE 4: BACKEND DOMAIN (EVENTS CORE)

import { runQueryWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import { eventModeratorService } from './event-moderator.service';
import type {
  Event,
  CreateEventInput,
  UpdateEventInput,
  EventType,
  EventStatus,
  EventVisibility,
  ActorType,
  ActorEventTypeValidation,
  ModerationResult,
  DeclareEventInput,
  EventDeclaration,
  EventTimeWindow,
  FlexibilityLevel,
} from './event.types';
import { ACTOR_EVENT_TYPE_MATRIX } from './event.types';
import { assertTransitionAllowed, enrichEventWithCanonicalFields } from './event.aggregate';
import { validateAspects } from './aspects/event-aspects.service';

interface EventRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  event_type: string;
  event_subtype: string | null;
  title: string;
  description: string | null;
  datetime_start: string;
  datetime_end: string;
  status: string;
  visibility: string;
  ticket_price_cents: number | null;
  max_attendees: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any> | null;
}

class EventService {
  /**
   * Converte EventRow para Event (com campos canônicos)
   */
  private toEvent(row: EventRow): Event {
    const event = {
      id: row.id,
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      actor_type: row.actor_type as ActorType,
      event_type: row.event_type as EventType,
      event_subtype: row.event_subtype,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      status: row.status as EventStatus,
      visibility: row.visibility as EventVisibility,
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      metadata: row.metadata || {},
    };
    
    // Enriquecer com campos canônicos (aliases)
    const enriched = enrichEventWithCanonicalFields({
      id: event.id,
      tenant_id: event.tenant_id,
      actor_id: event.actor_id,
      actor_type: event.actor_type,
      status: event.status,
      visibility: event.visibility,
      declaration: null, // Será preenchido se existir
      created_at: event.created_at,
      updated_at: event.updated_at,
    });
    
    return {
      ...event,
      responsible_actor_id: enriched.responsible_actor_id,
      responsible_actor_type: enriched.responsible_actor_type,
      declaration: enriched.declaration,
    };
  }

  /**
   * Valida Actor × EventType (CONTRATO v1 Seção 4)
   */
  validateActorEventType(
    actorType: ActorType,
    eventType: EventType
  ): ActorEventTypeValidation {
    const matrix = ACTOR_EVENT_TYPE_MATRIX[eventType];
    
    if (!matrix) {
      return {
        valid: false,
        reason: `Event type '${eventType}' não existe na taxonomia oficial`,
      };
    }

    // 🔴 BLINDAGEM: Suporte apenas para user e page por enquanto
    // group e channel retornam false (não habilitados)
    const allowed = actorType === 'user' ? matrix.user 
                   : actorType === 'page' ? matrix.page
                   : actorType === 'group' ? matrix.group
                   : matrix.channel;
    
    if (!allowed) {
      return {
        valid: false,
        reason: `Actor type '${actorType}' não pode criar eventos do tipo '${eventType}'`,
      };
    }

    return { valid: true };
  }

  /**
   * Valida status (CONTRATO v1)
   */
  private validateStatus(status: string): status is EventStatus {
    const validStatuses: EventStatus[] = ['draft', 'published', 'cancelled', 'completed', 'archived'];
    return validStatuses.includes(status as EventStatus);
  }

  /**
   * Valida visibility (CONTRATO v1)
   */
  private validateVisibility(visibility: string): visibility is EventVisibility {
    const validVisibilities: EventVisibility[] = ['public', 'group', 'followers', 'private', 'unlisted'];
    return validVisibilities.includes(visibility as EventVisibility);
  }

  /**
   * Valida event_type (CONTRATO v1 Seção 3)
   */
  private validateEventType(eventType: string): eventType is EventType {
    const validTypes: EventType[] = [
      'cultural',
      'gastronomic',
      'social',
      'professional',
      'community',
      'spiritual',
      'sports',
      'private',
    ];
    return validTypes.includes(eventType as EventType);
  }

  /**
   * Cria um novo evento (CONTRATO v1)
   */
  async createEvent(
    tenantId: string,
    input: CreateEventInput
  ): Promise<Event> {
    // 1. Validar Actor × EventType
    const actorValidation = this.validateActorEventType(input.actor_type, input.event_type);
    if (!actorValidation.valid) {
      throw new BadRequestError(actorValidation.reason || 'Validação Actor × EventType falhou');
    }

    // 2. Validar event_type
    if (!this.validateEventType(input.event_type)) {
      throw new BadRequestError(`Event type '${input.event_type}' não é válido`);
    }

    // 3. Validar datas (FASE 5: apenas se AMBAS forem fornecidas)
    // ETAPA 0 não requer datas - serão definidas em ETAPA 3
    if (input.datetime_start && input.datetime_end) {
      const startDate = new Date(input.datetime_start);
      const endDate = new Date(input.datetime_end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestError('Datas inválidas');
      }

      if (endDate <= startDate) {
        throw new BadRequestError('datetime_end deve ser posterior a datetime_start');
      }
    }

    // 4. Validar ticket_price_cents (se fornecido)
    if (input.ticket_price_cents !== undefined && input.ticket_price_cents !== null) {
      if (input.ticket_price_cents < 0) {
        throw new BadRequestError('ticket_price_cents não pode ser negativo');
      }
    }

    // 5. Validar max_attendees (se fornecido)
    if (input.max_attendees !== undefined && input.max_attendees !== null) {
      if (input.max_attendees <= 0) {
        throw new BadRequestError('max_attendees deve ser maior que zero');
      }
    }

    // 6. Moderação (CONTRATO v1 Seção 7)
    const moderation = await eventModeratorService.moderate(input.title, input.description);
    if (moderation.decision === 'rejected') {
      throw new BadRequestError(`Evento rejeitado pela moderação: ${moderation.reason || 'Conteúdo não permitido'}`);
    }

    // 7. Validar que actor existe
    const actor = await runQueryWithTenant<{ actor_id: string }>(
      tenantId,
      `
      SELECT actor_id
      FROM actors
      WHERE tenant_id = $1
        AND actor_id = $2
        AND actor_type = $3
      LIMIT 1
      `,
      [tenantId, input.actor_id, input.actor_type]
    );

    if (!actor) {
      throw new BadRequestError(`Actor '${input.actor_id}' (${input.actor_type}) não encontrado`);
    }

    // 8. Criar evento
    const visibility = input.visibility || 'public';
    // FASE 5: datetime_start e datetime_end são opcionais (ETAPA 0 não requer datas)
    const datetimeStart = input.datetime_start || null;
    const datetimeEnd = input.datetime_end || null;
    
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      INSERT INTO events (
        tenant_id,
        actor_id,
        actor_type,
        event_type,
        event_subtype,
        title,
        description,
        datetime_start,
        datetime_end,
        status,
        visibility,
        ticket_price_cents,
        max_attendees,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        tenantId,
        input.actor_id,
        input.actor_type,
        input.event_type,
        input.event_subtype || null,
        input.title,
        input.description || null,
        datetimeStart,
        datetimeEnd,
        'draft', // Sempre começa como draft
        visibility,
        input.ticket_price_cents || null,
        input.max_attendees || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar evento');
    }

    const event = this.toEvent(row);

    // 9. 🔴 FASE 1: NÃO criar availability na Unified Availability
    // Bloqueado nesta fase conforme EVENT_DOMAIN_MINIMUM_CONTRACT
    // Evento mínimo não escreve na Agenda Universal
    // TODO FASE 3: Integração read-only com Agenda Universal

    // Log estruturado: evento criado
    // Nota: Log em routes.ts já cobre isso, mas mantemos aqui para consistência

    return event;
  }

  /**
   * Atualiza um evento existente
   */
  async updateEvent(
    tenantId: string,
    eventId: string,
    input: UpdateEventInput,
    actorId: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão (criador ou owner/admin do grupo)
    if (event.actor_id !== actorId) {
      // Verificar se evento pertence a grupo e se usuário é owner/admin
      const groupEvent = await runQueryWithTenant<{ group_id: string }>(
        tenantId,
        `SELECT group_id FROM group_events WHERE event_id = $1 AND tenant_id = $2 LIMIT 1`,
        [eventId, tenantId]
      );
      if (groupEvent) {
        // Buscar user_id do actor
        const actor = await runQueryWithTenant<{ user_id: string }>(
          tenantId,
          `SELECT user_id FROM actors WHERE actor_id = $1 AND tenant_id = $2 AND actor_type = 'user' LIMIT 1`,
          [actorId, tenantId]
        );
        if (actor?.user_id) {
          const { groupsPortsRegistry } = await import('@core/groups/ports-registry');
          const groupsRepository = groupsPortsRegistry.getGroupsRepository();
          const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupEvent.group_id, actor.user_id);
          if (!isAdmin) {
            throw new ForbiddenError('Apenas o criador do evento ou owner/admin do grupo podem atualizá-lo');
          }
        } else {
          throw new ForbiddenError('Apenas o criador do evento ou owner/admin do grupo podem atualizá-lo');
        }
      } else {
        throw new ForbiddenError('Apenas o criador do evento pode atualizá-lo');
      }
    }

    // 3. Validar que não está cancelado/finalizado
    if (event.status === 'cancelled' || event.status === 'completed' || event.status === 'archived') {
      throw new BadRequestError(`Evento com status '${event.status}' não pode ser editado`);
    }

    // 4. Validar que não está publicado (ou permitir atualização de campos específicos)
    if (event.status === 'published') {
      // Permitir atualização apenas de campos específicos quando publicado
      const allowedFields = ['description', 'max_attendees', 'metadata'];
      const hasDisallowedFields = Object.keys(input).some(
        key => !allowedFields.includes(key)
      );
      
      if (hasDisallowedFields) {
        throw new BadRequestError(`Evento ${event.status} não pode ter campos alterados (exceto: ${allowedFields.join(', ')})`);
      }
    }

    // 5. Validar datas (se fornecidas)
    if (input.datetime_start || input.datetime_end) {
      const startDate = input.datetime_start ? new Date(input.datetime_start) : new Date(event.datetime_start);
      const endDate = input.datetime_end ? new Date(input.datetime_end) : new Date(event.datetime_end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestError('Datas inválidas');
      }

      if (endDate <= startDate) {
        throw new BadRequestError('datetime_end deve ser posterior a datetime_start');
      }
    }

    // 6. Validar ticket_price_cents (se fornecido)
    if (input.ticket_price_cents !== undefined && input.ticket_price_cents !== null) {
      if (input.ticket_price_cents < 0) {
        throw new BadRequestError('ticket_price_cents não pode ser negativo');
      }
    }

    // 7. Validar max_attendees (se fornecido)
    if (input.max_attendees !== undefined && input.max_attendees !== null) {
      if (input.max_attendees <= 0) {
        throw new BadRequestError('max_attendees deve ser maior que zero');
      }
    }

    // 7. Moderação (se título ou descrição mudaram)
    if (input.title || input.description !== undefined) {
      const title = input.title || event.title;
      const description = input.description !== undefined ? input.description : event.description;
      
      const moderation = await eventModeratorService.moderate(title, description);
      if (moderation.decision === 'rejected') {
        throw new BadRequestError(`Evento rejeitado pela moderação: ${moderation.reason || 'Conteúdo não permitido'}`);
      }
    }

    // 8. Construir UPDATE dinâmico
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.datetime_start !== undefined) {
      updates.push(`datetime_start = $${paramIndex++}`);
      values.push(input.datetime_start);
    }

    if (input.datetime_end !== undefined) {
      updates.push(`datetime_end = $${paramIndex++}`);
      values.push(input.datetime_end);
    }

    if (input.event_subtype !== undefined) {
      updates.push(`event_subtype = $${paramIndex++}`);
      values.push(input.event_subtype);
    }

    if (input.visibility !== undefined) {
      if (!this.validateVisibility(input.visibility)) {
        throw new BadRequestError(`Visibility '${input.visibility}' não é válido`);
      }
      updates.push(`visibility = $${paramIndex++}`);
      values.push(input.visibility);
    }

    if (input.ticket_price_cents !== undefined) {
      updates.push(`ticket_price_cents = $${paramIndex++}`);
      values.push(input.ticket_price_cents);
    }

    if (input.max_attendees !== undefined) {
      updates.push(`max_attendees = $${paramIndex++}`);
      values.push(input.max_attendees);
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      return event; // Nada para atualizar
    }

    // Adicionar updated_at
    updates.push(`updated_at = NOW()`);

    // Adicionar parâmetros finais
    values.push(tenantId, eventId);

    // 9. Executar UPDATE
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET ${updates.join(', ')}
      WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex++}
      RETURNING *
      `,
      values
    );

    if (!row) {
      throw new Error('Falha ao atualizar evento');
    }

    return this.toEvent(row);
  }

  /**
   * Cria um evento em draft (status draft)
   * EVENT_DOMAIN_MINIMUM_CONTRACT: Sem efeitos externos
   */
  async createDraftEvent(
    tenantId: string,
    input: CreateEventInput
  ): Promise<Event> {
    // Usar createEvent existente, que já cria em draft
    // Mas garantir que não há efeitos externos nesta fase
    return this.createEvent(tenantId, input);
  }

  /**
   * Declara um evento (muda status de draft para declared)
   * EVENT_DOMAIN_MINIMUM_CONTRACT: Salva declaration completa
   * 
   * 🔴 DISTINÇÃO CANÔNICA: EventSpec vs EventDeclaration
   * 
   * EventSpec:
   * - É snapshot imutável de questionário declarativo
   * - Armazenado em event_specs (tabela separada)
   * - Pode gerar EventDeclaration, mas são entidades distintas
   * - NÃO decide nada
   * - EventSpec.answers.event_date pode ser date_or_window como resposta de questionário
   * 
   * EventDeclaration:
   * - É subdocumento do agregado Event
   * - Armazenado em events.metadata.declaration (JSONB)
   * - Expressa intenção do evento declarado
   * - NÃO decide nada
   * - EventDeclaration.desired_time_windows é declaração estruturada do agregado Event
   * 
   * TIME WINDOWS (FASE 3):
   * - EventSpec pode conter date_or_window como resposta de questionário (snapshot imutável)
   * - EventDeclaration.desired_time_windows é declaração estruturada (metadata.declaration)
   * - Um pode gerar o outro por ação explícita (sem automação "inteligente")
   * - Nenhum deles decide, apenas declara
   * 
   * Nenhuma delas executa ações ou cria regras de negócio.
   */
  async declareEvent(
    tenantId: string,
    eventId: string,
    declarationInput: DeclareEventInput,
    actorId: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão
    if (event.actor_id !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode declará-lo');
    }

    // 3. Validar transição via aggregate
    assertTransitionAllowed(event.status, 'declared');

    // 4. 🔴 VALIDAÇÃO OBRIGATÓRIA: event_aspects é obrigatório e NÃO pode ser inferido
    if (!declarationInput.event_aspects || declarationInput.event_aspects.length === 0) {
      throw new BadRequestError(
        'event_aspects é obrigatório e deve vir do vocabulário fechado. ' +
        'Não é possível inferir aspectos automaticamente.'
      );
    }

    // 5. Validar event_aspects contra vocabulário fechado
    const aspectsValidation = validateAspects(declarationInput.event_aspects);

    // 6. Validar visibility como declaração (apenas checar se é valor permitido)
    if (!this.validateVisibility(declarationInput.visibility)) {
      throw new BadRequestError(`Visibility '${declarationInput.visibility}' não é válido`);
    }

    // 7. Validar intent_flags contra allowlist (se fornecido)
    const validIntentFlags = ['wants_services', 'wants_voting', 'wants_ticketing'];
    if (declarationInput.intent_flags && declarationInput.intent_flags.length > 0) {
      const invalidFlags = declarationInput.intent_flags.filter(
        flag => !validIntentFlags.includes(flag)
      );
      if (invalidFlags.length > 0) {
        throw new BadRequestError(
          `Intent flags inválidos: ${invalidFlags.join(', ')}. ` +
          `Flags válidos: ${validIntentFlags.join(', ')}`
        );
      }
    }

    // 8. 🔴 FASE 3: Validar desired_time_windows (APENAS FORMA, NÃO DECISÃO)
    // NUNCA inferir, NUNCA completar, NUNCA ajustar, NUNCA corrigir
    let normalizedTimeWindows: EventTimeWindow[] | undefined;
    if (declarationInput.desired_time_windows !== undefined) {
      // Array pode ser vazio (permitido)
      normalizedTimeWindows = [];
      
      for (const window of declarationInput.desired_time_windows) {
        // Validação de FORMA apenas:
        // - start_datetime e end_datetime obrigatórios
        // - start < end
        // - timezone opcional, mas se fornecido deve ser string não-vazia
        
        if (!window.start_datetime || !window.end_datetime) {
          throw new BadRequestError('Cada janela de tempo deve ter start_datetime e end_datetime');
        }
        
        const startDate = new Date(window.start_datetime);
        const endDate = new Date(window.end_datetime);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new BadRequestError('Datas inválidas na janela de tempo');
        }
        
        if (endDate <= startDate) {
          throw new BadRequestError('end_datetime deve ser posterior a start_datetime na janela de tempo');
        }
        
        if (window.timezone !== undefined && (!window.timezone || window.timezone.trim() === '')) {
          throw new BadRequestError('timezone não pode ser string vazia se fornecido');
        }
        
        // Normalização mecânica apenas: trim de timezone se fornecido
        normalizedTimeWindows.push({
          start_datetime: window.start_datetime, // ISO já validado
          end_datetime: window.end_datetime, // ISO já validado
          timezone: window.timezone?.trim() || undefined,
        });
      }
    }

    // 9. Validar flexibility_level (se fornecido)
    const validFlexibilityLevels: FlexibilityLevel[] = ['strict', 'flexible', 'very_flexible'];
    if (declarationInput.flexibility_level !== undefined) {
      if (!validFlexibilityLevels.includes(declarationInput.flexibility_level)) {
        throw new BadRequestError(
          `Flexibility level '${declarationInput.flexibility_level}' não é válido. ` +
          `Valores válidos: ${validFlexibilityLevels.join(', ')}`
        );
      }
    }

    // 10. Construir EventDeclaration completa
    const declaration: EventDeclaration = {
      title: declarationInput.title,
      description: declarationInput.description || null,
      event_aspects: aspectsValidation.normalized, // Normalizado e validado
      aspects_version: aspectsValidation.version, // Versão do vocabulário
      visibility: declarationInput.visibility, // Validado
      intent_flags: declarationInput.intent_flags || [], // Validado contra allowlist
      declared_at: new Date().toISOString(),
      
      // FASE 3: Declared Time Windows (sem inferência)
      desired_time_windows: normalizedTimeWindows, // Pode ser undefined ou array vazio
      flexibility_level: declarationInput.flexibility_level, // Opcional
      timezone: declarationInput.timezone?.trim() || undefined, // Opcional, normalizado
    };

    // 11. Persistir declaration completa em metadata.declaration (JSONB)
    // NÃO criar tabela nova
    const metadata = event.metadata || {};
    metadata.declaration = {
      title: declaration.title,
      description: declaration.description,
      event_aspects: declaration.event_aspects,
      aspects_version: declaration.aspects_version,
      visibility: declaration.visibility,
      intent_flags: declaration.intent_flags,
      declared_at: declaration.declared_at,
      
      // FASE 3: Persistir time windows (se fornecidos)
      ...(declaration.desired_time_windows !== undefined && {
        desired_time_windows: declaration.desired_time_windows,
      }),
      ...(declaration.flexibility_level !== undefined && {
        flexibility_level: declaration.flexibility_level,
      }),
      ...(declaration.timezone !== undefined && {
        timezone: declaration.timezone,
      }),
    };

    // 10. Atualizar evento: status + campos da declaration
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET 
        status = 'declared',
        title = $1,
        description = $2,
        visibility = $3,
        metadata = $4,
        updated_at = NOW()
      WHERE tenant_id = $5 AND id = $6
      RETURNING *
      `,
      [
        declaration.title,
        declaration.description,
        declaration.visibility,
        JSON.stringify(metadata),
        tenantId,
        eventId,
      ]
    );

    if (!row) {
      throw new Error('Falha ao declarar evento');
    }

    const updatedEvent = this.toEvent(row);
    // Adicionar declaration ao evento retornado
    updatedEvent.declaration = declaration;
    return updatedEvent;
  }

  /**
   * Publica um evento (muda status de declared para published)
   * EVENT_DOMAIN_MINIMUM_CONTRACT: Sem economia, sem agenda write
   */
  async publishEvent(
    tenantId: string,
    eventId: string,
    actorId: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão
    if (event.actor_id !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode publicá-lo');
    }

    // 3. Validar transição via aggregate
    assertTransitionAllowed(event.status, 'published');

    // 4. 🔴 FASE 1: NÃO validar economia
    // Bloqueado nesta fase conforme EVENT_DOMAIN_MINIMUM_CONTRACT
    // TODO FASE 2: Validação de economia quando necessário

    // 5. 🔴 FASE 1: NÃO criar/verificar availability
    // Bloqueado nesta fase conforme EVENT_DOMAIN_MINIMUM_CONTRACT
    // TODO FASE 3: Integração read-only com Agenda Universal

    // 6. Atualizar status
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET status = 'published', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
      `,
      [tenantId, eventId]
    );

    if (!row) {
      throw new Error('Falha ao publicar evento');
    }

    return this.toEvent(row);
  }

  /**
   * Ativa um evento (muda status de published para active)
   * EVENT_DOMAIN_MINIMUM_CONTRACT: Sem efeitos externos
   */
  async activateEvent(
    tenantId: string,
    eventId: string,
    actorId: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão
    if (event.actor_id !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode ativá-lo');
    }

    // 3. Validar transição via aggregate
    assertTransitionAllowed(event.status, 'active');

    // 4. Atualizar status
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET status = 'active', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
      `,
      [tenantId, eventId]
    );

    if (!row) {
      throw new Error('Falha ao ativar evento');
    }

    return this.toEvent(row);
  }

  /**
   * Encerra um evento (muda status de active para ended)
   * EVENT_DOMAIN_MINIMUM_CONTRACT: Sem efeitos externos
   */
  async endEvent(
    tenantId: string,
    eventId: string,
    actorId: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão
    if (event.actor_id !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode encerrá-lo');
    }

    // 3. Validar transição via aggregate
    assertTransitionAllowed(event.status, 'ended');

    // 4. Atualizar status
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET status = 'ended', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
      `,
      [tenantId, eventId]
    );

    if (!row) {
      throw new Error('Falha ao encerrar evento');
    }

    return this.toEvent(row);
  }

  /**
   * Cancela um evento (muda status para cancelled)
   * EVENT_DOMAIN_MINIMUM_CONTRACT: Não pode cancelar ended
   */
  async cancelEvent(
    tenantId: string,
    eventId: string,
    actorId: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão (criador ou owner/admin do grupo)
    if (event.actor_id !== actorId) {
      // Verificar se evento pertence a grupo e se usuário é owner/admin
      const groupEvent = await runQueryWithTenant<{ group_id: string }>(
        tenantId,
        `SELECT group_id FROM group_events WHERE event_id = $1 AND tenant_id = $2 LIMIT 1`,
        [eventId, tenantId]
      );
      if (groupEvent) {
        // Buscar user_id do actor
        const actor = await runQueryWithTenant<{ user_id: string }>(
          tenantId,
          `SELECT user_id FROM actors WHERE actor_id = $1 AND tenant_id = $2 AND actor_type = 'user' LIMIT 1`,
          [actorId, tenantId]
        );
        if (actor?.user_id) {
          const { groupsPortsRegistry } = await import('@core/groups/ports-registry');
          const groupsRepository = groupsPortsRegistry.getGroupsRepository();
          const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupEvent.group_id, actor.user_id);
          if (!isAdmin) {
            throw new ForbiddenError('Apenas o criador do evento ou owner/admin do grupo podem cancelá-lo');
          }
        } else {
          throw new ForbiddenError('Apenas o criador do evento ou owner/admin do grupo podem cancelá-lo');
        }
      } else {
        throw new ForbiddenError('Apenas o criador do evento pode cancelá-lo');
      }
    }

    // 3. Validar transição via aggregate (não pode cancelar ended)
    assertTransitionAllowed(event.status, 'cancelled');

    // 4. Atualizar status
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET status = 'cancelled', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *
      `,
      [tenantId, eventId]
    );

    if (!row) {
      throw new Error('Falha ao cancelar evento');
    }

    return this.toEvent(row);
  }

  /**
   * Consulta disponibilidade do evento na Agenda Universal (READ-ONLY)
   * EVENT_DOMAIN_MINIMUM_CONTRACT FASE 2: Integração read-only
   * 
   * Exposição de informação apenas, sem decisão, sem escrita, sem reserva.
   */
  async getEventAvailability(
    tenantId: string,
    eventId: string,
    query?: {
      datetime_start?: string;
      datetime_end?: string;
      location_context?: {
        city_id?: string;
      };
    }
  ): Promise<{
    available: boolean;
    conflicts: Array<{
      availability_id: string;
      start_datetime: string;
      end_datetime: string;
      owner_type: string;
      owner_id: string;
    }>;
    notes: string;
  }> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Usar janela do evento ou query fornecida
    // FASE 5: datetime_start e datetime_end podem ser opcionais (ETAPA 0)
    const startDatetime = query?.datetime_start || event.datetime_start;
    const endDatetime = query?.datetime_end || event.datetime_end;
    
    // Se não houver datas no evento nem na query, retornar informação parcial
    if (!startDatetime || !endDatetime) {
      return {
        available: false,
        conflicts: [],
        notes: 'Evento não possui datas definidas. Defina datetime_start e datetime_end para consultar disponibilidade.',
      };
    }

    // 3. Consultar Agenda Universal (READ-ONLY)
    // SOMENTE métodos de consulta, NUNCA criar availability
    try {
      const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
      const { AvailabilityOwnerType } = await import('@core/availability/unified-availability.types');

      // Consultar disponibilidades do evento (se existirem)
      const eventAvailabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
        ownerType: AvailabilityOwnerType.EVENT,
        ownerId: eventId,
      });

      // Consultar disponibilidades do responsible_actor (se necessário)
      const actorAvailabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
        ownerType: event.actor_type === 'user' ? AvailabilityOwnerType.USER : AvailabilityOwnerType.PAGE,
        ownerId: event.actor_id,
      });

      // 4. Detectar conflitos (informacional apenas)
      const conflicts: Array<{
        availability_id: string;
        start_datetime: string;
        end_datetime: string;
        owner_type: string;
        owner_id: string;
      }> = [];

      // Verificar sobreposições com outras disponibilidades do actor
      const eventStart = new Date(startDatetime);
      const eventEnd = new Date(endDatetime);

      for (const availability of actorAvailabilities) {
        const availStart = new Date(availability.startDatetime);
        const availEnd = new Date(availability.endDatetime);

        // Detectar sobreposição (informacional apenas)
        if (
          (eventStart >= availStart && eventStart < availEnd) ||
          (eventEnd > availStart && eventEnd <= availEnd) ||
          (eventStart <= availStart && eventEnd >= availEnd)
        ) {
          conflicts.push({
            availability_id: availability.id,
            start_datetime: availability.startDatetime,
            end_datetime: availability.endDatetime,
            owner_type: availability.ownerType,
            owner_id: availability.ownerId,
          });
        }
      }

      // 5. Determinar disponibilidade (informacional)
      // Se não houver conflitos, considerar disponível
      const available = conflicts.length === 0;

      return {
        available,
        conflicts,
        notes: 'Informação apenas. Não altera estado do evento ou agenda.',
      };
    } catch (error) {
      // Se houver erro na consulta, retornar informação parcial
      return {
        available: false,
        conflicts: [],
        notes: `Erro ao consultar agenda: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Availability Rich Query por event_id (READ-ONLY, INFORMACIONAL)
   * EVENT_DOMAIN_MINIMUM_CONTRACT FASE 3
   * 
   * Analisa disponibilidade para cada janela declarada usando Agenda Universal.
   * Sem escrita. Sem mudança de estado. Apenas informação.
   * 
   * 🔴 INFORMACIONAL: Score e disponibilidade são apenas informação, não decisão.
   */
  async getEventAvailabilityRich(
    tenantId: string,
    eventId: string
  ): Promise<{
    status: 'insufficient_declaration' | 'analyzed';
    windows: Array<{
      window: EventTimeWindow;
      available: boolean; // Informacional: derivado de conflitos
      conflicts: Array<{
        availability_id: string;
        start_datetime: string;
        end_datetime: string;
        owner_type: string;
        owner_id: string;
      }>;
      availability_summary: {
        total_availabilities: number;
        available_slots: number;
      };
      score?: number; // Opcional, determinístico, informacional (0-100)
    }>;
    notes: string;
  }> {
    // 1. Buscar evento e declaration
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Verificar se há desired_time_windows
    if (!event.declaration?.desired_time_windows || event.declaration.desired_time_windows.length === 0) {
      return {
        status: 'insufficient_declaration',
        windows: [],
        notes: 'Evento não possui janelas de tempo declaradas. Adicione desired_time_windows na declaration.',
      };
    }

    // 3. Consultar Agenda Universal (READ-ONLY)
    // SOMENTE métodos de consulta, NUNCA criar/atualizar
    try {
      const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
      const { AvailabilityOwnerType } = await import('@core/availability/unified-availability.types');

      const analyzedWindows: Array<{
        window: EventTimeWindow;
        available: boolean;
        conflicts: Array<{
          availability_id: string;
          start_datetime: string;
          end_datetime: string;
          owner_type: string;
          owner_id: string;
        }>;
        availability_summary: {
          total_availabilities: number;
          available_slots: number;
        };
        score?: number;
      }> = [];

      // 4. Para cada janela declarada, analisar disponibilidade
      for (const window of event.declaration.desired_time_windows) {
        const windowStart = new Date(window.start_datetime);
        const windowEnd = new Date(window.end_datetime);

        // 4.1. Consultar disponibilidades do responsible_actor (READ-ONLY)
        const actorAvailabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
          ownerType: event.actor_type === 'user' ? AvailabilityOwnerType.USER : AvailabilityOwnerType.PAGE,
          ownerId: event.actor_id,
        });

        // 4.2. Consultar disponibilidades do evento (se existirem) (READ-ONLY)
        const eventAvailabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
          ownerType: AvailabilityOwnerType.EVENT,
          ownerId: eventId,
        });

        // 4.3. Detectar conflitos (informacional apenas)
        const conflicts: Array<{
          availability_id: string;
          start_datetime: string;
          end_datetime: string;
          owner_type: string;
          owner_id: string;
        }> = [];

        // Verificar sobreposições com disponibilidades do actor
        for (const availability of actorAvailabilities) {
          const availStart = new Date(availability.startDatetime);
          const availEnd = new Date(availability.endDatetime);

          // Detectar sobreposição (informacional)
          if (
            (windowStart >= availStart && windowStart < availEnd) ||
            (windowEnd > availStart && windowEnd <= availEnd) ||
            (windowStart <= availStart && windowEnd >= availEnd)
          ) {
            conflicts.push({
              availability_id: availability.id,
              start_datetime: availability.startDatetime.toISOString(),
              end_datetime: availability.endDatetime.toISOString(),
              owner_type: availability.ownerType,
              owner_id: availability.ownerId,
            });
          }
        }

        // 4.4. Calcular disponibilidade informacional
        const available = conflicts.length === 0;

        // 4.5. Calcular summary
        const totalAvailabilities = actorAvailabilities.length + eventAvailabilities.length;
        const availableSlots = totalAvailabilities - conflicts.length;

        // 4.6. Calcular score informacional (determinístico, 0-100)
        // Score baseado em:
        // - Sem conflitos = 100
        // - Com conflitos = reduzido proporcionalmente
        // - Alta disponibilidade = bonus
        let score: number | undefined;
        if (conflicts.length === 0) {
          score = 100;
        } else {
          // Reduzir score baseado em proporção de conflitos
          const conflictRatio = conflicts.length / Math.max(totalAvailabilities, 1);
          score = Math.max(0, Math.round(100 * (1 - conflictRatio)));
        }

        analyzedWindows.push({
          window,
          available,
          conflicts,
          availability_summary: {
            total_availabilities: totalAvailabilities,
            available_slots: availableSlots,
          },
          score,
        });
      }

      return {
        status: 'analyzed',
        windows: analyzedWindows,
        notes: 'Análise informacional apenas. Não altera estado do evento ou agenda.',
      };
    } catch (error) {
      // Se houver erro na consulta, retornar informação parcial
      return {
        status: 'analyzed',
        windows: [],
        notes: `Erro ao consultar agenda: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Busca um evento por ID
   */
  async getEvent(tenantId: string, eventId: string): Promise<Event | null> {
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      SELECT 
        id,
        tenant_id,
        actor_id,
        actor_type,
        event_type,
        event_subtype,
        title,
        description,
        datetime_start,
        datetime_end,
        status,
        visibility,
        ticket_price_cents,
        max_attendees,
        completed_at,
        created_at,
        updated_at,
        metadata
      FROM events
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    if (!row) {
      return null;
    }

    const event = this.toEvent(row);
    
    // Recuperar declaration do metadata se existir
    // 🔴 REGRA CANÔNICA: Recuperar mesmo se declared_at for null (draft)
    // Time windows podem existir em draft sem declaration completa
    if (row.metadata && typeof row.metadata === 'object' && 'declaration' in row.metadata) {
      const decl = row.metadata.declaration as any;
      if (decl) {
        // Se tem declared_at, é declaration completa
        // Se não tem declared_at mas tem campos, é declaration parcial (draft)
        const isCompleteDeclaration = decl.declared_at !== null && decl.declared_at !== undefined;
        
        // Construir declaration (pode ser parcial em draft)
        event.declaration = {
          title: decl.title || event.title,
          description: decl.description || event.description,
          event_aspects: decl.event_aspects || [],
          aspects_version: decl.aspects_version || 'v1',
          visibility: decl.visibility || event.visibility,
          intent_flags: decl.intent_flags || [],
          declared_at: decl.declared_at || (null as any), // null se draft (cast para compatibilidade com tipo)
          
          // FASE 3: Recuperar time windows (se existirem) - mesmo em draft
          ...(decl.desired_time_windows !== undefined && {
            desired_time_windows: decl.desired_time_windows,
          }),
          ...(decl.flexibility_level !== undefined && {
            flexibility_level: decl.flexibility_level,
          }),
          ...(decl.timezone !== undefined && {
            timezone: decl.timezone,
          }),
        } as EventDeclaration;
      }
    }
    
    return event;
  }

  /**
   * Atualiza time windows diretamente em metadata
   * 
   * 🔴 REGRA CANÔNICA: Time windows NÃO dependem de event_aspects
   * - Salva em metadata.declaration.desired_time_windows (se declaration existe)
   * - OU cria declaration parcial (se draft sem declaration)
   * - NÃO valida event_aspects
   * - NÃO recria declaration completa
   * - Funciona em qualquer status (draft, declared, published)
   * - NUNCA retorna 500 por ausência de aspects
   */
  async updateTimeWindows(
    tenantId: string,
    eventId: string,
    desiredTimeWindows: EventTimeWindow[],
    flexibilityLevel?: 'strict' | 'flexible' | 'very_flexible',
    timezone?: string,
    actorId?: string
  ): Promise<Event> {
    // 1. Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar permissão (se actorId fornecido)
    if (actorId && event.actor_id !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode atualizar time windows');
    }

    // 3. Validar time windows (APENAS FORMA, NÃO DECISÃO)
    // NUNCA inferir, NUNCA completar, NUNCA ajustar
    const normalizedTimeWindows: EventTimeWindow[] = [];
    
    for (const window of desiredTimeWindows) {
      // Validação de FORMA apenas:
      // - start_datetime e end_datetime obrigatórios
      // - start < end
      // - timezone opcional, mas se fornecido deve ser string não-vazia
      
      if (!window.start_datetime || !window.end_datetime) {
        throw new BadRequestError('Cada janela de tempo deve ter start_datetime e end_datetime');
      }
      
      const startDate = new Date(window.start_datetime);
      const endDate = new Date(window.end_datetime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestError('Datas inválidas na janela de tempo');
      }
      
      if (endDate <= startDate) {
        throw new BadRequestError('end_datetime deve ser posterior a start_datetime na janela de tempo');
      }
      
      if (window.timezone !== undefined && (!window.timezone || window.timezone.trim() === '')) {
        throw new BadRequestError('timezone não pode ser string vazia se fornecido');
      }
      
      // Normalização mecânica apenas: trim de timezone se fornecido
      normalizedTimeWindows.push({
        start_datetime: window.start_datetime, // ISO já validado
        end_datetime: window.end_datetime, // ISO já validado
        timezone: window.timezone?.trim() || undefined,
      });
    }

    // 4. Validar flexibility_level (se fornecido)
    const validFlexibilityLevels: Array<'strict' | 'flexible' | 'very_flexible'> = ['strict', 'flexible', 'very_flexible'];
    if (flexibilityLevel !== undefined && !validFlexibilityLevels.includes(flexibilityLevel)) {
      throw new BadRequestError(
        `Flexibility level '${flexibilityLevel}' não é válido. ` +
        `Valores válidos: ${validFlexibilityLevels.join(', ')}`
      );
    }

    // 5. Atualizar metadata
    const metadata = event.metadata || {};
    
    // Se já tem declaration, atualizar dentro dela
    if (metadata.declaration && typeof metadata.declaration === 'object' && metadata.declaration.declared_at) {
      // Declaration já existe (evento declarado) - apenas atualizar time windows
      metadata.declaration = {
        ...metadata.declaration,
        desired_time_windows: normalizedTimeWindows,
        ...(flexibilityLevel !== undefined && { flexibility_level: flexibilityLevel }),
        ...(timezone !== undefined && { timezone: timezone.trim() || undefined }),
      };
    } else {
      // Se não tem declaration completa (draft), criar/atualizar declaration parcial
      // Mantém event_aspects existente se houver, senão array vazio
      const existingAspects = (metadata.declaration as any)?.event_aspects || [];
      const existingAspectsVersion = (metadata.declaration as any)?.aspects_version || 'v1';
      
      metadata.declaration = {
        title: event.title,
        description: event.description || null,
        event_aspects: existingAspects, // Mantém existente ou vazio
        aspects_version: existingAspectsVersion,
        visibility: event.visibility,
        intent_flags: (metadata.declaration as any)?.intent_flags || [],
        declared_at: (metadata.declaration as any)?.declared_at || null, // null se draft
        desired_time_windows: normalizedTimeWindows,
        ...(flexibilityLevel !== undefined && { flexibility_level: flexibilityLevel }),
        ...(timezone !== undefined && { timezone: timezone.trim() || undefined }),
      };
    }

    // 6. Persistir no banco
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET 
        metadata = $1,
        updated_at = NOW()
      WHERE tenant_id = $2 AND id = $3
      RETURNING *
      `,
      [
        JSON.stringify(metadata),
        tenantId,
        eventId,
      ]
    );

    if (!row) {
      throw new Error('Falha ao atualizar time windows');
    }

    const updatedEvent = this.toEvent(row);
    
    // toEvent já recupera declaration do metadata automaticamente
    // Não precisa enriquecer manualmente - toEvent já faz isso
    return updatedEvent;
  }
}

export const eventService = new EventService();

