// backend/src/modules/subscriptions/subscription.repository.ts
// SPRINT 87: ASSINATURAS (RECORRÊNCIA AUDITÁVEL)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Subscription,
  CreateSubscriptionInput,
  SubscriptionFilters,
  SubscriptionStatus,
} from './subscription.types';

interface SubscriptionRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  payment_link_id: string;
  amountCents: string;
  currency: string;
  interval: string;
  interval_count: number;
  day_of_month: number | null;
  next_runAt: Date;
  status: string;
  max_failures: number;
  failure_count: number;
  last_runAt: Date | null;
  last_successAt: Date | null;
  last_failureAt: Date | null;
  last_payment_intent_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: any;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class SubscriptionRepository {
  private toSubscription(row: SubscriptionRow): Subscription {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      paymentLinkId: row.payment_link_id,
      amountCents: parseFloat(row.amount),
      currency: row.currency,
      interval: row.interval as any,
      intervalCount: row.interval_count,
      dayOfMonth: row.day_of_month,
      nextRunAt: row.next_runAt,
      status: row.status as SubscriptionStatus,
      maxFailures: row.max_failures,
      failureCount: row.failure_count,
      lastRunAt: row.last_runAt,
      lastSuccessAt: row.last_successAt,
      lastFailureAt: row.last_failureAt,
      lastPaymentIntentId: row.last_payment_intent_id,
      lastErrorCode: row.last_error_code,
      lastErrorMessage: row.last_error_message,
      metadata: row.metadata || {},
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createSubscription(
    tenantId: string,
    createdByActorId: string,
    createdByUserId: string | null,
    input: CreateSubscriptionInput
  ): Promise<Subscription> {
    const row = await runQueryWithTenant<SubscriptionRow>(
      tenantId,
      `
      INSERT INTO subscriptions (
        tenant_id, contact_id, payment_link_id, amount, currency,
        interval, interval_count, day_of_month, next_runAt,
        status, max_failures, failure_count, metadata,
        created_by_actor_id, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
      RETURNING id, tenant_id, contact_id, payment_link_id, amount, currency,
                interval, interval_count, day_of_month, next_runAt,
                status, max_failures, failure_count,
                last_runAt, last_successAt, last_failureAt,
                last_payment_intent_id, last_error_code, last_error_message,
                metadata, created_by_actor_id, created_by_user_id,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.contactId,
        input.paymentLinkId,
        input.amount,
        input.currency || 'BRL',
        input.interval,
        input.intervalCount || 1,
        input.dayOfMonth || null,
        input.nextRunAt || new Date(Date.now() + 5 * 60 * 1000), // Default: agora + 5min
        'ACTIVE',
        input.maxFailures || 3,
        0,
        JSON.stringify(input.metadata || {}),
        createdByActorId,
        createdByUserId,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar assinatura');
    }

    return this.toSubscription(row);
  }

  async getSubscriptionById(tenantId: string, subscriptionId: string): Promise<Subscription | null> {
    const row = await runQueryWithTenant<SubscriptionRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, payment_link_id, amount, currency,
             interval, interval_count, day_of_month, next_runAt,
             status, max_failures, failure_count,
             last_runAt, last_successAt, last_failureAt,
             last_payment_intent_id, last_error_code, last_error_message,
             metadata, created_by_actor_id, created_by_user_id,
             createdAt, updatedAt
      FROM subscriptions
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, subscriptionId]
    );

    return row ? this.toSubscription(row) : null;
  }

  async listSubscriptions(tenantId: string, filters: SubscriptionFilters = {}): Promise<Subscription[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.contactId) {
      conditions.push(`contact_id = $${paramIndex}`);
      params.push(filters.contactId);
      paramIndex++;
    }

    if (filters.paymentLinkId) {
      conditions.push(`payment_link_id = $${paramIndex}`);
      params.push(filters.paymentLinkId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<SubscriptionRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, payment_link_id, amount, currency,
             interval, interval_count, day_of_month, next_runAt,
             status, max_failures, failure_count,
             last_runAt, last_successAt, last_failureAt,
             last_payment_intent_id, last_error_code, last_error_message,
             metadata, created_by_actor_id, created_by_user_id,
             createdAt, updatedAt
      FROM subscriptions
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toSubscription(row));
  }

  async getDueSubscriptions(tenantId: string, limit: number = 50): Promise<Subscription[]> {
    const rows = await runQueriesWithTenant<SubscriptionRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, payment_link_id, amount, currency,
             interval, interval_count, day_of_month, next_runAt,
             status, max_failures, failure_count,
             last_runAt, last_successAt, last_failureAt,
             last_payment_intent_id, last_error_code, last_error_message,
             metadata, created_by_actor_id, created_by_user_id,
             createdAt, updatedAt
      FROM subscriptions
      WHERE tenant_id = $1
        AND status = 'ACTIVE'
        AND next_runAt <= NOW()
      ORDER BY next_runAt ASC
      LIMIT $2
      `,
      [tenantId, limit]
    );

    return rows.map((row) => this.toSubscription(row));
  }

  async updateStatus(tenantId: string, subscriptionId: string, status: SubscriptionStatus): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE subscriptions
      SET status = $1
      WHERE tenant_id = $2 AND id = $3
      `,
      [status, tenantId, subscriptionId]
    );
  }

  async updateNextRunAt(tenantId: string, subscriptionId: string, nextRunAt: Date): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE subscriptions
      SET next_runAt = $1
      WHERE tenant_id = $2 AND id = $3
      `,
      [nextRunAt, tenantId, subscriptionId]
    );
  }

  async markLastRun(tenantId: string, subscriptionId: string, paymentIntentId: string | null): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE subscriptions
      SET last_runAt = NOW(),
          last_payment_intent_id = $1
      WHERE tenant_id = $2 AND id = $3
      `,
      [paymentIntentId, tenantId, subscriptionId]
    );
  }

  async markSuccess(tenantId: string, subscriptionId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE subscriptions
      SET last_successAt = NOW(),
          failure_count = 0,
          last_error_code = NULL,
          last_error_message = NULL
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, subscriptionId]
    );
  }

  async markFailure(
    tenantId: string,
    subscriptionId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE subscriptions
      SET last_failureAt = NOW(),
          failure_count = failure_count + 1,
          last_error_code = $1,
          last_error_message = $2
      WHERE tenant_id = $3 AND id = $4
      `,
      [errorCode, errorMessage, tenantId, subscriptionId]
    );
  }

  async pauseIfMaxFailures(tenantId: string, subscriptionId: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ should_pause: boolean }>(
      tenantId,
      `
      UPDATE subscriptions
      SET status = 'PAUSED'
      WHERE tenant_id = $1
        AND id = $2
        AND failure_count >= max_failures
        AND status = 'ACTIVE'
      RETURNING true as should_pause
      `,
      [tenantId, subscriptionId]
    );

    return result ? true : false;
  }
}

export const subscriptionRepository = new SubscriptionRepository();








