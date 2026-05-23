// src/modules/events/organizers/organizer-billing.service.ts
// Service para gerenciar billing de organizadores
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { organizerPlansService, type OrganizerPlan } from './organizer-plans.service';
import { stripeService } from './stripe.service';

export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'past_due';

export interface OrganizerSubscription {
  id: string;
  organizerId: string;
  plan: OrganizerPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paymentGateway?: string;
  paymentGatewaySubscriptionId?: string;
  canceledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  organizerId: string;
  plan: OrganizerPlan;
  paymentGateway?: string;
  paymentGatewayCustomerId?: string;
  paymentGatewaySubscriptionId?: string;
}

export class OrganizerBillingService {
  /**
   * Cria uma nova assinatura
   */
  async createSubscription(
    tenantId: string,
    input: CreateSubscriptionInput
  ): Promise<OrganizerSubscription> {
    const planInfo = organizerPlansService.getPlanInfo(input.plan);
    if (!planInfo) {
      throw new Error('Plano inválido');
    }

    // Calcular período (mensal por padrão)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const row = await runQueryWithTenant<{
      id: string;
      organizer_id: string;
      plan: string;
      status: string;
      current_period_start: Date;
      current_period_end: Date;
      payment_gateway: string | null;
      payment_gateway_subscription_id: string | null;
      canceled_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO organizer_subscriptions (
        tenant_id,
        organizer_id,
        plan,
        status,
        current_period_start,
        current_period_end,
        payment_gateway,
        payment_gateway_customer_id,
        payment_gateway_subscription_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, organizer_id, plan, status, current_period_start, current_period_end,
                payment_gateway, payment_gateway_subscription_id, canceled_at, created_at, updated_at
      `,
      [
        tenantId,
        input.organizerId,
        input.plan,
        'active',
        now,
        periodEnd,
        input.paymentGateway || null,
        input.paymentGatewayCustomerId || null,
        input.paymentGatewaySubscriptionId || null,
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar assinatura');
    }

    // Atualizar plano do organizador
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE event_organizers
      SET plan = $1, plan_expires_at = $2, updated_at = NOW()
      WHERE id = $3
      `,
      [input.plan, periodEnd, input.organizerId]
    );

    return this.toSubscription(row);
  }

  /**
   * Busca assinatura ativa de um organizador
   */
  async getActiveSubscription(
    tenantId: string,
    organizerId: string
  ): Promise<OrganizerSubscription | null> {
    const row = await runQueryWithTenant<{
      id: string;
      organizer_id: string;
      plan: string;
      status: string;
      current_period_start: Date;
      current_period_end: Date;
      payment_gateway: string | null;
      payment_gateway_subscription_id: string | null;
      canceled_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      SELECT id, organizer_id, plan, status, current_period_start, current_period_end,
             payment_gateway, payment_gateway_subscription_id, canceled_at, created_at, updated_at
      FROM organizer_subscriptions
      WHERE organizer_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [organizerId]
    );

    if (!row) {
      return null;
    }

    // Verificar se expirou
    if (row.current_period_end < new Date()) {
      // Marcar como expirada
      await this.updateSubscriptionStatus(tenantId, row.id, 'expired');
      return null;
    }

    return this.toSubscription(row);
  }

  /**
   * Atualiza status de assinatura
   */
  async updateSubscriptionStatus(
    tenantId: string,
    subscriptionId: string,
    status: SubscriptionStatus
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE organizer_subscriptions
      SET status = $1, updated_at = NOW(), canceled_at = CASE WHEN $1 = 'canceled' THEN NOW() ELSE canceled_at END
      WHERE id = $2
      `,
      [status, subscriptionId]
    );
  }

  /**
   * Cancela assinatura
   */
  async cancelSubscription(
    tenantId: string,
    organizerId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<void> {
    const subscription = await this.getActiveSubscription(tenantId, organizerId);
    if (!subscription) {
      throw new Error('Assinatura ativa não encontrada');
    }

    if (cancelAtPeriodEnd) {
      // Marcar para cancelar no fim do período
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE organizer_subscriptions
        SET status = 'canceled', canceled_at = current_period_end, updated_at = NOW()
        WHERE id = $1
        `,
        [subscription.id]
      );
    } else {
      // Cancelar imediatamente e fazer downgrade para free
      await this.updateSubscriptionStatus(tenantId, subscription.id, 'canceled');
      
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE event_organizers
        SET plan = 'free', plan_expires_at = NULL, updated_at = NOW()
        WHERE id = $1
        `,
        [organizerId]
      );
    }
  }

  /**
   * Renova assinatura (chamado quando período termina)
   */
  async renewSubscription(
    tenantId: string,
    subscriptionId: string
  ): Promise<OrganizerSubscription> {
    const subscription = await runQueryWithTenant<{
      id: string;
      organizer_id: string;
      plan: string;
      current_period_end: Date;
    }>(
      tenantId,
      `
      SELECT id, organizer_id, plan, current_period_end
      FROM organizer_subscriptions
      WHERE id = $1
      `,
      [subscriptionId]
    );

    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    // Calcular novo período
    const now = new Date();
    const newPeriodEnd = new Date(subscription.current_period_end);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    const updated = await runQueryWithTenant<{
      id: string;
      organizer_id: string;
      plan: string;
      status: string;
      current_period_start: Date;
      current_period_end: Date;
      payment_gateway: string | null;
      payment_gateway_subscription_id: string | null;
      canceled_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      UPDATE organizer_subscriptions
      SET 
        status = 'active',
        current_period_start = $1,
        current_period_end = $2,
        canceled_at = NULL,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, organizer_id, plan, status, current_period_start, current_period_end,
                payment_gateway, payment_gateway_subscription_id, canceled_at, created_at, updated_at
      `,
      [now, newPeriodEnd, subscriptionId]
    );

    if (!updated) {
      throw new Error('Falha ao renovar assinatura');
    }

    // Atualizar plano do organizador
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE event_organizers
      SET plan_expires_at = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [newPeriodEnd, subscription.organizer_id]
    );

    return this.toSubscription(updated);
  }

  /**
   * Processa expirações (chamado por job/cron)
   */
  async processExpirations(tenantId: string): Promise<number> {
    const expired = await runQueriesWithTenant<{
      id: string;
      organizer_id: string;
    }>(
      tenantId,
      `
      SELECT id, organizer_id
      FROM organizer_subscriptions
      WHERE status = 'active'
        AND current_period_end < now()
      `,
      []
    );

    for (const sub of expired) {
      await this.updateSubscriptionStatus(tenantId, sub.id, 'expired');
      
      // Fazer downgrade para free
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE event_organizers
        SET plan = 'free', plan_expires_at = NULL, updated_at = NOW()
        WHERE id = $1
        `,
        [sub.organizer_id]
      );
    }

    return expired.length;
  }

  private toSubscription(row: {
    id: string;
    organizer_id: string;
    plan: string;
    status: string;
    current_period_start: Date;
    current_period_end: Date;
    payment_gateway: string | null;
    payment_gateway_subscription_id: string | null;
    canceled_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): OrganizerSubscription {
    return {
      id: row.id,
      organizerId: row.organizer_id,
      plan: row.plan as OrganizerPlan,
      status: row.status as SubscriptionStatus,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      paymentGateway: row.payment_gateway || undefined,
      paymentGatewaySubscriptionId: row.payment_gateway_subscription_id || undefined,
      canceledAt: row.canceled_at,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at as string),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at as string),
    };
  }
}

export const organizerBillingService = new OrganizerBillingService();



