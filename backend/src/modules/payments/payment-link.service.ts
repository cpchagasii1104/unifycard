// backend/src/modules/payments/payment-link.service.ts
// SPRINT 86: PAYMENT LINKS

import { paymentLinkRepository } from './payment-link.repository';
import type { PaymentLink, CreatePaymentLinkInput } from './payment-link.types';

/**
 * Service para Payment Links
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Link pode ser usado sem login
 * - Valida expiração e limite de uso
 * - Não cria PaymentIntent automaticamente
 * - Tudo auditável
 */
class PaymentLinkService {
  /**
   * Cria payment link
   */
  async createLink(
    tenantId: string,
    createdByActorId: string,
    input: CreatePaymentLinkInput
  ): Promise<PaymentLink> {
    // Validar amount
    if (input.amount <= 0) {
      throw new Error('Amount deve ser maior que zero');
    }

    // Validar maxUses
    if (input.maxUses !== undefined && input.maxUses <= 0) {
      throw new Error('maxUses deve ser maior que zero');
    }

    // Validar expiresAt
    if (input.expiresAt && input.expiresAt < new Date()) {
      throw new Error('expiresAt deve ser no futuro');
    }

    const link = await paymentLinkRepository.createLink(tenantId, createdByActorId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PAYMENT_LINK_CREATED',
      linkId: link.id,
      slug: link.slug,
      amount: link.amount,
      createdByActorId,
    });

    return link;
  }

  /**
   * Busca link por slug (público)
   */
  async getBySlug(tenantId: string, slug: string): Promise<PaymentLink | null> {
    const link = await paymentLinkRepository.getBySlug(tenantId, slug);
    
    if (!link) {
      return null;
    }

    // Verificar se expirou
    if (link.status === 'ACTIVE' && link.expiresAt && link.expiresAt < new Date()) {
      await this.expireIfNeeded(tenantId, link.id);
      // Buscar novamente para retornar status atualizado
      return await paymentLinkRepository.getBySlug(tenantId, slug);
    }

    return link;
  }

  /**
   * Busca link por ID
   */
  async getById(tenantId: string, linkId: string): Promise<PaymentLink | null> {
    return await paymentLinkRepository.getById(tenantId, linkId);
  }

  /**
   * Valida se link pode ser usado
   */
  async validateLink(link: PaymentLink): Promise<{ valid: boolean; error?: string }> {
    if (link.status === 'DISABLED') {
      return { valid: false, error: 'Link desabilitado' };
    }

    if (link.status === 'EXPIRED') {
      return { valid: false, error: 'Link expirado' };
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return { valid: false, error: 'Link expirado' };
    }

    if (link.maxUses !== null && link.usesCount >= link.maxUses) {
      return { valid: false, error: 'Limite de usos atingido' };
    }

    return { valid: true };
  }

  /**
   * Registra uso do link (incrementa contador)
   */
  async registerUse(tenantId: string, linkId: string): Promise<PaymentLink> {
    const link = await paymentLinkRepository.incrementUses(tenantId, linkId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PAYMENT_LINK_USED',
      linkId: link.id,
      usesCount: link.usesCount,
    });

    return link;
  }

  /**
   * Expira link se necessário
   */
  async expireIfNeeded(tenantId: string, linkId: string): Promise<PaymentLink | null> {
    const link = await paymentLinkRepository.getById(tenantId, linkId);
    if (!link) {
      return null;
    }

    if (link.status === 'ACTIVE' && link.expiresAt && link.expiresAt < new Date()) {
      const expiredLink = await paymentLinkRepository.expireLink(tenantId, linkId);

      // Registrar auditoria
      await this.recordAudit(tenantId, {
        eventType: 'PAYMENT_LINK_EXPIRED',
        linkId: expiredLink.id,
      });

      return expiredLink;
    }

    return link;
  }

  /**
   * Desabilita link
   */
  async disable(tenantId: string, linkId: string): Promise<PaymentLink> {
    const link = await paymentLinkRepository.disableLink(tenantId, linkId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PAYMENT_LINK_DISABLED',
      linkId: link.id,
    });

    return link;
  }

  /**
   * Registra auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[PaymentLinkService] Erro ao registrar auditoria:', error);
    }
  }
}

export const paymentLinkService = new PaymentLinkService();





