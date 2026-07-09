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
import { ACTOR_EVENT_TYPE_MATRIX, EVENT_ACCESS_TYPES, EVENT_CATEGORIES, EVENT_LOCATION_MODES_MVP_ENABLED } from './event.types';
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
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any> | null;
}

class EventService {
  /**
   * Converte EventRow para Event (com campos canônicos)
   */
  private toEvent(row: EventRow): Event {
    const event = {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      actorType: row.actor_type as ActorType,
      eventType: row.event_type as EventType,
      eventSubtype: row.event_subtype,
      title: row.title,
      description: row.description,
      datetimeStart: row.datetime_start,
      datetimeEnd: row.datetime_end,
      status: row.status as EventStatus,
      visibility: row.visibility as EventVisibility,
      ticketPriceCents: row.ticket_price_cents,
      maxAttendees: row.max_attendees,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: row.metadata || {},
    };
    
    // Enriquecer com campos canônicos (aliases)
    const enriched = enrichEventWithCanonicalFields({
      id: event.id,
      tenantId: event.tenantId,
      actorId: event.actorId,
      actorType: event.actorType,
      status: event.status,
      visibility: event.visibility,
      declaration: null, // Será preenchido se existir
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    });
    
    return {
      ...event,
      responsibleActorId: enriched.responsibleActorId,
      responsibleActorType: enriched.responsibleActorType,
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
   * Lista canônica conforme CHECK vigente (migration soberana 20260525100000 §4.38):
   * draft, declared, published, active, ended, cancelled.
   * 'completed' e 'archived' mantidos como compatibilidade transitória durante
   * convergência gradual ao vocabulário canônico (§25 norma assintótica).
   */
  private validateStatus(status: string): status is EventStatus {
    const validStatuses: EventStatus[] = [
      'draft', 'declared', 'published', 'active', 'ended', 'cancelled',
      'completed', 'archived',
    ];
    return validStatuses.includes(status as EventStatus);
  }

  /**
   * Valida visibility (CONTRATO v1)
   */
  private validateVisibility(visibility: string): visibility is EventVisibility {
    const validVisibilities: EventVisibility[] = ['public', 'connections', 'only_me'];
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
    // F-EVENT-CONCEPT-FIRST-MODEL: event_type deixou de ser autoridade. Só valida SE veio (caminho legado).
    // Novo caminho formato-first cria o draft sem event_type; a identidade (formato) é setada via updateEvent.
    if (input.eventType) {
      const actorValidation = this.validateActorEventType(input.actorType, input.eventType);
      if (!actorValidation.valid) {
        throw new BadRequestError(actorValidation.reason || 'Validação Actor × EventType falhou');
      }
      if (!this.validateEventType(input.eventType)) {
        throw new BadRequestError(`Event type '${input.eventType}' não é válido`);
      }
    }

    // 3. Validar datas (FASE 5: apenas se AMBAS forem fornecidas)
    // ETAPA 0 não requer datas - serão definidas em ETAPA 3
    if (input.datetimeStart && input.datetimeEnd) {
      const startDate = new Date(input.datetimeStart);
      const endDate = new Date(input.datetimeEnd);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestError('Datas inválidas');
      }

      if (endDate <= startDate) {
        throw new BadRequestError('datetimeEnd deve ser posterior a datetimeStart');
      }
    }

    // 4. Validar ticketPriceCents (se fornecido)
    if (input.ticketPriceCents !== undefined && input.ticketPriceCents !== null) {
      if (input.ticketPriceCents < 0) {
        throw new BadRequestError('ticketPriceCents não pode ser negativo');
      }
    }

    // 5. Validar maxAttendees (se fornecido)
    if (input.maxAttendees !== undefined && input.maxAttendees !== null) {
      if (input.maxAttendees <= 0) {
        throw new BadRequestError('maxAttendees deve ser maior que zero');
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
      [tenantId, input.actorId, input.actorType]
    );

    if (!actor) {
      throw new BadRequestError(`Actor '${input.actorId}' (${input.actorType}) não encontrado`);
    }

    // 8. Criar evento
    const visibility = input.visibility || 'public';
    // FASE 5: datetimeStart e datetimeEnd são opcionais (ETAPA 0 não requer datas)
    const datetimeStart = input.datetimeStart || null;
    const datetimeEnd = input.datetimeEnd || null;
    
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
        input.actorId,
        input.actorType,
        input.eventType,
        input.eventSubtype || null,
        input.title,
        input.description || null,
        datetimeStart,
        datetimeEnd,
        'draft', // Sempre começa como draft
        visibility,
        input.ticketPriceCents || null,
        input.maxAttendees || null,
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
    if (event.actorId !== actorId) {
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

    // 3. Validar que não está cancelado/finalizado.
    // Lifecycle encerrado segundo CHECK vigente (events.status): 'cancelled' ou 'ended'.
    // 'completed'/'archived' eram dead branches contra CHECK soberano (20260525100000).
    if (event.status === 'cancelled' || event.status === 'ended') {
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
    if (input.datetimeStart || input.datetimeEnd) {
      const startDate = input.datetimeStart ? new Date(input.datetimeStart) : new Date(event.datetimeStart);
      const endDate = input.datetimeEnd ? new Date(input.datetimeEnd) : new Date(event.datetimeEnd);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestError('Datas inválidas');
      }

      if (endDate <= startDate) {
        throw new BadRequestError('datetimeEnd deve ser posterior a datetimeStart');
      }
    }

    // 6. Validar ticketPriceCents (se fornecido)
    if (input.ticketPriceCents !== undefined && input.ticketPriceCents !== null) {
      if (input.ticketPriceCents < 0) {
        throw new BadRequestError('ticketPriceCents não pode ser negativo');
      }
    }

    // 7. Validar maxAttendees (se fornecido)
    if (input.maxAttendees !== undefined && input.maxAttendees !== null) {
      if (input.maxAttendees <= 0) {
        throw new BadRequestError('maxAttendees deve ser maior que zero');
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

    if (input.datetimeStart !== undefined) {
      updates.push(`datetime_start = $${paramIndex++}`);
      values.push(input.datetimeStart);
    }

    if (input.datetimeEnd !== undefined) {
      updates.push(`datetime_end = $${paramIndex++}`);
      values.push(input.datetimeEnd);
    }

    if (input.eventSubtype !== undefined) {
      updates.push(`event_subtype = $${paramIndex++}`);
      values.push(input.eventSubtype);
    }

    if (input.visibility !== undefined) {
      if (!this.validateVisibility(input.visibility)) {
        throw new BadRequestError(`Visibility '${input.visibility}' não é válido`);
      }
      updates.push(`visibility = $${paramIndex++}`);
      values.push(input.visibility);
    }

    if (input.ticketPriceCents !== undefined) {
      updates.push(`ticket_price_cents = $${paramIndex++}`);
      values.push(input.ticketPriceCents);
    }

    if (input.maxAttendees !== undefined) {
      updates.push(`max_attendees = $${paramIndex++}`);
      values.push(input.maxAttendees);
    }

    // Acesso/custo (anúncio) + capacidade mínima. Validações objetivas — NADA financeiro executa (Δbank=0).
    if (input.eventAccessType !== undefined && input.eventAccessType !== null) {
      if (!(EVENT_ACCESS_TYPES as readonly string[]).includes(input.eventAccessType)) {
        throw new BadRequestError(`event_access_type '${input.eventAccessType}' inválido (${EVENT_ACCESS_TYPES.join('|')}).`);
      }
      // Pago exige valor ANUNCIADO (> 0). Não cria cobrança — só o número exibido.
      if (input.eventAccessType === 'pago' && input.ticketPriceCents != null && input.ticketPriceCents <= 0) {
        throw new BadRequestError('Evento pago exige um valor anunciado maior que zero (em cents).');
      }
      updates.push(`event_access_type = $${paramIndex++}`);
      values.push(input.eventAccessType);
    }

    if (input.minAttendees !== undefined) {
      if (input.minAttendees !== null && input.minAttendees < 1) {
        throw new BadRequestError('min_attendees deve ser ≥ 1.');
      }
      if (input.minAttendees != null && input.maxAttendees != null && input.minAttendees > input.maxAttendees) {
        throw new BadRequestError('O mínimo de participantes não pode ser maior que o máximo.');
      }
      updates.push(`min_attendees = $${paramIndex++}`);
      values.push(input.minAttendees);
    }

    // F-EVENT-CONCEPT-FIRST: formato (concept) — valida que É formato de evento habilitado (não texto).
    if (input.eventFormatConceptId !== undefined && input.eventFormatConceptId !== null) {
      const fmt = await runQueryWithTenant<{ ok: number }>(
        tenantId, `SELECT 1 AS ok FROM event_format_concepts WHERE concept_id = $1 AND enabled = true`, [input.eventFormatConceptId]
      );
      if (!fmt) throw new BadRequestError('event_format_concept_id inválido: não é um formato de evento habilitado.');
      updates.push(`event_format_concept_id = $${paramIndex++}`);
      values.push(input.eventFormatConceptId);
    }
    // location_mode governado; 'route' fica DISABLED no MVP.
    if (input.locationMode !== undefined && input.locationMode !== null) {
      if (!(EVENT_LOCATION_MODES_MVP_ENABLED as readonly string[]).includes(input.locationMode)) {
        throw new BadRequestError(`location_mode '${input.locationMode}' não disponível no MVP.`);
      }
      updates.push(`location_mode = $${paramIndex++}`);
      values.push(input.locationMode);
    }

    if (input.metadata !== undefined) {
      // MERGE (não replace): PATCH parcial não pode apagar metadata.declaration (gravado no declare) nem
      // outras chaves. jsonb || preserva o existente e sobrescreve só as chaves enviadas.
      updates.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(input.metadata));
    }

    // TEMAS e FACETS vivem em tabelas de aplicabilidade (não na linha events) — persistidos SEMPRE
    // (independente do UPDATE de coluna abaixo). Substituição total (replace) quando o campo vem.
    if (input.themeConceptIds !== undefined) {
      await runQueryWithTenant(tenantId, `DELETE FROM event_theme_links WHERE event_id = $1`, [eventId]);
      for (const cid of input.themeConceptIds) {
        await runQueryWithTenant(tenantId, `INSERT INTO event_theme_links (event_id, concept_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [eventId, cid]);
      }
    }
    if (input.categoryFacets !== undefined) {
      for (const f of input.categoryFacets) {
        if (!(EVENT_CATEGORIES as readonly string[]).includes(f)) throw new BadRequestError(`Categoria '${f}' inválida.`);
      }
      await runQueryWithTenant(tenantId, `DELETE FROM event_category_facets WHERE event_id = $1`, [eventId]);
      for (const f of input.categoryFacets) {
        await runQueryWithTenant(tenantId, `INSERT INTO event_category_facets (event_id, category_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [eventId, f]);
      }
    }

    // LOCAL do evento (Fase A) — cityId GOVERNADO (Location Core), nunca texto. Persiste em
    // address_assignments(owner_type='event', role='OPERATIONAL'), mesmo padrão das locações.
    if (input.venueCityId !== undefined && input.venueCityId !== null) {
      await runQueryWithTenant(tenantId,
        `UPDATE address_assignments SET valid_until_at = now(), is_primary = false, updated_at = now()
          WHERE owner_type = 'event' AND owner_id = $1::uuid AND role = 'OPERATIONAL'
            AND is_primary = true AND valid_until_at IS NULL`, [eventId]);
      await runQueryWithTenant(tenantId,
        `WITH geo AS (
           SELECT c.state_id, s.country_id, c.lat AS city_lat, c.lng AS city_lng
             FROM cities c JOIN states s ON s.state_id = c.state_id WHERE c.city_id = $2::uuid
         ),
         new_addr AS (
           INSERT INTO addresses (country_id, state_id, city_id, neighborhood_id, postal_code,
                                  neighborhood_display_text, lat, lng, is_geocoded, source, created_by_tenant_id)
           SELECT geo.country_id, geo.state_id, $2::uuid, $4::uuid, $3, $5, geo.city_lat, geo.city_lng,
                  false, 'UX_INPUT', $6::uuid FROM geo
           RETURNING address_id
         )
         INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary)
         SELECT 'event', $1::uuid, address_id, 'OPERATIONAL', true FROM new_addr`,
        [eventId, input.venueCityId, input.venuePostalCode ?? null, input.venueNeighborhoodId ?? null,
         input.venueNeighborhoodDisplay ?? null, tenantId]);
    }

    if (updates.length === 0) {
      return event; // Nada para atualizar na LINHA events (temas/facets/local já persistidos acima)
    }

    // Adicionar updatedAt
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
    if (event.actorId !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode declará-lo');
    }

    // 3. Validar transição via aggregate
    assertTransitionAllowed(event.status, 'declared');

    // 4. 🔴 VALIDAÇÃO OBRIGATÓRIA: eventAspects é obrigatório e NÃO pode ser inferido
    if (!declarationInput.eventAspects || declarationInput.eventAspects.length === 0) {
      throw new BadRequestError(
        'eventAspects é obrigatório e deve vir do vocabulário fechado. ' +
        'Não é possível inferir aspectos automaticamente.'
      );
    }

    // 5. Validar eventAspects contra vocabulário fechado
    const aspectsValidation = validateAspects(declarationInput.eventAspects);

    // 6. Validar visibility como declaração (apenas checar se é valor permitido)
    if (!this.validateVisibility(declarationInput.visibility)) {
      throw new BadRequestError(`Visibility '${declarationInput.visibility}' não é válido`);
    }

    // 7. Validar intentFlags contra allowlist (se fornecido)
    const validIntentFlags = ['wants_services', 'wants_voting', 'wants_ticketing'];
    if (declarationInput.intentFlags && declarationInput.intentFlags.length > 0) {
      const invalidFlags = declarationInput.intentFlags.filter(
        flag => !validIntentFlags.includes(flag)
      );
      if (invalidFlags.length > 0) {
        throw new BadRequestError(
          `Intent flags inválidos: ${invalidFlags.join(', ')}. ` +
          `Flags válidos: ${validIntentFlags.join(', ')}`
        );
      }
    }

    // 8. 🔴 FASE 3: Validar desiredTimeWindows (APENAS FORMA, NÃO DECISÃO)
    // NUNCA inferir, NUNCA completar, NUNCA ajustar, NUNCA corrigir
    let normalizedTimeWindows: EventTimeWindow[] | undefined;
    if (declarationInput.desiredTimeWindows !== undefined) {
      // Array pode ser vazio (permitido)
      normalizedTimeWindows = [];
      
      for (const window of declarationInput.desiredTimeWindows) {
        // Validação de FORMA apenas:
        // - startDatetime e endDatetime obrigatórios
        // - start < end
        // - timezone opcional, mas se fornecido deve ser string não-vazia
        
        if (!window.startDatetime || !window.endDatetime) {
          throw new BadRequestError('Cada janela de tempo deve ter startDatetime e endDatetime');
        }
        
        const startDate = new Date(window.startDatetime);
        const endDate = new Date(window.endDatetime);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new BadRequestError('Datas inválidas na janela de tempo');
        }
        
        if (endDate <= startDate) {
          throw new BadRequestError('endDatetime deve ser posterior a startDatetime na janela de tempo');
        }
        
        if (window.timezone !== undefined && (!window.timezone || window.timezone.trim() === '')) {
          throw new BadRequestError('timezone não pode ser string vazia se fornecido');
        }
        
        // Normalização mecânica apenas: trim de timezone se fornecido
        normalizedTimeWindows.push({
          startDatetime: window.startDatetime, // ISO já validado
          endDatetime: window.endDatetime, // ISO já validado
          timezone: window.timezone?.trim() || undefined,
        });
      }
    }

    // 9. Validar flexibilityLevel (se fornecido)
    const validFlexibilityLevels: FlexibilityLevel[] = ['strict', 'flexible', 'very_flexible'];
    if (declarationInput.flexibilityLevel !== undefined) {
      if (!validFlexibilityLevels.includes(declarationInput.flexibilityLevel)) {
        throw new BadRequestError(
          `Flexibility level '${declarationInput.flexibilityLevel}' não é válido. ` +
          `Valores válidos: ${validFlexibilityLevels.join(', ')}`
        );
      }
    }

    // 10. Construir EventDeclaration completa
    const declaration: EventDeclaration = {
      title: declarationInput.title,
      description: declarationInput.description || null,
      eventAspects: aspectsValidation.normalized, // Normalizado e validado
      aspectsVersion: aspectsValidation.version, // Versão do vocabulário
      visibility: declarationInput.visibility, // Validado
      intentFlags: declarationInput.intentFlags || [], // Validado contra allowlist
      declaredAt: new Date().toISOString(),
      
      // FASE 3: Declared Time Windows (sem inferência)
      desiredTimeWindows: normalizedTimeWindows, // Pode ser undefined ou array vazio
      flexibilityLevel: declarationInput.flexibilityLevel, // Opcional
      timezone: declarationInput.timezone?.trim() || undefined, // Opcional, normalizado
    };

    // 11. Persistir declaration completa em metadata.declaration (JSONB)
    // NÃO criar tabela nova
    // Nota: metadata.declaration usa snake_case para persistência (JSONB)
    // mas a declaração em memória (EventDeclaration) usa camelCase
    const metadata = event.metadata || {};
    metadata.declaration = {
      title: declaration.title,
      description: declaration.description,
      event_aspects: declaration.eventAspects, // Converter camelCase para snake_case na persistência
      aspects_version: declaration.aspectsVersion,
      visibility: declaration.visibility,
      intent_flags: declaration.intentFlags,
      declaredAt: declaration.declaredAt,
      
      // FASE 3: Persistir time windows (se fornecidos)
      // Converter EventTimeWindow[] (camelCase) para snake_case na persistência
      ...(declaration.desiredTimeWindows !== undefined && {
        desired_time_windows: declaration.desiredTimeWindows.map(w => ({
          start_datetime: w.startDatetime,
          end_datetime: w.endDatetime,
          timezone: w.timezone,
        })),
      }),
      ...(declaration.flexibilityLevel !== undefined && {
        flexibility_level: declaration.flexibilityLevel,
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
    if (event.actorId !== actorId) {
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
    if (event.actorId !== actorId) {
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
    if (event.actorId !== actorId) {
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
    if (event.actorId !== actorId) {
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
    const startDatetime = query?.datetime_start || event.datetimeStart;
    const endDatetime = query?.datetime_end || event.datetimeEnd;
    
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
        ownerType: event.actorType === 'user' ? AvailabilityOwnerType.USER : AvailabilityOwnerType.PAGE,
        ownerId: event.actorId,
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
            availability_id: availability.availabilityId,
            start_datetime: availability.startDatetime?.toISOString(),
            end_datetime: availability.endDatetime?.toISOString(),
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

    // 2. Verificar se há desiredTimeWindows
    if (!event.declaration?.desiredTimeWindows || event.declaration.desiredTimeWindows.length === 0) {
      return {
        status: 'insufficient_declaration',
        windows: [],
        notes: 'Evento não possui janelas de tempo declaradas. Adicione desiredTimeWindows na declaration.',
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
      for (const window of event.declaration.desiredTimeWindows) {
        const windowStart = new Date(window.startDatetime);
        const windowEnd = new Date(window.endDatetime);

        // 4.1. Consultar disponibilidades do responsible_actor (READ-ONLY)
        const actorAvailabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
          ownerType: event.actorType === 'user' ? AvailabilityOwnerType.USER : AvailabilityOwnerType.PAGE,
          ownerId: event.actorId,
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
              availability_id: availability.availabilityId,
              start_datetime: availability.startDatetime?.toISOString(),
              end_datetime: availability.endDatetime?.toISOString(),
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
        created_at AS "createdAt",
        updated_at AS "updatedAt",
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
    // 🔴 REGRA CANÔNICA: Recuperar mesmo se declaredAt for null (draft)
    // Time windows podem existir em draft sem declaration completa
    // Nota: metadata.declaration está em snake_case (JSONB), converter para camelCase
    if (row.metadata && typeof row.metadata === 'object' && 'declaration' in row.metadata) {
      const decl = row.metadata.declaration as any;
      if (decl) {
        // Se tem declaredAt, é declaration completa
        // Se não tem declaredAt mas tem campos, é declaration parcial (draft)
        const isCompleteDeclaration = decl.declaredAt !== null && decl.declaredAt !== undefined;
        
        // Construir declaration (pode ser parcial em draft)
        // Converter snake_case (metadata) para camelCase (EventDeclaration)
        event.declaration = {
          title: decl.title || event.title,
          description: decl.description || event.description,
          eventAspects: decl.event_aspects || [],
          aspectsVersion: decl.aspects_version || 'v1',
          visibility: decl.visibility || event.visibility,
          intentFlags: decl.intent_flags || [],
          declaredAt: decl.declaredAt || (null as any), // null se draft (cast para compatibilidade com tipo)
          
          // FASE 3: Recuperar time windows (se existirem) - mesmo em draft
          // Converter snake_case (metadata) para camelCase (EventTimeWindow[])
          ...(decl.desired_time_windows !== undefined && {
            desiredTimeWindows: decl.desired_time_windows.map((w: any) => ({
              startDatetime: w.start_datetime,
              endDatetime: w.end_datetime,
              timezone: w.timezone,
            })),
          }),
          ...(decl.flexibility_level !== undefined && {
            flexibilityLevel: decl.flexibility_level,
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
    if (actorId && event.actorId !== actorId) {
      throw new ForbiddenError('Apenas o criador do evento pode atualizar time windows');
    }

    // 3. Validar time windows (APENAS FORMA, NÃO DECISÃO)
    // NUNCA inferir, NUNCA completar, NUNCA ajustar
    const normalizedTimeWindows: EventTimeWindow[] = [];
    
    for (const window of desiredTimeWindows) {
      // Validação de FORMA apenas:
      // - startDatetime e endDatetime obrigatórios
      // - start < end
      // - timezone opcional, mas se fornecido deve ser string não-vazia
      
      if (!window.startDatetime || !window.endDatetime) {
        throw new BadRequestError('Cada janela de tempo deve ter startDatetime e endDatetime');
      }
      
      const startDate = new Date(window.startDatetime);
      const endDate = new Date(window.endDatetime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestError('Datas inválidas na janela de tempo');
      }
      
      if (endDate <= startDate) {
        throw new BadRequestError('endDatetime deve ser posterior a startDatetime na janela de tempo');
      }
      
      if (window.timezone !== undefined && (!window.timezone || window.timezone.trim() === '')) {
        throw new BadRequestError('timezone não pode ser string vazia se fornecido');
      }
      
      // Normalização mecânica apenas: trim de timezone se fornecido
      normalizedTimeWindows.push({
        startDatetime: window.startDatetime, // ISO já validado
        endDatetime: window.endDatetime, // ISO já validado
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
    // Nota: metadata.declaration usa snake_case para persistência (JSONB)
    if (metadata.declaration && typeof metadata.declaration === 'object' && metadata.declaration.declaredAt) {
      // Declaration já existe (evento declarado) - apenas atualizar time windows
      // Converter EventTimeWindow[] (camelCase) para snake_case na persistência
      metadata.declaration = {
        ...metadata.declaration,
        desired_time_windows: normalizedTimeWindows.map(w => ({
          start_datetime: w.startDatetime,
          end_datetime: w.endDatetime,
          timezone: w.timezone,
        })),
        ...(flexibilityLevel !== undefined && { flexibility_level: flexibilityLevel }),
        ...(timezone !== undefined && { timezone: timezone.trim() || undefined }),
      };
    } else {
      // Se não tem declaration completa (draft), criar/atualizar declaration parcial
      // Mantém event_aspects existente se houver, senão array vazio
      const existingAspects = (metadata.declaration as any)?.event_aspects || [];
      const existingAspectsVersion = (metadata.declaration as any)?.aspects_version || 'v1';
      
      // Converter EventTimeWindow[] (camelCase) para snake_case na persistência
      metadata.declaration = {
        title: event.title,
        description: event.description || null,
        event_aspects: existingAspects, // Mantém existente ou vazio
        aspects_version: existingAspectsVersion,
        visibility: event.visibility,
        intent_flags: (metadata.declaration as any)?.intent_flags || [],
        declaredAt: (metadata.declaration as any)?.declaredAt || null, // null se draft
        desired_time_windows: normalizedTimeWindows.map(w => ({
          start_datetime: w.startDatetime,
          end_datetime: w.endDatetime,
          timezone: w.timezone,
        })),
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


