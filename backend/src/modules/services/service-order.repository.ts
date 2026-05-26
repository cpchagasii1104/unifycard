// backend/src/modules/services/service-order.repository.ts
// SPRINT 68: Repository para service_orders

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ServiceOrder,
  ServiceOrderFilters,
  ServiceOrderSettlementFlow,
} from './service-order.types';

interface ServiceOrderRow {
  id: string;
  tenant_id: string;
  service_id: string;
  worker_actor_id: string;
  customer_actor_id: string;
  booking_id: string | null;
  decision_id: string | null;
  status: string;
  // F1 (Camada 1 saída) — 2026-05-26
  settlement_flow: string;
  buyer_confirmation_deadline_at: Date | null;
  buyer_confirmed_completion_at: Date | null;
  release_eligible_at: Date | null;
  disputed_at: Date | null;
  dispute_id: string | null;
  scheduled_start: Date;
  scheduled_end: Date | null;
  estimated_duration_minutes: number | null;
  location_address: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  description: string | null;
  customer_notes: string | null;
  worker_notes: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  confirmed_at: Date | null;
  confirmed_by_actor_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class ServiceOrderRepository {
  /**
   * Converte row para ServiceOrder
   */
  private toServiceOrder(row: ServiceOrderRow): ServiceOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      serviceId: row.service_id,
      workerActorId: row.worker_actor_id,
      customerActorId: row.customer_actor_id,
      bookingId: row.booking_id,
      decisionId: row.decision_id,
      status: row.status as any,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      estimatedDurationMinutes: row.estimated_duration_minutes,
      locationAddress: row.location_address,
      locationLatitude: row.location_latitude ? parseFloat(row.location_latitude.toString()) : null,
      locationLongitude: row.location_longitude ? parseFloat(row.location_longitude.toString()) : null,
      description: row.description,
      customerNotes: row.customer_notes,
      workerNotes: row.worker_notes,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      confirmedAt: row.confirmed_at,
      confirmedByActorId: row.confirmed_by_actor_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      // F1 (Camada 1 saída) — 2026-05-26
      settlementFlow: row.settlement_flow as ServiceOrderSettlementFlow,
      buyerConfirmationDeadlineAt: row.buyer_confirmation_deadline_at,
      buyerConfirmedCompletionAt: row.buyer_confirmed_completion_at,
      releaseEligibleAt: row.release_eligible_at,
      disputedAt: row.disputed_at,
      disputeId: row.dispute_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria ordem de serviço
   */
  async createOrder(
    tenantId: string,
    input: {
      serviceId: string;
      workerActorId: string;
      customerActorId: string;
      bookingId: string | null;
      decisionId: string | null;
      scheduledStart: Date;
      scheduledEnd: Date | null;
      estimatedDurationMinutes: number | null;
      locationAddress: string | null;
      locationLatitude: number | null;
      locationLongitude: number | null;
      description: string | null;
      customerNotes: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<ServiceOrder> {
    const row = await runQueryWithTenant<ServiceOrderRow>(
      tenantId,
      `
      INSERT INTO service_orders (
        tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
        status, scheduled_start, scheduled_end, estimated_duration_minutes,
        location_address, location_latitude, location_longitude,
        description, customer_notes,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.serviceId,
        input.workerActorId,
        input.customerActorId,
        input.bookingId,
        input.decisionId,
        'draft',
        input.scheduledStart,
        input.scheduledEnd,
        input.estimatedDurationMinutes,
        input.locationAddress,
        input.locationLatitude,
        input.locationLongitude,
        input.description,
        input.customerNotes,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar ordem de serviço');
    }

    return this.toServiceOrder(row);
  }

  /**
   * Busca ordem por ID
   */
  async getOrderById(tenantId: string, orderId: string): Promise<ServiceOrder | null> {
    const rows = await runQueriesWithTenant<ServiceOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
             status,
             settlement_flow,
             buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
             release_eligible_at, disputed_at, dispute_id,
             scheduled_start, scheduled_end, estimated_duration_minutes,
             location_address, location_latitude, location_longitude,
             description, customer_notes, worker_notes,
             created_by_actor_id, created_by_user_id,
             confirmed_at, confirmed_by_actor_id,
             started_at, completed_at, cancelled_at, cancellation_reason,
             metadata, created_at, updated_at
      FROM service_orders
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, orderId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toServiceOrder(rows[0]);
  }

  /**
   * Lista ordens com filtros
   */
  async listOrders(tenantId: string, filters: ServiceOrderFilters = {}): Promise<ServiceOrder[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.serviceId) {
      conditions.push(`service_id = $${paramIndex}`);
      params.push(filters.serviceId);
      paramIndex++;
    }

    if (filters.workerActorId) {
      conditions.push(`worker_actor_id = $${paramIndex}`);
      params.push(filters.workerActorId);
      paramIndex++;
    }

    if (filters.customerActorId) {
      conditions.push(`customer_actor_id = $${paramIndex}`);
      params.push(filters.customerActorId);
      paramIndex++;
    }

    if (filters.bookingId) {
      conditions.push(`booking_id = $${paramIndex}`);
      params.push(filters.bookingId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.scheduledStartFrom) {
      conditions.push(`scheduled_start >= $${paramIndex}`);
      params.push(filters.scheduledStartFrom);
      paramIndex++;
    }

    if (filters.scheduledStartTo) {
      conditions.push(`scheduled_start <= $${paramIndex}`);
      params.push(filters.scheduledStartTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<ServiceOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
             status,
             settlement_flow,
             buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
             release_eligible_at, disputed_at, dispute_id,
             scheduled_start, scheduled_end, estimated_duration_minutes,
             location_address, location_latitude, location_longitude,
             description, customer_notes, worker_notes,
             created_by_actor_id, created_by_user_id,
             confirmed_at, confirmed_by_actor_id,
             started_at, completed_at, cancelled_at, cancellation_reason,
             metadata, created_at, updated_at
      FROM service_orders
      WHERE ${conditions.join(' AND ')}
      ORDER BY scheduled_start DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toServiceOrder(row));
  }

  /**
   * Atualiza status para CONFIRMED
   */
  async confirmOrder(
    tenantId: string,
    orderId: string,
    confirmedByActorId: string
  ): Promise<ServiceOrder> {
    const row = await runQueryWithTenant<ServiceOrderRow>(
      tenantId,
      `
      UPDATE service_orders
      SET status = 'confirmed',
          confirmed_at = NOW(),
          confirmed_by_actor_id = $3,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'draft'
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
      `,
      [tenantId, orderId, confirmedByActorId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em DRAFT');
    }

    return this.toServiceOrder(row);
  }

  /**
   * Atualiza status para IN_PROGRESS
   */
  async startOrder(
    tenantId: string,
    orderId: string,
    workerNotes: string | null
  ): Promise<ServiceOrder> {
    const row = await runQueryWithTenant<ServiceOrderRow>(
      tenantId,
      `
      UPDATE service_orders
      SET status = 'in_progress',
          started_at = NOW(),
          worker_notes = COALESCE($3, worker_notes),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'confirmed'
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
      `,
      [tenantId, orderId, workerNotes]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em CONFIRMED');
    }

    return this.toServiceOrder(row);
  }

  /**
   * Atualiza status para COMPLETED
   */
  async completeOrder(
    tenantId: string,
    orderId: string,
    workerNotes: string | null
  ): Promise<ServiceOrder> {
    const row = await runQueryWithTenant<ServiceOrderRow>(
      tenantId,
      `
      UPDATE service_orders
      SET status = 'completed',
          completed_at = NOW(),
          worker_notes = COALESCE($3, worker_notes),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'in_progress'
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
      `,
      [tenantId, orderId, workerNotes]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em IN_PROGRESS');
    }

    return this.toServiceOrder(row);
  }

  /**
   * F1 (Camada 1 saída — 2026-05-26): in_progress → seller_pending.
   *
   * Aplicável quando a service order tem settlement_flow='fixed_price_escrow'.
   * O service layer decide o caminho; o repository só executa o UPDATE
   * atômico carimbando os campos F1.
   *
   * Atomicidade: aceita PoolClient externo (pattern existingClient —
   * espelha service-payment-execution.service.ts:createExecution após
   * commit 1352d9da e bank-transaction.service.ts:262-269). O caller
   * orquestra BEGIN/COMMIT/ROLLBACK + INSERT event_outbox na mesma tx.
   *
   * Quando executingClient ausente: usa runQueryWithTenant (tx própria —
   * caminho legado preservado para retrocompatibilidade).
   *
   * NÃO TOCA DINHEIRO. Só estado + carimbos.
   */
  async markAsSellerPending(
    tenantId: string,
    orderId: string,
    deadlineAt: Date,
    releaseEligibleAt: Date,
    workerNotes: string | null,
    executingClient?: PoolClient
  ): Promise<ServiceOrder> {
    const sql = `
      UPDATE service_orders
      SET status = 'seller_pending',
          completed_at = NOW(),
          buyer_confirmation_deadline_at = $3,
          release_eligible_at = $4,
          worker_notes = COALESCE($5, worker_notes),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'in_progress'
        AND settlement_flow = 'fixed_price_escrow'
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
    `;
    const params = [tenantId, orderId, deadlineAt, releaseEligibleAt, workerNotes];

    let row: ServiceOrderRow | undefined;
    if (executingClient) {
      const result = await executingClient.query<ServiceOrderRow>(sql, params);
      row = result.rows[0];
    } else {
      row = await runQueryWithTenant<ServiceOrderRow>(tenantId, sql, params);
    }

    if (!row) {
      throw new Error(
        'markAsSellerPending: ordem não está em in_progress + fixed_price_escrow, ou já foi processada'
      );
    }

    return this.toServiceOrder(row);
  }

  /**
   * D2 (Camada 1 saída — 2026-05-26): seller_pending → release_approved.
   *
   * Significado: "serviço APROVADO para futura liberação financeira" —
   * NÃO "fundos liberados". NÃO confundir com bank-account account_type=
   * 'seller_available' (saldo financeiro real lastreado pela ledger do Bank).
   *
   * Single SQL atômico carrega TODA a regra D2 nos WHEREs:
   *   - status='seller_pending'
   *   - settlement_flow='fixed_price_escrow'
   *   - disputed_at IS NULL (disputa bloqueia)
   *   - (buyerConfirmedAt fornecido OU release_eligible_at <= NOW())
   *
   * buyerConfirmedAt:
   *   - Quando preenchido (caller = buyer confirma): carimba
   *     buyer_confirmed_completion_at = $3 + ignora release_eligible_at.
   *   - Quando NULL (caller = timeout): exige release_eligible_at <= NOW()
   *     e mantém buyer_confirmed_completion_at NULL.
   *
   * Idempotência por estado: 2ª chamada com status já = release_approved
   * retorna rows=0 → método lança erro previsível. ON CONFLICT do outbox
   * (caller upstream) garante zero duplicação de eventos.
   *
   * NÃO TOCA DINHEIRO. Estado-only.
   */
  async approveServiceOrderRelease(
    tenantId: string,
    orderId: string,
    buyerConfirmedAt: Date | null,
    executingClient?: PoolClient
  ): Promise<ServiceOrder> {
    const sql = `
      UPDATE service_orders
      SET status = 'release_approved',
          buyer_confirmed_completion_at = COALESCE($3, buyer_confirmed_completion_at),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
        AND status = 'seller_pending'
        AND settlement_flow = 'fixed_price_escrow'
        AND disputed_at IS NULL
        AND (
          $3::timestamptz IS NOT NULL
          OR (release_eligible_at IS NOT NULL AND release_eligible_at <= NOW())
        )
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
    `;
    const params = [tenantId, orderId, buyerConfirmedAt];

    let row: ServiceOrderRow | undefined;
    if (executingClient) {
      const result = await executingClient.query<ServiceOrderRow>(sql, params);
      row = result.rows[0];
    } else {
      row = await runQueryWithTenant<ServiceOrderRow>(tenantId, sql, params);
    }

    if (!row) {
      throw new Error(
        'approveServiceOrderRelease: ordem não atende as condições D2 ' +
          '(status≠seller_pending, flow≠fixed_price_escrow, disputed_at preenchido, ' +
          'sem buyer confirm e release_eligible_at no futuro, ou já foi processada).'
      );
    }
    return this.toServiceOrder(row);
  }

  /**
   * D2 — listagem para o caller "timeout" (worker/script). Lista
   * service_orders elegíveis a approve-por-timeout (sem buyer confirm).
   *
   * Condições: status='seller_pending' + flow='fixed_price_escrow' +
   * disputed_at IS NULL + release_eligible_at <= NOW().
   *
   * Pure SELECT (NÃO consome com FOR UPDATE — o atomicidade individual
   * vem do UPDATE filtrado em releaseToSellerAvailable). Caller pode
   * processar serialmente; race entre buyer e timeout sobre mesma row
   * é resolvido pela cláusula WHERE do UPDATE atômico.
   */
  async listExpiredSellerPending(
    tenantId: string,
    limit: number
  ): Promise<ServiceOrder[]> {
    const rows = await runQueriesWithTenant<ServiceOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
             status,
             settlement_flow,
             buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
             release_eligible_at, disputed_at, dispute_id,
             scheduled_start, scheduled_end, estimated_duration_minutes,
             location_address, location_latitude, location_longitude,
             description, customer_notes, worker_notes,
             created_by_actor_id, created_by_user_id,
             confirmed_at, confirmed_by_actor_id,
             started_at, completed_at, cancelled_at, cancellation_reason,
             metadata, created_at, updated_at
      FROM service_orders
      WHERE tenant_id = $1
        AND status = 'seller_pending'
        AND settlement_flow = 'fixed_price_escrow'
        AND disputed_at IS NULL
        AND release_eligible_at IS NOT NULL
        AND release_eligible_at <= NOW()
      ORDER BY release_eligible_at ASC
      LIMIT $2
      `,
      [tenantId, limit]
    );
    return rows.map((row) => this.toServiceOrder(row));
  }

  /**
   * Atualiza status para CANCELLED
   */
  async cancelOrder(
    tenantId: string,
    orderId: string,
    cancellationReason: string | null
  ): Promise<ServiceOrder> {
    const row = await runQueryWithTenant<ServiceOrderRow>(
      tenantId,
      `
      UPDATE service_orders
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancellation_reason = $3,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status IN ('draft', 'confirmed', 'in_progress')
      RETURNING id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, decision_id,
                status,
                settlement_flow,
                buyer_confirmation_deadline_at, buyer_confirmed_completion_at,
                release_eligible_at, disputed_at, dispute_id,
                scheduled_start, scheduled_end, estimated_duration_minutes,
                location_address, location_latitude, location_longitude,
                description, customer_notes, worker_notes,
                created_by_actor_id, created_by_user_id,
                confirmed_at, confirmed_by_actor_id,
                started_at, completed_at, cancelled_at, cancellation_reason,
                metadata, created_at, updated_at
      `,
      [tenantId, orderId, cancellationReason]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não pode ser cancelada');
    }

    return this.toServiceOrder(row);
  }
}

export const serviceOrderRepository = new ServiceOrderRepository();






