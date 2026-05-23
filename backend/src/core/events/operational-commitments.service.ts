// backend/src/core/events/operational-commitments.service.ts
// Service para OperationalCommitment (FASE 4: sem economia)
// EVENT_DOMAIN_MINIMUM_CONTRACT

/**
 * 🔴 OPERATIONALCOMMITMENT É FACTUAL, SEM ECONOMIA
 * 
 * OperationalCommitment é factual: registra fatos (check-in/check-out) sem decisões.
 * 
 * Check-in/check-out são fatos:
 * - Registram timestamps de ações no mundo real
 * - Não decidem mérito ou disputas
 * - Não aplicam punição automática nesta fase
 * 
 * Sem punição automática nesta fase:
 * - Nenhum método aplica penalidade ou reputação
 * - Nenhum método chama penalty service ou reputation service
 * - "No-show" só vira failed por comando explícito (markFailed)
 * 
 * Agenda é referência, sem lock:
 * - time_window_ref é apenas referência informacional (JSONB)
 * - NÃO cria lock, NÃO valida disponibilidade
 * - NÃO escreve na Agenda Universal
 * - NÃO chama createAvailability, createBooking, reserve, lock, hold
 * 
 * NÃO chama:
 * - economy/ledger/custody/split
 * - voting/reputation/penalty
 * - unifiedAvailabilityService.createAvailability (ou qualquer write)
 * 
 * Se existir qualquer doc legado dizendo penalidade automática,
 * marcar como LEGADO e não executar.
 */

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import type {
  OperationalCommitment,
  CreateOperationalCommitmentInput,
  CheckInInput,
  CheckOutInput,
  MarkFailedInput,
  OperationalCommitmentStatus,
} from './operational-commitments.types';
import { assertTransitionAllowed } from './operational-commitments.aggregate';

interface OperationalCommitmentRow {
  id: string;
  event_id: string;
  global_user_id: string | null;
  role: string;
  assigned_by_global_user_id: string | null;
  created_at: Date;
  updated_at: Date | null;
  responsible_actor_id: string | null;
  responsible_actor_type: string | null;
  status: string | null;
  time_window_ref: Record<string, any> | null;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
  failure_reason: string | null;
  source: string | null;
}

class OperationalCommitmentsService {
  /**
   * Converte OperationalCommitmentRow para OperationalCommitment
   */
  private toCommitment(row: OperationalCommitmentRow, tenantId: string): OperationalCommitment {
    return {
      id: row.id,
      eventId: row.event_id,
      tenantId: tenantId,
      responsibleActorId: row.responsible_actor_id || '',
      responsibleActorType: (row.responsible_actor_type || 'user') as 'user' | 'page' | 'group' | 'channel',
      role: row.role,
      status: (row.status || 'expected') as OperationalCommitmentStatus,
      timeWindowRef: row.time_window_ref as any,
      checkedInAt: row.checked_in_at ? row.checked_in_at.toISOString() : null,
      checkedOutAt: row.checked_out_at ? row.checked_out_at.toISOString() : null,
      failureReason: row.failure_reason,
      source: (row.source || 'legacy') as 'legacy' | 'v2',
      createdAt: row.created_at.toISOString(),
      updatedAt: (row.updated_at || row.created_at).toISOString(),
      globalUserId: row.global_user_id,
      assignedByGlobalUserId: row.assigned_by_global_user_id,
    };
  }

  /**
   * Cria um novo OperationalCommitment
   * 
   * Regras:
   * - Validar existência do evento
   * - Validar actor explícito (não aceitar vazio)
   * - Status inicial: 'expected'
   * - NÃO chamar economy/agenda/reputation
   */
  async createCommitment(
    tenantId: string,
    input: CreateOperationalCommitmentInput
  ): Promise<OperationalCommitment> {
    // 1. Validar que evento existe
    const event = await runQueryWithTenant<{ id: string; tenant_id: string }>(
      tenantId,
      `
      SELECT id, tenant_id
      FROM events
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [input.eventId, tenantId]
    );

    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Validar actor explícito (obrigatório)
    if (!input.responsibleActorId || !input.responsibleActorType) {
      throw new BadRequestError('responsibleActorId e responsibleActorType são obrigatórios');
    }

    // 3. Validar que actor existe
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
      [tenantId, input.responsibleActorId, input.responsibleActorType]
    );

    if (!actor) {
      throw new BadRequestError(`Actor '${input.responsibleActorId}' (${input.responsibleActorType}) não encontrado`);
    }

    // 4. Criar commitment (status inicial: 'expected')
    const row = await runQueryWithTenant<OperationalCommitmentRow>(
      tenantId,
      `
      INSERT INTO event_staff (
        event_id,
        responsible_actor_id,
        responsible_actor_type,
        role,
        status,
        time_window_ref,
        source,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
      `,
      [
        input.eventId,
        input.responsibleActorId,
        input.responsibleActorType,
        input.role,
        'expected',
        input.timeWindowRef ? JSON.stringify(input.timeWindowRef) : null,
        'v2',
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar commitment');
    }

    return this.toCommitment(row, tenantId);
  }

  /**
   * Check-in (expected -> checked_in)
   * 
   * Regras:
   * - Validar transição via aggregate
   * - Registrar timestamp
   * - NÃO aplicar punição
   * - NÃO chamar agenda write
   */
  async checkIn(
    tenantId: string,
    commitmentId: string,
    input: CheckInInput
  ): Promise<OperationalCommitment> {
    // 1. Buscar commitment
    const commitment = await this.getCommitment(tenantId, commitmentId);
    if (!commitment) {
      throw new NotFoundError('Commitment não encontrado');
    }

    // 2. Validar transição via aggregate
    assertTransitionAllowed(commitment.status, 'checked_in');

    // 3. Registrar check-in (fato)
    const observedAt = input.observedAt || new Date().toISOString();

    const row = await runQueryWithTenant<OperationalCommitmentRow>(
      tenantId,
      `
      UPDATE event_staff
      SET 
        status = 'checked_in',
        checked_in_at = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [observedAt, commitmentId]
    );

    if (!row) {
      throw new Error('Falha ao registrar check-in');
    }

    return this.toCommitment(row, tenantId);
  }

  /**
   * Check-out (checked_in -> checked_out)
   * 
   * Regras:
   * - Validar transição via aggregate
   * - Registrar timestamp
   * - NÃO aplicar punição
   * - NÃO chamar agenda write
   */
  async checkOut(
    tenantId: string,
    commitmentId: string,
    input: CheckOutInput
  ): Promise<OperationalCommitment> {
    // 1. Buscar commitment
    const commitment = await this.getCommitment(tenantId, commitmentId);
    if (!commitment) {
      throw new NotFoundError('Commitment não encontrado');
    }

    // 2. Validar transição via aggregate
    assertTransitionAllowed(commitment.status, 'checked_out');

    // 3. Registrar check-out (fato)
    const observedAt = input.observedAt || new Date().toISOString();

    const row = await runQueryWithTenant<OperationalCommitmentRow>(
      tenantId,
      `
      UPDATE event_staff
      SET 
        status = 'checked_out',
        checked_out_at = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [observedAt, commitmentId]
    );

    if (!row) {
      throw new Error('Falha ao registrar check-out');
    }

    return this.toCommitment(row, tenantId);
  }

  /**
   * Marcar como failed (* -> failed, exceto checked_out)
   * 
   * Regras:
   * - Validar transição via aggregate
   * - Registrar failure_reason
   * - NÃO aplicar punição automática
   * - NÃO chamar reputation/penalty
   */
  async markFailed(
    tenantId: string,
    commitmentId: string,
    input: MarkFailedInput
  ): Promise<OperationalCommitment> {
    // 1. Buscar commitment
    const commitment = await this.getCommitment(tenantId, commitmentId);
    if (!commitment) {
      throw new NotFoundError('Commitment não encontrado');
    }

    // 2. Validar transição via aggregate
    assertTransitionAllowed(commitment.status, 'failed');

    // 3. Marcar como failed (fato)
    const row = await runQueryWithTenant<OperationalCommitmentRow>(
      tenantId,
      `
      UPDATE event_staff
      SET 
        status = 'failed',
        failure_reason = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [input.failureReason, commitmentId]
    );

    if (!row) {
      throw new Error('Falha ao marcar como failed');
    }

    return this.toCommitment(row, tenantId);
  }

  /**
   * Busca commitment por ID
   */
  async getCommitment(
    tenantId: string,
    commitmentId: string
  ): Promise<OperationalCommitment | null> {
    // Buscar via event_staff (herda tenant do event)
    const row = await runQueryWithTenant<OperationalCommitmentRow>(
      tenantId,
      `
      SELECT es.*, e.tenant_id
      FROM event_staff es
      INNER JOIN events e ON e.id = es.event_id
      WHERE es.id = $1 AND e.tenant_id = $2
      LIMIT 1
      `,
      [commitmentId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toCommitment(row, tenantId);
  }

  /**
   * Lista commitments por event_id
   */
  async listCommitmentsByEvent(
    tenantId: string,
    eventId: string
  ): Promise<OperationalCommitment[]> {
    const rows = await runQueriesWithTenant<OperationalCommitmentRow>(
      tenantId,
      `
      SELECT es.*, e.tenant_id
      FROM event_staff es
      INNER JOIN events e ON e.id = es.event_id
      WHERE es.event_id = $1 AND e.tenant_id = $2
      ORDER BY es.created_at DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(row => this.toCommitment(row, tenantId));
  }
}

export const operationalCommitmentsService = new OperationalCommitmentsService();


