// backend/src/modules/services/service-order.repository.ts
// SPRINT 68: Repository para service_orders

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ServiceOrder,
  ServiceOrderFilters,
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
                status, scheduled_start, scheduled_end, estimated_duration_minutes,
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
             status, scheduled_start, scheduled_end, estimated_duration_minutes,
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
             status, scheduled_start, scheduled_end, estimated_duration_minutes,
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
                status, scheduled_start, scheduled_end, estimated_duration_minutes,
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
                status, scheduled_start, scheduled_end, estimated_duration_minutes,
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
                status, scheduled_start, scheduled_end, estimated_duration_minutes,
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
                status, scheduled_start, scheduled_end, estimated_duration_minutes,
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






