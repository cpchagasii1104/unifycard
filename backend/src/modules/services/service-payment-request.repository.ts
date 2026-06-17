// src/modules/services/service-payment-request.repository.ts
// Repository do Domínio de PAGAMENTO (Payment Request / Payment Intent)
// 🔴 BLINDAGEM: Nenhum payment deve ser criado sem booking, service, payer e receiver
// 🔴 BLINDAGEM: Só pode criar payment se existir booking_decision = accepted

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ServicePaymentRequest,
  ServicePaymentRequestRow,
  CreateServicePaymentRequestInput,
  UpdateServicePaymentRequestInput,
} from './service-payment-request.types';
import { PaymentRequestStatus } from './service-payment-request.types';

class ServicePaymentRequestRepository {
  /**
   * Converte ServicePaymentRequestRow para ServicePaymentRequest
   */
  private toServicePaymentRequest(row: ServicePaymentRequestRow): ServicePaymentRequest {
    return {
      paymentRequestId: row.payment_request_id,
      tenantId: row.tenant_id,
      bookingId: row.booking_id,
      serviceId: row.service_id,
      payerActorId: row.payer_actor_id,
      receiverActorId: row.receiver_actor_id,
      paymentRequestStatus: row.paymentRequestStatus as PaymentRequestStatus,
      amountCents: Number(row.amountCents),
      currency: row.currency,
      requestedAt: row.requested_at,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      cancelledAt: row.cancelled_at,
      expiredAt: row.expired_at,
    };
  }

  /**
   * Busca payment request por ID
   */
  async findById(tenantId: string, paymentRequestId: string): Promise<ServicePaymentRequest | null> {
    const row = await runQueryWithTenant<ServicePaymentRequestRow>(
      tenantId,
      `
      SELECT 
        payment_request_id, tenant_id, booking_id, service_id,
        payer_actor_id, receiver_actor_id, payment_request_status AS "paymentRequestStatus", amount_cents AS "amountCents", currency,
        requested_at, metadata, created_at, updated_at,
        cancelled_at, expired_at
      FROM service_payment_requests
      WHERE payment_request_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [paymentRequestId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toServicePaymentRequest(row);
  }

  /**
   * Busca payment requests de um Booking
   * 🔴 BLINDAGEM: Apenas um pedido de pagamento por booking (constraint UNIQUE)
   */
  async findByBookingId(tenantId: string, bookingId: string): Promise<ServicePaymentRequest | null> {
    const row = await runQueryWithTenant<ServicePaymentRequestRow>(
      tenantId,
      `
      SELECT 
        payment_request_id, tenant_id, booking_id, service_id,
        payer_actor_id, receiver_actor_id, payment_request_status AS "paymentRequestStatus", amount_cents AS "amountCents", currency,
        requested_at, metadata, created_at, updated_at,
        cancelled_at, expired_at
      FROM service_payment_requests
      WHERE booking_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [bookingId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toServicePaymentRequest(row);
  }

  /**
   * Busca payment requests de um Service
   * 🔴 BLINDAGEM: Nenhuma query deve usar payment como filtro decisório
   */
  async findByService(
    tenantId: string,
    serviceId: string,
    filters?: { status?: PaymentRequestStatus }
  ): Promise<ServicePaymentRequest[]> {
    let query = `
      SELECT 
        payment_request_id, tenant_id, booking_id, service_id,
        payer_actor_id, receiver_actor_id, payment_request_status AS "paymentRequestStatus", amount_cents AS "amountCents", currency,
        requested_at, metadata, created_at, updated_at,
        cancelled_at, expired_at
      FROM service_payment_requests
      WHERE service_id = $1 AND tenant_id = $2
    `;
    const params: any[] = [serviceId, tenantId];

    if (filters?.status) {
      query += ` AND payment_request_status = $3`;
      params.push(filters.status);
    }

    query += ` ORDER BY requested_at DESC`;

    const rows = await runQueriesWithTenant<ServicePaymentRequestRow>(tenantId, query, params);

    return rows.map(this.toServicePaymentRequest);
  }

  /**
   * Cria novo payment request
   * 🔴 BLINDAGEM: bookingId, serviceId, payerActorId e receiverActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Apenas um pedido de pagamento por booking (constraint UNIQUE)
   */
  async create(tenantId: string, input: CreateServicePaymentRequestInput): Promise<ServicePaymentRequest> {
    // 🔴 BLINDAGEM: Validar que todos os IDs foram fornecidos
    if (!input.bookingId) {
      throw new Error('bookingId é obrigatório para criar payment request');
    }
    if (!input.serviceId) {
      throw new Error('serviceId é obrigatório para criar payment request');
    }
    if (!input.payerActorId) {
      throw new Error('payerActorId é obrigatório para criar payment request');
    }
    if (!input.receiverActorId) {
      throw new Error('receiverActorId é obrigatório para criar payment request');
    }
    if (!input.amountCents || input.amountCents <= 0) {
      throw new Error('amountCents deve ser maior que zero');
    }

    const row = await runQueryWithTenant<ServicePaymentRequestRow>(
      tenantId,
      `
      INSERT INTO service_payment_requests (
        tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id,
        payment_request_status, amount_cents, currency, requested_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (booking_id) DO NOTHING
      RETURNING 
        payment_request_id, tenant_id, booking_id, service_id,
        payer_actor_id, receiver_actor_id, payment_request_status AS "paymentRequestStatus", amount_cents AS "amountCents", currency,
        requested_at, metadata, created_at, updated_at,
        cancelled_at, expired_at
      `,
      [
        tenantId,
        input.bookingId,
        input.serviceId,
        input.payerActorId,
        input.receiverActorId,
        PaymentRequestStatus.PENDING,
        input.amountCents,
        input.currency || 'BRL',
        new Date(),
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      // Conflito: já existe um pedido de pagamento para este booking
      throw new Error('Já existe um pedido de pagamento para este booking');
    }

    return this.toServicePaymentRequest(row);
  }

  /**
   * Atualiza payment request
   */
  async update(
    tenantId: string,
    paymentRequestId: string,
    input: UpdateServicePaymentRequestInput
  ): Promise<ServicePaymentRequest> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.paymentRequestStatus !== undefined) {
      updates.push(`payment_request_status = $${paramIndex++}`);
      params.push(input.paymentRequestStatus);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar payment request atual
      return await this.findById(tenantId, paymentRequestId) || (() => { throw new Error('Payment request não encontrado'); })();
    }

    params.push(paymentRequestId, tenantId);

    const row = await runQueryWithTenant<ServicePaymentRequestRow>(
      tenantId,
      `
      UPDATE service_payment_requests
      SET ${updates.join(', ')}
      WHERE payment_request_id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING 
        payment_request_id, tenant_id, booking_id, service_id,
        payer_actor_id, receiver_actor_id, payment_request_status AS "paymentRequestStatus", amount_cents AS "amountCents", currency,
        requested_at, metadata, created_at, updated_at,
        cancelled_at, expired_at
      `,
      params
    );

    if (!row) {
      throw new Error('Payment request não encontrado');
    }

    return this.toServicePaymentRequest(row);
  }
}

export const servicePaymentRequestRepository = new ServicePaymentRequestRepository();



