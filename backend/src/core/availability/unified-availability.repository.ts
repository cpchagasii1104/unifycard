// src/core/availability/unified-availability.repository.ts
// Repository do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching
// 🔴 F-AVAILABILITY-CONFLICT-DETECTION-STUB-FIX (DT-AVAILABILITY-CONFLICT-DETECTION-STUB, 2026-07-02):
// NÃO há trigger/CHECK/EXCLUDE de overlap na criação/atualização de availability (comentário antigo
// era FALSO perante o schema vivo). Duas garantias REAIS e distintas: (1) o guard de double-booking
// do PRESTADOR é o advisory lock TRANSACIONAL no confirm canônico (confirmBookingWithProviderLock/
// confirmBookingWithResourceLock — DT-SERVICE-BOOKING-CONFIRM-BYPASSES-LOCK, CLOSED); (2) o aviso de
// conflito PESSOAL (owner_type='user') é `detect_availability_conflicts()`, materializada em
// 20260702140000, não-bloqueante — a decisão cabe sempre ao usuário.

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
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
import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
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
      purposeConceptId: row.purpose_concept_id ?? null, // DECISION-0132
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
   * 🔴 NÃO há trigger de overlap na criação (DT-AVAILABILITY-CONFLICT-DETECTION-STUB) — janelas
   *    sobrepostas do mesmo owner são permitidas aqui; o aviso (não-bloqueante) vem de
   *    detect_availability_conflicts() no booking, e o guard real de double-booking é o advisory
   *    lock do confirm canônico.
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
      purposeConceptId = null, // DECISION-0132
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
        start_datetime, end_datetime, timezone, capacity, purpose_concept_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        purposeConceptId, // DECISION-0132 (concept_id resolvido server-side; NULL permitido)
        JSON.stringify(metadata),
      ]
    );

    if (!row) {
      throw new BadRequestError('Failed to create availability');
    }

    return this.toUnifiedAvailability(row);
  }

  /** Nº de bookings ATIVOS (requested/confirmed/checked_in) ligados a uma janela — bloqueiam exclusão. */
  async countActiveBookings(tenantId: string, availabilityId: string): Promise<number> {
    const rows = await runQueriesWithTenant<{ n: string }>(tenantId,
      `SELECT count(*)::int AS n FROM bookings
        WHERE tenant_id = $1 AND availability_id = $2
          AND status IN ('requested','confirmed','checked_in')`,
      [tenantId, availabilityId]);
    return Number(rows[0]?.n ?? 0);
  }

  /** Remove uma janela de disponibilidade (hard delete — availability não tem soft-delete). O service
   *  valida autoridade + ausência de booking ativo ANTES de chamar. */
  async deleteAvailability(tenantId: string, availabilityId: string): Promise<void> {
    await runQueriesWithTenant(tenantId,
      `DELETE FROM availability WHERE tenant_id = $1 AND availability_id = $2`, [tenantId, availabilityId]);
  }

  /**
   * F-RENTAL-AVAILABILITY-OVERLAP: janelas ATIVAS do mesmo (owner_type, owner_id) que SOBREPÕEM o
   * intervalo [start, end). Condição canônica: new_start < existing_end AND new_end > existing_start.
   * A verdade temporal é do BANCO (SSOT). excludeId permite ignorar a própria janela numa edição.
   */
  async findOverlapping(
    tenantId: string, ownerType: string, ownerId: string, start: Date, end: Date, excludeId?: string
  ): Promise<UnifiedAvailability[]> {
    const params: unknown[] = [tenantId, ownerType, ownerId, start, end];
    let exclude = '';
    if (excludeId) { params.push(excludeId); exclude = ` AND availability_id <> $${params.length}`; }
    const rows = await runQueriesWithTenant<UnifiedAvailabilityRow>(
      tenantId,
      `SELECT * FROM availability
        WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3 AND status = 'active'
          AND start_datetime < $5 AND end_datetime > $4${exclude}
        ORDER BY start_datetime ASC`,
      params);
    return rows.map((r) => this.toUnifiedAvailability(r));
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
   * 🔴 NÃO há trigger de overlap na atualização (DT-AVAILABILITY-CONFLICT-DETECTION-STUB) — mesma
   *    nota de create() acima.
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
    if (input.purposeConceptId !== undefined) {
      // DECISION-0132: concept_id já resolvido server-side (uuid ou null); nunca slug cru.
      fields.push(`purpose_concept_id = $${paramIndex}`);
      params.push(input.purposeConceptId);
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
   * 🔴 F-OFFER-5/6 / DECISION-0146 — confirma um booking com GUARD de conflito por provider,
   * TRANSACIONAL e à prova de corrida. `availability` declara (NUNCA bloqueia); o COMPROMISSO (confirm)
   * recusa um 2º booking do MESMO `provider_actor_id` em status bloqueante {confirmed,checked_in,checked_out}
   * com intervalo `[start,end)` sobreposto (meio-aberto: back-to-back NÃO conflita; o próprio booking é
   * EXCLUÍDO). Rollup cross-oferta (provider, não service_offering isolada). `pg_advisory_xact_lock` por
   * tenant+provider serializa confirms concorrentes (libera no commit/rollback) — correto contra phantom.
   * Conflito = recusa fail-closed (Art. II: NUNCA auto-resolve/escolhe horário).
   */
  async confirmBookingWithProviderLock(
    tenantId: string,
    bookingId: string,
    providerActorId: string,
    startIso: string,
    endIso: string
  ): Promise<UnifiedBooking> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      // G7: lock xact-scoped por tenant+provider (libera automático no commit/rollback).
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${tenantId}:${providerActorId}`]);
      // G2/G3/G8: conflito = MESMO provider (via availability→service_offering) em status bloqueante,
      // intervalo [start,end) sobreposto, self EXCLUÍDO. (existing.start < cand.end AND existing.end > cand.start)
      const conflict = await client.query(
        `SELECT 1
           FROM bookings b2
           JOIN availability a2 ON a2.availability_id = b2.availability_id AND a2.tenant_id = b2.tenant_id
           JOIN service_offerings so2 ON so2.id = a2.owner_id AND so2.tenant_id = a2.tenant_id
          WHERE b2.tenant_id = $1
            AND a2.owner_type = 'service_offering'
            AND so2.provider_actor_id = $2
            AND b2.status IN ('confirmed','checked_in','checked_out')
            AND b2.booking_id <> $3
            AND a2.start_datetime < $5
            AND a2.end_datetime > $4
          LIMIT 1`,
        [tenantId, providerActorId, bookingId, startIso, endIso]
      );
      if (conflict.rows.length > 0) {
        throw new ConflictError('BOOKING_PROVIDER_TIME_CONFLICT: já existe compromisso confirmado do mesmo provider neste intervalo.');
      }
      // G4 (transição p/ status comprometido) + G_atomicidade: checagem e gravação na MESMA transação.
      const upd = await client.query(
        `UPDATE bookings SET status = 'confirmed', confirmed_at = now()
          WHERE tenant_id = $1 AND booking_id = $2 AND status = 'requested'
          RETURNING *`,
        [tenantId, bookingId]
      );
      if (upd.rows.length === 0) {
        throw new ConflictError('BOOKING_CONFIRM_INVALID_STATE: booking não está em estado requested.');
      }
      await client.query('COMMIT');
      return this.toUnifiedBooking(upd.rows[0] as UnifiedBookingRow);
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* tx pode já não estar ativa */ }
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * 🔴 DECISION-0151 FASE 2b — confirma booking de RECURSO ALUGÁVEL com EXCLUSIVIDADE por resource_id.
   * Análogo ao provider-lock, mas o conflito é por `availability.owner_id` (o recurso), NÃO por provider:
   * lock xact-scoped por tenant+resource; conflito = MESMO recurso em status bloqueante {confirmed,checked_in,
   * checked_out}, intervalo [start,end) sobreposto, self excluído; checagem+gravação na MESMA transação.
   * Impede duplo-aluguel do mesmo recurso. ZERO dinheiro/checkout/order. NÃO altera o provider-lock (P3).
   */
  async confirmBookingWithResourceLock(
    tenantId: string,
    bookingId: string,
    resourceId: string,
    startIso: string,
    endIso: string
  ): Promise<UnifiedBooking> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${tenantId}:rentable_resource:${resourceId}`]);
      const conflict = await client.query(
        `SELECT 1
           FROM bookings b2
           JOIN availability a2 ON a2.availability_id = b2.availability_id AND a2.tenant_id = b2.tenant_id
          WHERE b2.tenant_id = $1
            AND a2.owner_type = 'rentable_resource'
            AND a2.owner_id = $2
            AND b2.status IN ('confirmed','checked_in','checked_out')
            AND b2.booking_id <> $3
            AND a2.start_datetime < $5
            AND a2.end_datetime > $4
          LIMIT 1`,
        [tenantId, resourceId, bookingId, startIso, endIso]
      );
      if (conflict.rows.length > 0) {
        throw new ConflictError('RENTAL_RESOURCE_TIME_CONFLICT: já existe reserva confirmada deste recurso neste intervalo (DECISION-0151).');
      }
      const upd = await client.query(
        `UPDATE bookings SET status = 'confirmed', confirmed_at = now()
          WHERE tenant_id = $1 AND booking_id = $2 AND status = 'requested'
          RETURNING *`,
        [tenantId, bookingId]
      );
      if (upd.rows.length === 0) {
        throw new ConflictError('BOOKING_CONFIRM_INVALID_STATE: booking não está em estado requested.');
      }
      await client.query('COMMIT');
      return this.toUnifiedBooking(upd.rows[0] as UnifiedBookingRow);
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* tx pode já não estar ativa */ }
      throw e;
    } finally {
      client.release();
    }
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


