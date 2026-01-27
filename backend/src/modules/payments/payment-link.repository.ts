// backend/src/modules/payments/payment-link.repository.ts
// SPRINT 86: PAYMENT LINKS

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PaymentLink, CreatePaymentLinkInput, PaymentLinkPayment } from './payment-link.types';

interface PaymentLinkRow {
  id: string;
  tenant_id: string;
  created_by_actor_id: string;
  slug: string;
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  expires_at: Date | null;
  max_uses: number | null;
  uses_count: number;
  status: string;
  contact_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface PaymentLinkPaymentRow {
  id: string;
  tenant_id: string;
  payment_link_id: string;
  payment_intent_id: string;
  payment_transaction_id: string | null;
  contact_id: string | null;
  status: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PaymentLinkRepository {
  private toPaymentLink(row: PaymentLinkRow): PaymentLink {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      createdByActorId: row.created_by_actor_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      expiresAt: row.expires_at,
      maxUses: row.max_uses,
      usesCount: row.uses_count,
      status: row.status as any,
      contactId: row.contact_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toPaymentLinkPayment(row: PaymentLinkPaymentRow): PaymentLinkPayment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      paymentLinkId: row.payment_link_id,
      paymentIntentId: row.payment_intent_id,
      paymentTransactionId: row.payment_transaction_id,
      contactId: row.contact_id,
      status: row.status as any,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Gera slug único
   */
  private generateSlug(): string {
    // Gerar slug aleatório (ex: abc123def456)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let slug = '';
    for (let i = 0; i < 12; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
  }

  /**
   * Cria payment link
   */
  async createLink(
    tenantId: string,
    createdByActorId: string,
    input: CreatePaymentLinkInput
  ): Promise<PaymentLink> {
    // Gerar slug único
    let slug = this.generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.getBySlug(tenantId, slug);
      if (!existing) {
        break;
      }
      slug = this.generateSlug();
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('Erro ao gerar slug único para payment link');
    }

    const row = await runQueryWithTenant<PaymentLinkRow>(
      tenantId,
      `
      INSERT INTO payment_links (
        tenant_id, created_by_actor_id, slug, title, description,
        amount, currency, expires_at, max_uses, contact_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING id, tenant_id, created_by_actor_id, slug, title, description,
                amount, currency, expires_at, max_uses, uses_count, status,
                contact_id, metadata, created_at, updated_at
      `,
      [
        tenantId,
        createdByActorId,
        slug,
        input.title,
        input.description || null,
        input.amount,
        input.currency || 'BRL',
        input.expiresAt || null,
        input.maxUses || null,
        input.contactId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return this.toPaymentLink(row);
  }

  /**
   * Busca link por slug
   */
  async getBySlug(tenantId: string, slug: string): Promise<PaymentLink | null> {
    const row = await runQueryWithTenant<PaymentLinkRow>(
      tenantId,
      `
      SELECT id, tenant_id, created_by_actor_id, slug, title, description,
             amount, currency, expires_at, max_uses, uses_count, status,
             contact_id, metadata, created_at, updated_at
      FROM payment_links
      WHERE tenant_id = $1 AND slug = $2
      `,
      [tenantId, slug]
    );

    if (!row) {
      return null;
    }

    return this.toPaymentLink(row);
  }

  /**
   * Busca link por ID
   */
  async getById(tenantId: string, linkId: string): Promise<PaymentLink | null> {
    const row = await runQueryWithTenant<PaymentLinkRow>(
      tenantId,
      `
      SELECT id, tenant_id, created_by_actor_id, slug, title, description,
             amount, currency, expires_at, max_uses, uses_count, status,
             contact_id, metadata, created_at, updated_at
      FROM payment_links
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, linkId]
    );

    if (!row) {
      return null;
    }

    return this.toPaymentLink(row);
  }

  /**
   * Incrementa contador de usos
   */
  async incrementUses(tenantId: string, linkId: string): Promise<PaymentLink> {
    const row = await runQueryWithTenant<PaymentLinkRow>(
      tenantId,
      `
      UPDATE payment_links
      SET uses_count = uses_count + 1, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, created_by_actor_id, slug, title, description,
                amount, currency, expires_at, max_uses, uses_count, status,
                contact_id, metadata, created_at, updated_at
      `,
      [tenantId, linkId]
    );

    return this.toPaymentLink(row);
  }

  /**
   * Expira link
   */
  async expireLink(tenantId: string, linkId: string): Promise<PaymentLink> {
    const row = await runQueryWithTenant<PaymentLinkRow>(
      tenantId,
      `
      UPDATE payment_links
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'ACTIVE'
      RETURNING id, tenant_id, created_by_actor_id, slug, title, description,
                amount, currency, expires_at, max_uses, uses_count, status,
                contact_id, metadata, created_at, updated_at
      `,
      [tenantId, linkId]
    );

    return this.toPaymentLink(row);
  }

  /**
   * Desabilita link
   */
  async disableLink(tenantId: string, linkId: string): Promise<PaymentLink> {
    const row = await runQueryWithTenant<PaymentLinkRow>(
      tenantId,
      `
      UPDATE payment_links
      SET status = 'DISABLED', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, created_by_actor_id, slug, title, description,
                amount, currency, expires_at, max_uses, uses_count, status,
                contact_id, metadata, created_at, updated_at
      `,
      [tenantId, linkId]
    );

    return this.toPaymentLink(row);
  }

  /**
   * Cria registro de pagamento via link (append-only)
   */
  async createPayment(
    tenantId: string,
    paymentLinkId: string,
    paymentIntentId: string,
    contactId?: string
  ): Promise<PaymentLinkPayment> {
    const row = await runQueryWithTenant<PaymentLinkPaymentRow>(
      tenantId,
      `
      INSERT INTO payment_link_payments (
        tenant_id, payment_link_id, payment_intent_id, contact_id, status
      )
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING id, tenant_id, payment_link_id, payment_intent_id,
                payment_transaction_id, contact_id, status, metadata,
                created_at, updated_at
      `,
      [tenantId, paymentLinkId, paymentIntentId, contactId || null]
    );

    return this.toPaymentLinkPayment(row);
  }

  /**
   * Atualiza status do pagamento
   */
  async updatePaymentStatus(
    tenantId: string,
    paymentIntentId: string,
    status: PaymentLinkPaymentStatus,
    paymentTransactionId?: string
  ): Promise<PaymentLinkPayment> {
    const updates: string[] = ['status = $3', 'updated_at = NOW()'];
    const params: any[] = [tenantId, paymentIntentId, status];
    
    if (paymentTransactionId) {
      updates.push('payment_transaction_id = $4');
      params.push(paymentTransactionId);
    }

    const row = await runQueryWithTenant<PaymentLinkPaymentRow>(
      tenantId,
      `
      UPDATE payment_link_payments
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND payment_intent_id = $2
      RETURNING id, tenant_id, payment_link_id, payment_intent_id,
                payment_transaction_id, contact_id, status, metadata,
                created_at, updated_at
      `,
      params
    );

    return this.toPaymentLinkPayment(row);
  }
}

export const paymentLinkRepository = new PaymentLinkRepository();





