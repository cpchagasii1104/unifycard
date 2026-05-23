// backend/src/core/events/specs/event-spec.service.ts
// Service para EventSpec - Especificação Declarativa de Evento
// ⚠️ REGRA INSTITUCIONAL: EventSpec NÃO decide nada. É apenas especificação declarada pelo usuário.
// 
// EVENT_DOMAIN_MINIMUM_CONTRACT Seção 7:
// - EventSpec é snapshot imutável, append-only
// - EventSpec pode referenciar event_id
// - EventSpec não decide nada
// - EventSpec não é usado para ranking/score
//
// 🔴 DISTINÇÃO CANÔNICA: EventSpec vs EventDeclaration
//
// EventSpec:
// - É snapshot imutável de questionário declarativo
// - Armazenado em event_specs (tabela separada)
// - Pode gerar EventDeclaration, mas são entidades distintas
// - NÃO decide nada
// - EventSpec.answers.event_date pode ser date_or_window como resposta de questionário
//
// EventDeclaration:
// - É subdocumento do agregado Event
// - Armazenado em events.metadata.declaration (JSONB)
// - Expressa intenção do evento declarado
// - NÃO decide nada
// - EventDeclaration.desired_time_windows é declaração estruturada do agregado Event
//
// TIME WINDOWS (FASE 3):
// - EventSpec pode conter date_or_window como resposta de questionário (snapshot imutável)
// - EventDeclaration.desired_time_windows é declaração estruturada (metadata.declaration)
// - Um pode gerar o outro por ação explícita (sem automação "inteligente")
// - Nenhum deles decide, apenas declara
//
// Nenhuma delas executa ações ou cria regras de negócio.

import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import type {
  EventSpec,
  CreateEventSpecInput,
  EventSpecValidation,
  EventSpecQuery,
  EventSpecVersion,
} from './event-spec.types';

interface EventSpecRow {
  spec_id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  event_id: string | null;
  spec_version: number;
  macro_intention: string;
  subflow: string;
  answers: Record<string, any>;
  metadata: Record<string, any> | null;
  created_by: string;
  created_at: Date;
}

class EventSpecService {
  /**
   * Converte EventSpecRow para EventSpec
   */
  private toEventSpec(row: EventSpecRow): EventSpec {
    return {
      specId: row.spec_id,
      eventId: row.event_id || '',
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      actorType: row.actor_type as 'user' | 'page' | 'group' | 'channel',
      specVersion: row.spec_version as EventSpecVersion,
      macroIntention: row.macro_intention as any,
      subflow: row.subflow as any,
      answers: row.answers,
      createdAt: row.created_at.toISOString(),
      createdBy: row.created_by,
      metadata: row.metadata || {},
    };
  }

  /**
   * Valida EventSpec antes de criar
   */
  validateEventSpec(input: CreateEventSpecInput): EventSpecValidation {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validações obrigatórias
    if (!input.tenantId) {
      errors.push({ field: 'tenantId', message: 'tenantId é obrigatório' });
    }

    if (!input.actorId) {
      errors.push({ field: 'actorId', message: 'actorId é obrigatório' });
    }

    if (!input.actorType) {
      errors.push({ field: 'actorType', message: 'actorType é obrigatório' });
    }

    if (!input.macroIntention) {
      errors.push({ field: 'macroIntention', message: 'macroIntention é obrigatório' });
    }

    if (!input.subflow) {
      errors.push({ field: 'subflow', message: 'subflow é obrigatório' });
    }

    if (!input.answers || typeof input.answers !== 'object') {
      errors.push({ field: 'answers', message: 'answers deve ser um objeto' });
    }

    // Validações de tipo
    const validActorTypes = ['user', 'page', 'group', 'channel'];
    if (!validActorTypes.includes(input.actorType)) {
      errors.push({
        field: 'actorType',
        message: `actorType deve ser um de: ${validActorTypes.join(', ')}`,
      });
    }

    const validMacroIntentions = ['celebrate', 'gather', 'teach', 'present', 'other'];
    if (!validMacroIntentions.includes(input.macroIntention)) {
      errors.push({
        field: 'macroIntention',
        message: `macroIntention deve ser um de: ${validMacroIntentions.join(', ')}`,
      });
    }

    // Warnings (não bloqueiam criação)
    if (Object.keys(input.answers || {}).length === 0) {
      warnings.push({
        field: 'answers',
        message: 'answers está vazio - nenhuma resposta foi coletada',
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Cria um novo EventSpec
   * ⚠️ EventSpec é imutável - não pode ser atualizado depois
   */
  /**
   * Gera event_ticket no formato EVT-YYYY-NNNNNN
   * Formato: EVT-2026-000183
   */
  private async generateEventTicket(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const yearPattern = `EVT-${year}-`;
    
    // Buscar o último ticket do ano para gerar sequencial
    const query = `
      SELECT answers->>'event_ticket' as last_ticket
      FROM event_specs
      WHERE tenant_id = $1
        AND answers->>'event_ticket' IS NOT NULL
        AND answers->>'event_ticket' LIKE $2
      ORDER BY answers->>'event_ticket' DESC
      LIMIT 1
    `;
    
    const result = await runQueryWithTenant<{ last_ticket: string }>(tenantId, query, [
      tenantId,
      `${yearPattern}%`,
    ]);
    
    let nextNumber = 1;
    if (result?.last_ticket) {
      const lastTicket = result.last_ticket;
      const match = lastTicket.match(/^EVT-\d+-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    return `EVT-${year}-${nextNumber.toString().padStart(6, '0')}`;
  }

  async createEventSpec(
    tenantId: string,
    userId: string,
    input: CreateEventSpecInput
  ): Promise<EventSpec> {
    // Validar input
    const validation = this.validateEventSpec(input);
    if (!validation.valid) {
      throw new BadRequestError(
        `EventSpec inválido: ${validation.errors?.map(e => e.message).join(', ')}`
      );
    }

    // Gerar spec_id
    const specId = uuidv4();

    // 🔴 GERAR event_ticket AUTOMATICAMENTE conforme 02_birthday_eventspec_v1.md
    const eventTicket = await this.generateEventTicket(tenantId);
    
    // Adicionar event_ticket aos answers
    const answersWithTicket = {
      ...input.answers,
      event_ticket: eventTicket,
    };

    // Preparar metadata
    const metadata = {
      ...(input.metadata || {}),
      created_by_user_id: userId,
    };

    // Inserir no banco
    const query = `
      INSERT INTO event_specs (
        spec_id,
        tenant_id,
        actor_id,
        actor_type,
        event_id,
        spec_version,
        macro_intention,
        subflow,
        answers,
        metadata,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    // 🔴 P0-2: Validar que eventId é obrigatório
    if (!input.eventId) {
      throw new BadRequestError('eventId é obrigatório. EventSpec deve sempre referenciar um Event existente (draft).');
    }

    const result = await runQueryWithTenant<EventSpecRow>(tenantId, query, [
      specId,
      input.tenantId,
      input.actorId,
      input.actorType,
      input.eventId, // 🔴 P0-2: eventId é obrigatório, não pode ser null
      1, // spec_version = 1 (primeira versão)
      input.macroIntention,
      input.subflow,
      JSON.stringify(answersWithTicket),
      JSON.stringify(metadata),
      userId,
    ]);

    if (!result) {
      throw new Error('Falha ao criar EventSpec');
    }

    return this.toEventSpec(result);
  }

  /**
   * Busca EventSpec por ID
   */
  async getEventSpecById(tenantId: string, specId: string): Promise<EventSpec> {
    const query = `
      SELECT *
      FROM event_specs
      WHERE tenant_id = $1 AND spec_id = $2
    `;

    const result = await runQueryWithTenant<EventSpecRow>(tenantId, query, [tenantId, specId]);

    if (!result) {
      throw new NotFoundError(`EventSpec não encontrado: ${specId}`);
    }

    return this.toEventSpec(result);
  }

  /**
   * Busca EventSpecs por query
   */
  async queryEventSpecs(tenantId: string, query: EventSpecQuery): Promise<EventSpec[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (query.actorId) {
      conditions.push(`actor_id = $${paramIndex++}`);
      params.push(query.actorId);
    }

    if (query.actorType) {
      conditions.push(`actor_type = $${paramIndex++}`);
      params.push(query.actorType);
    }

    if (query.macroIntention) {
      conditions.push(`macro_intention = $${paramIndex++}`);
      params.push(query.macroIntention);
    }

    if (query.subflow) {
      conditions.push(`subflow = $${paramIndex++}`);
      params.push(query.subflow);
    }

    if (query.eventId) {
      conditions.push(`event_id = $${paramIndex++}`);
      params.push(query.eventId);
    }

    if (query.specVersion) {
      conditions.push(`spec_version = $${paramIndex++}`);
      params.push(query.specVersion);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const sql = `
      SELECT *
      FROM event_specs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const rows = await runQueriesWithTenant<EventSpecRow>(tenantId, sql, params);

    return rows.map(row => this.toEventSpec(row));
  }

  /**
   * Associa EventSpec a um Event
   * ⚠️ EventSpec é imutável - apenas associa event_id se ainda não estiver associado
   */
  async associateEventToSpec(
    tenantId: string,
    specId: string,
    eventId: string
  ): Promise<EventSpec> {
    const query = `
      UPDATE event_specs
      SET event_id = $1
      WHERE tenant_id = $2 AND spec_id = $3 AND event_id IS NULL
      RETURNING *
    `;

    const result = await runQueryWithTenant<EventSpecRow>(tenantId, query, [
      eventId,
      tenantId,
      specId,
    ]);

    if (!result) {
      throw new NotFoundError(
        `EventSpec não encontrado ou já associado a um evento: ${specId}`
      );
    }

    return this.toEventSpec(result);
  }

  /**
   * Atualiza incrementalmente o EventSpec durante FASE 5 (INTENT_DRAFT)
   * 
   * 🔴 REGRA CANÔNICA (FASE_5_EVENTSPEC_IMMUTABILITY_AND_VERSIONING.md):
   * - Permitido apenas quando EventSpec está em construção (não fechado)
   * - Event associado deve estar em status 'draft'
   * - Merge superficial de partialSpec com answers existente
   * - Após fechamento, EventSpec torna-se imutável
   * - Alterações futuras exigem novo snapshot (append-only)
   * 
   * @param tenantId Tenant ID
   * @param specId Spec ID
   * @param partialSpec Fragmento de answers para mesclar
   * @param userId User ID que está atualizando
   * @returns EventSpec atualizado
   */
  async updateEventSpecIncremental(
    tenantId: string,
    specId: string,
    partialSpec: Record<string, any>,
    userId: string
  ): Promise<EventSpec> {
    // 1. Buscar EventSpec atual
    const currentSpec = await this.getEventSpecById(tenantId, specId);

    // 2. Verificar se EventSpec está fechado (via metadata.closed)
    const isClosed = currentSpec.metadata?.closed === true;
    if (isClosed) {
      throw new BadRequestError(
        'EventSpec está fechado e não pode ser editado. Alterações futuras exigem novo snapshot.'
      );
    }

    // 3. Se EventSpec está associado a um Event, validar que Event está em 'draft'
    if (currentSpec.eventId) {
      const eventQuery = `
        SELECT status
        FROM events
        WHERE tenant_id = $1 AND id = $2
      `;
      const eventResult = await runQueryWithTenant<{ status: string }>(
        tenantId,
        eventQuery,
        [tenantId, currentSpec.eventId]
      );

      if (!eventResult) {
        throw new NotFoundError(`Event associado não encontrado: ${currentSpec.eventId}`);
      }

      const eventStatus = eventResult.status;
      if (eventStatus !== 'draft') {
        throw new BadRequestError(
          `EventSpec só pode ser atualizado quando Event está em status 'draft'. Event atual: '${eventStatus}'`
        );
      }
    }

    // 4. Fazer merge superficial de partialSpec com answers existente
    // Merge superficial: campos ausentes não são apagados, ausência ≠ false
    const mergedAnswers = {
      ...currentSpec.answers,
      ...partialSpec,
    };

    // 5. Atualizar metadata (preservar existente, adicionar updated_by)
    const updatedMetadata = {
      ...currentSpec.metadata,
      updated_by: userId,
      updatedAt: new Date().toISOString(),
    };

    // 6. Persistir atualização
    // 🔴 NOTA: Tabela event_specs não tem updatedAt (imutável por design)
    // Durante FASE 5 (construção), permitimos UPDATE incremental
    // Metadata.updatedAt registra quando foi atualizado
    const updateQuery = `
      UPDATE event_specs
      SET
        answers = $1,
        metadata = $2
      WHERE tenant_id = $3 AND spec_id = $4
      RETURNING *
    `;

    const result = await runQueryWithTenant<EventSpecRow>(
      tenantId,
      updateQuery,
      [
        JSON.stringify(mergedAnswers),
        JSON.stringify(updatedMetadata),
        tenantId,
        specId,
      ]
    );

    if (!result) {
      throw new NotFoundError(`EventSpec não encontrado: ${specId}`);
    }

    return this.toEventSpec(result);
  }

  /**
   * Fecha o EventSpec (torna imutável)
   * 
   * 🔴 REGRA CANÔNICA (FASE_5_EVENTSPEC_IMMUTABILITY_AND_VERSIONING.md):
   * - Executado mediante ação humana explícita "Salvar planejamento"
   * - Após fechamento, EventSpec torna-se imutável
   * - Qualquer alteração futura exige novo snapshot
   * 
   * @param tenantId Tenant ID
   * @param specId Spec ID
   * @param userId User ID que está fechando
   * @returns EventSpec fechado
   */
  async closeEventSpec(
    tenantId: string,
    specId: string,
    userId: string
  ): Promise<EventSpec> {
    // 1. Buscar EventSpec atual
    const currentSpec = await this.getEventSpecById(tenantId, specId);

    // 2. Verificar se já está fechado
    if (currentSpec.metadata?.closed === true) {
      return currentSpec; // Idempotente: já fechado
    }

    // 3. Marcar como fechado no metadata
    const updatedMetadata = {
      ...currentSpec.metadata,
      closed: true,
      closedAt: new Date().toISOString(),
      closed_by: userId,
    };

    // 4. Persistir fechamento
    // 🔴 NOTA: Tabela event_specs não tem updatedAt (imutável por design)
    // Metadata.closedAt registra quando foi fechado
    const updateQuery = `
      UPDATE event_specs
      SET
        metadata = $1
      WHERE tenant_id = $2 AND spec_id = $3
      RETURNING *
    `;

    const result = await runQueryWithTenant<EventSpecRow>(
      tenantId,
      updateQuery,
      [
        JSON.stringify(updatedMetadata),
        tenantId,
        specId,
      ]
    );

    if (!result) {
      throw new NotFoundError(`EventSpec não encontrado: ${specId}`);
    }

    return this.toEventSpec(result);
  }
}

export const eventSpecService = new EventSpecService();


