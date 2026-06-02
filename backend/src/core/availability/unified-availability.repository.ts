// src/core/availability/unified-availability.repository.ts
// Repository do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching
// 🔴 BLINDAGEM: Evita sobreposição de horários por owner (via trigger)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  UnifiedAvailability,
  UnifiedAvailabilityRow,
  UnifiedBooking,
  UnifiedBookingRow,
  CreateUnifiedAvailabilityInput,
  UpdateUnifiedAvailabilityInput,
  CreateUnifiedBookingInput,
  UpdateUnifiedBookingInput,
  UnifiedAvailabilityFilters,
  UnifiedBookingFilters,
  AvailabilityParticipant,
  AvailabilityParticipantRow,
  CreateAvailabilityParticipantInput,
  UpdateAvailabilityParticipantInput,
  AvailabilityParticipantFilters,
  AvailabilityConflict,
  ConflictDetectionResult,
} from './unified-availability.types';
import { BadRequestError, NotFoundError } from '@core/errors';
import { UnifiedAvailabilityStatus, UnifiedBookingStatus, ParticipantRole } from './unified-availability.types';

class UnifiedAvailabilityRepository {
  /**
   * Converte UnifiedAvailabilityRow para UnifiedAvailability
   */
  private toUnifiedAvailability(row: UnifiedAvailabilityRow): UnifiedAvailability {
    return {
      availabilityId: row.availability_id,
      tenantId: row.tenant_id,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      availabilityType: row.availability_type,
      status: row.status,
      startDatetime: row.start_datetime,
      endDatetime: row.end_datetime,
      timezone: row.timezone,
      capacity: row.capacity || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte UnifiedBookingRow para UnifiedBooking
   */
  private toUnifiedBooking(row: UnifiedBookingRow): UnifiedBooking {
    // B+A1 convergência: schema canônico do banco usa snake_case
    // (requested_at, checked_in_at, checked_out_at, cancelled_at, expired_at, confirmed_at).
    // Mapeamento anterior misturava camelCase no acesso ao row — campos retornavam undefined
    // e `.toISOString()` quebrava em runtime (descoberto via smoke B+A 2026-05-14).
    return {
      bookingId: row.booking_id,
      tenantId: row.tenant_id,
      availabilityId: row.availability_id,
      requesterActorId: row.requester_actor_id,
      status: row.status,
      requestedAt: row.requested_at,
      checkedInAt: row.checked_in_at || undefined,
      checkedOutAt: row.checked_out_at || undefined,
      notes: row.notes || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelledAt: row.cancelled_at || undefined,
      expiredAt: row.expired_at || undefined,
      confirmedAt: row.confirmed_at || undefined,
    };
  }

  /**
   * Cria uma nova disponibilidade
   * 🔴 BLINDAGEM: ownerType e ownerId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Trigger previne sobreposição de horários por owner
   */
  async create(
    tenantId: string,
    input: CreateUnifiedAvailabilityInput
  ): Promise<UnifiedAvailability> {
    const {
      ownerType,
      ownerId,
      availabilityType = 'fixed',
      status = UnifiedAvailabilityStatus.ACTIVE,
      startDatetime,
      endDatetime,
      timezone = 'America/Sao_Paulo',
      capacity = null,
      metadata = {},
    } = input;

    if (!ownerType) {
      throw new BadRequestError('ownerType é obrigatório para criar disponibilidade');
    }
    if (!ownerId) {
      throw new BadRequestError('ownerId é obrigatório para criar disponibilidade');
    }
    if (!startDatetime || !endDatetime) {
      throw new BadRequestError('startDatetime e endDatetime são obrigatórios');
    }
    if (endDatetime <= startDatetime) {
      throw new BadRequestError('endDatetime deve ser posterior a startDatetime');
    }

    const row = await runQueryWithTenant<UnifiedAvailabilityRow>(
      tenantId,
      `
      INSERT INTO availability (
        tenant_id, owner_type, owner_id, availability_type, status,
        start_datetime, end_datetime, timezone, capacity, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        tenantId,
        ownerType,
        ownerId,
        availabilityType,
        status,
        startDatetime,
        endDatetime,
        timezone,
        capacity,
        JSON.stringify(metadata),
      ]
    );

    if (!row) {
      throw new BadRequestError('Failed to create availability');
    }

    return this.toUnifiedAvailability(row);
  }

  /**
   * Busca disponibilidade por ID
   */
  async findAvailabilityById(tenantId: string, availabilityId: string): Promise<UnifiedAvailability | null> {
    const row = await runQueryWithTenant<UnifiedAvailabilityRow>(
      tenantId,
      `SELECT * FROM availability WHERE availability_id = $1 AND tenant_id = $2`,
      [availabilityId, tenantId]
    );
    return row ? this.toUnifiedAvailability(row) : null;
  }

  /**
   * Lista disponibilidades com filtros
   * 🔴 BLINDAGEM: Ordenação apenas por start_datetime ASC
   */
  async findAvailabilities(
    tenantId: string,
    filters: UnifiedAvailabilityFilters
  ): Promise<UnifiedAvailability[]> {
    let query = `SELECT * FROM availability WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.ownerType) {
      query += ` AND owner_type = $${paramIndex}`;
      params.push(filters.ownerType);
      paramIndex++;
    }
    if (filters.ownerId) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(filters.ownerId);
      paramIndex++;
    }
    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters.startDatetime) {
      query += ` AND end_datetime >= $${paramIndex}`;
      params.push(filters.startDatetime);
      paramIndex++;
    }
    if (filters.endDatetime) {
      query += ` AND start_datetime <= $${paramIndex}`;
      params.push(filters.endDatetime);
      paramIndex++;
    }

    // 🔴 BLINDAGEM: Ordenação apenas por start_datetime ASC (mais antigo primeiro)
    query += ` ORDER BY start_datetime ASC`;

    const rows = await runQueriesWithTenant<UnifiedAvailabilityRow>(tenantId, query, params);
    return rows.map(this.toUnifiedAvailability);
  }

  /**
   * Atualiza disponibilidade
   * 🔴 BLINDAGEM: Trigger previne sobreposição de horários por owner
   */
  async updateAvailability(
    tenantId: string,
    availabilityId: string,
    input: UpdateUnifiedAvailabilityInput
  ): Promise<UnifiedAvailability> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.availabilityType !== undefined) {
      fields.push(`availability_type = $${paramIndex}`);
      params.push(input.availabilityType);
      paramIndex++;
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }
    if (input.startDatetime !== undefined) {
      fields.push(`start_datetime = $${paramIndex}`);
      params.push(input.startDatetime);
      paramIndex++;
    }
    if (input.endDatetime !== undefined) {
      fields.push(`end_datetime = $${paramIndex}`);
      params.push(input.endDatetime);
      paramIndex++;
    }
    if (input.timezone !== undefined) {
      fields.push(`timezone = $${paramIndex}`);
      params.push(input.timezone);
      paramIndex++;
    }
    if (input.capacity !== undefined) {
      fields.push(`capacity = $${paramIndex}`);
      params.push(input.capacity);
      paramIndex++;
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (fields.length === 0) {
      const existing = await this.findAvailabilityById(tenantId, availabilityId);
      if (!existing) throw new NotFoundError('Availability not found');
      return existing;
    }

    // 🔴 FIX (F1/DECISION-0072): off-by-one de índice de parâmetro. O `paramIndex += 2` deslocava o
    // WHERE para `$(N+1)/$(N+2)` enquanto availabilityId/tenantId ficavam em `$N/$(N+1)` → o param de
    // availabilityId virava NÃO-referenciado e o Postgres não inferia seu tipo (42P18), quebrando TODO
    // update de availability (inclusive PUT /:id vivo). Indexamos pelos índices reais (1-based) dos
    // valores recém-empilhados.
    params.push(availabilityId, tenantId);
    const idIndex = params.length - 1; // posição 1-based de availabilityId
    const tenantIndex = params.length; // posição 1-based de tenantId

    const row = await runQueryWithTenant<UnifiedAvailabilityRow>(
      tenantId,
      `
      UPDATE availability
      SET ${fields.join(', ')}, updated_at = now()
      WHERE availability_id = $${idIndex} AND tenant_id = $${tenantIndex}
      RETURNING *
      `,
      params
    );

    if (!row) {
      throw new NotFoundError('Availability not found or failed to update');
    }

    return this.toUnifiedAvailability(row);
  }

  /**
   * Cria um novo booking
   * 🔴 BLINDAGEM: availabilityId e requesterActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: NÃO executa pagamento
   */
  async createBooking(
    tenantId: string,
    input: CreateUnifiedBookingInput,
    trx?: { query: (q: { text: string; values?: any[] }) => Promise<any[]> }
  ): Promise<UnifiedBooking> {
    const {
      availabilityId,
      requesterActorId,
      notes = null,
      metadata = {},
    } = input;

    if (!availabilityId) {
      throw new BadRequestError('availabilityId é obrigatório para criar booking');
    }
    if (!requesterActorId) {
      throw new BadRequestError('requesterActorId é obrigatório para criar booking');
    }

    const insertQuery = {
      text: `
        INSERT INTO bookings (
          tenant_id, availability_id, requester_actor_id, status, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      values: [
        tenantId,
        availabilityId,
        requesterActorId,
        UnifiedBookingStatus.REQUESTED,
        notes,
        JSON.stringify(metadata),
      ],
    };

    let row: UnifiedBookingRow | undefined;

    if (trx) {
      const rows = await trx.query(insertQuery);
      row = rows[0] as UnifiedBookingRow | undefined;
    } else {
      row = await runQueryWithTenant<UnifiedBookingRow>(tenantId, insertQuery.text, insertQuery.values);
    }

    if (!row) {
      throw new BadRequestError('Failed to create booking');
    }

    return this.toUnifiedBooking(row);
  }

  /**
   * Busca booking por ID
   */
  async findBookingById(tenantId: string, bookingId: string): Promise<UnifiedBooking | null> {
    const row = await runQueryWithTenant<UnifiedBookingRow>(
      tenantId,
      `SELECT * FROM bookings WHERE booking_id = $1 AND tenant_id = $2`,
      [bookingId, tenantId]
    );
    return row ? this.toUnifiedBooking(row) : null;
  }

  /**
   * Lista bookings com filtros
   */
  async findBookings(
    tenantId: string,
    filters: UnifiedBookingFilters
  ): Promise<UnifiedBooking[]> {
    let query = `SELECT * FROM bookings WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.availabilityId) {
      query += ` AND availability_id = $${paramIndex}`;
      params.push(filters.availabilityId);
      paramIndex++;
    }
    if (filters.requesterActorId) {
      query += ` AND requester_actor_id = $${paramIndex}`;
      params.push(filters.requesterActorId);
      paramIndex++;
    }
    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY requested_at DESC`;

    const rows = await runQueriesWithTenant<UnifiedBookingRow>(tenantId, query, params);
    return rows.map(this.toUnifiedBooking);
  }

  /**
   * Atualiza booking
   * 🔴 BLINDAGEM: NÃO executa pagamento
   */
  async updateBooking(
    tenantId: string,
    bookingId: string,
    input: UpdateUnifiedBookingInput
  ): Promise<UnifiedBooking> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;

      // Atualizar timestamps baseado no status
      if (input.status === UnifiedBookingStatus.CONFIRMED) {
        fields.push(`confirmed_at = now()`);
      } else if (input.status === UnifiedBookingStatus.CANCELLED) {
        fields.push(`cancelled_at = now()`);
      } else if (input.status === UnifiedBookingStatus.EXPIRED) {
        fields.push(`expired_at = now()`);
      }
    }
    if (input.notes !== undefined) {
      fields.push(`notes = $${paramIndex}`);
      params.push(input.notes);
      paramIndex++;
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (fields.length === 0) {
      const existing = await this.findBookingById(tenantId, bookingId);
      if (!existing) throw new NotFoundError('Booking not found');
      return existing;
    }

    // B+A1 fix: paramIndex aponta para o PRÓXIMO placeholder disponível.
    // bookingId vai em $paramIndex; tenantId em $paramIndex+1.
    const bookingParamIdx = paramIndex;
    const tenantParamIdx = paramIndex + 1;
    params.push(bookingId, tenantId);

    const row = await runQueryWithTenant<UnifiedBookingRow>(
      tenantId,
      `
      UPDATE bookings
      SET ${fields.join(', ')}, updated_at = now()
      WHERE booking_id = $${bookingParamIdx} AND tenant_id = $${tenantParamIdx}
      RETURNING *
      `,
      params
    );

    if (!row) {
      throw new NotFoundError('Booking not found or failed to update');
    }

    return this.toUnifiedBooking(row);
  }

  /**
   * Realiza check-in
   * 🔴 BLINDAGEM: Check-in é apenas registro, NÃO executa pagamento
   */
  async checkIn(
    tenantId: string,
    bookingId: string,
    metadata?: Record<string, any>
  ): Promise<UnifiedBooking> {
    const row = await runQueryWithTenant<UnifiedBookingRow>(
      tenantId,
      `
      UPDATE bookings
      SET 
        status = 'checked_in',
        checked_in_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || $1,
        updated_at = now()
      WHERE booking_id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [JSON.stringify(metadata || {}), bookingId, tenantId]
    );

    if (!row) {
      throw new NotFoundError('Booking not found or failed to check in');
    }

    return this.toUnifiedBooking(row);
  }

  /**
   * Realiza check-out
   * 🔴 BLINDAGEM: Check-out é apenas registro, NÃO executa pagamento
   */
  async checkOut(
    tenantId: string,
    bookingId: string,
    metadata?: Record<string, any>
  ): Promise<UnifiedBooking> {
    const row = await runQueryWithTenant<UnifiedBookingRow>(
      tenantId,
      `
      UPDATE bookings
      SET 
        status = 'checked_out',
        checked_out_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || $1,
        updated_at = now()
      WHERE booking_id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [JSON.stringify(metadata || {}), bookingId, tenantId]
    );

    if (!row) {
      throw new NotFoundError('Booking not found or failed to check out');
    }

    return this.toUnifiedBooking(row);
  }

  /**
   * Converte AvailabilityParticipantRow para AvailabilityParticipant
   */
  private toAvailabilityParticipant(row: AvailabilityParticipantRow): AvailabilityParticipant {
    return {
      participantId: row.participant_id,
      tenantId: row.tenant_id,
      availabilityId: row.availability_id,
      actorId: row.actor_id,
      role: row.role,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria um novo participante
   * 🔴 BLINDAGEM: availabilityId e actorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: NÃO bloqueia automaticamente conflitos
   */
  async createParticipant(
    tenantId: string,
    input: CreateAvailabilityParticipantInput
  ): Promise<AvailabilityParticipant> {
    const {
      availabilityId,
      actorId,
      role = ParticipantRole.PARTICIPANTE,
      metadata = {},
    } = input;

    if (!availabilityId) {
      throw new BadRequestError('availabilityId é obrigatório para criar participante');
    }
    if (!actorId) {
      throw new BadRequestError('actorId é obrigatório para criar participante');
    }

    const row = await runQueryWithTenant<AvailabilityParticipantRow>(
      tenantId,
      `
      INSERT INTO availability_participants (
        tenant_id, availability_id, actor_id, role, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        tenantId,
        availabilityId,
        actorId,
        role,
        JSON.stringify(metadata),
      ]
    );

    if (!row) {
      throw new BadRequestError('Failed to create participant');
    }

    return this.toAvailabilityParticipant(row);
  }

  /**
   * Busca participante por ID
   */
  async findParticipantById(tenantId: string, participantId: string): Promise<AvailabilityParticipant | null> {
    const row = await runQueryWithTenant<AvailabilityParticipantRow>(
      tenantId,
      `SELECT * FROM availability_participants WHERE participant_id = $1 AND tenant_id = $2`,
      [participantId, tenantId]
    );
    return row ? this.toAvailabilityParticipant(row) : null;
  }

  /**
   * Lista participantes com filtros
   */
  async findParticipants(
    tenantId: string,
    filters: AvailabilityParticipantFilters
  ): Promise<AvailabilityParticipant[]> {
    let query = `SELECT * FROM availability_participants WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.availabilityId) {
      query += ` AND availability_id = $${paramIndex}`;
      params.push(filters.availabilityId);
      paramIndex++;
    }
    if (filters.actorId) {
      query += ` AND actor_id = $${paramIndex}`;
      params.push(filters.actorId);
      paramIndex++;
    }
    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    query += ` ORDER BY created_at ASC`;

    const rows = await runQueriesWithTenant<AvailabilityParticipantRow>(tenantId, query, params);
    return rows.map(this.toAvailabilityParticipant);
  }

  /**
   * Atualiza participante
   */
  async updateParticipant(
    tenantId: string,
    participantId: string,
    input: UpdateAvailabilityParticipantInput
  ): Promise<AvailabilityParticipant> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.role !== undefined) {
      fields.push(`role = $${paramIndex}`);
      params.push(input.role);
      paramIndex++;
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (fields.length === 0) {
      const existing = await this.findParticipantById(tenantId, participantId);
      if (!existing) throw new NotFoundError('Participant not found');
      return existing;
    }

    params.push(participantId, tenantId);
    paramIndex += 2;

    const row = await runQueryWithTenant<AvailabilityParticipantRow>(
      tenantId,
      `
      UPDATE availability_participants
      SET ${fields.join(', ')}, updated_at = now()
      WHERE participant_id = $${paramIndex - 1} AND tenant_id = $${paramIndex}
      RETURNING *
      `,
      params
    );

    if (!row) {
      throw new NotFoundError('Participant not found or failed to update');
    }

    return this.toAvailabilityParticipant(row);
  }

  /**
   * Remove participante
   */
  async deleteParticipant(tenantId: string, participantId: string): Promise<void> {
    const result = await runQueryWithTenant<{ count: number }>(
      tenantId,
      `
      DELETE FROM availability_participants
      WHERE participant_id = $1 AND tenant_id = $2
      RETURNING 1 as count
      `,
      [participantId, tenantId]
    );

    if (!result) {
      throw new NotFoundError('Participant not found');
    }
  }

  /**
   * Detecta conflitos de horário para um participante
   * 🔴 BLINDAGEM: Esta função DETECTA conflitos, NÃO bloqueia
   * 🔴 BLINDAGEM: A confirmação cabe ao usuário
   * Retorna lista de conflitos encontrados (apenas informação, não decisão)
   */
  async detectConflicts(
    tenantId: string,
    availabilityId: string,
    actorId: string
  ): Promise<ConflictDetectionResult> {
    // 🔴 BLINDAGEM: Validar que availability existe
    const availability = await this.findAvailabilityById(tenantId, availabilityId);
    if (!availability) {
      throw new NotFoundError('Availability not found');
    }

    // 🔴 BLINDAGEM: Chamar função do banco que DETECTA conflitos (não bloqueia)
    const conflicts = await runQueriesWithTenant<{
      conflict_availability_id: string;
      conflict_start_datetime: Date;
      conflict_end_datetime: Date;
      conflict_owner_type: string;
      conflict_owner_id: string;
    }>(
      tenantId,
      `SELECT * FROM detect_availability_conflicts($1, $2, $3)`,
      [tenantId, availabilityId, actorId]
    );

    const mappedConflicts: AvailabilityConflict[] = conflicts.map(c => ({
      conflictAvailabilityId: c.conflict_availability_id,
      conflictStartDatetime: c.conflict_start_datetime,
      conflictEndDatetime: c.conflict_end_datetime,
      conflictOwnerType: c.conflict_owner_type as any,
      conflictOwnerId: c.conflict_owner_id,
    }));

    return {
      hasConflicts: mappedConflicts.length > 0,
      conflicts: mappedConflicts,
      message: mappedConflicts.length > 0
        ? `Foram detectados ${mappedConflicts.length} conflito(s) de horário. A confirmação cabe ao usuário.`
        : undefined,
    };
  }
}

export const unifiedAvailabilityRepository = new UnifiedAvailabilityRepository();


