// backend/src/modules/payments/pix.service.ts
// SPRINT 85: PIX INTEGRATION

import { pixChargeRepository } from './pix.repository';
import { mockPixProvider } from './pix-provider.mock';
import type { PixProvider } from './pix-provider.interface';
import type { PixCharge, CreatePixChargeInput } from './pix.types';

/**
 * Service para PIX
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - 1 PixCharge por PaymentIntent
 * - Idempotência por payment_intent_id
 * - NÃO marca pagamento como SUCCESS aqui
 * - Provider é plugável (mock, Asaas, MercadoPago, etc.)
 * - Nenhuma lógica de negócio no provider
 */
class PixService {
  private provider: PixProvider | null = null;

  /**
   * Resolve provider PIX
   */
  private async resolveProvider(): Promise<PixProvider> {
    if (this.provider) {
      return this.provider;
    }

    // SPRINT 85: Por padrão, usar mock
    // Futuro: verificar env/config para usar provider real
    const providerType = process.env.PIX_PROVIDER || 'MOCK';

    if (providerType === 'MOCK') {
      this.provider = mockPixProvider;
      return this.provider;
    }

    // Futuro: outros providers
    // if (providerType === 'ASAAS') {
    //   const { asaasPixProvider } = await import('./pix-provider.asaas');
    //   this.provider = asaasPixProvider;
    //   return this.provider;
    // }

    // Fallback para mock
    console.warn(`[PixService] Provider PIX não configurado: ${providerType}. Usando MOCK.`);
    this.provider = mockPixProvider;
    return this.provider;
  }

  /**
   * Cria PixCharge
   * 
   * Regras:
   * - 1 PixCharge por PaymentIntent (idempotência)
   * - Se já existe, retorna existente
   */
  async createPixCharge(
    tenantId: string,
    input: CreatePixChargeInput
  ): Promise<PixCharge> {
    // Verificar se já existe (idempotência)
    const existing = await pixChargeRepository.getChargeByPaymentIntent(
      tenantId,
      input.paymentIntentId
    );

    if (existing) {
      return existing;
    }

    // Resolver provider
    const provider = await this.resolveProvider();

    // Criar charge no provider
    const providerResult = await provider.createCharge({
      amountCents: input.amountCents,
      description: `Pagamento ${input.paymentIntentId}`,
      expiresInMinutes: input.expiresInMinutes || 30,
      payerTaxId: input.payerTaxId,
      payerName: input.payerName,
      metadata: input.metadata,
    });

    if (!providerResult.success) {
      throw new Error(
        providerResult.errorMessage || 'Erro ao criar charge PIX no provider'
      );
    }

    // Salvar payload snapshot
    const payloadSnapshot = {
      qrCode: providerResult.qrCode,
      qrCodeText: providerResult.qrCodeText,
      expiresAt: providerResult.expiresAt.toISOString(),
      provider: provider.name,
      chargeId: providerResult.chargeId,
    };

    // Criar charge no banco
    const charge = await pixChargeRepository.createCharge(
      tenantId,
      input,
      provider.name,
      providerResult.chargeId,
      payloadSnapshot
    );

    return charge;
  }

  /**
   * Marca charge como pago
   * 
   * ⚠️ IMPORTANTE: NÃO marca payment como SUCCESS aqui
   * Isso é responsabilidade do PaymentExecutionService
   */
  async markAsPaid(
    tenantId: string,
    chargeId: string,
    paidAt: Date
  ): Promise<PixCharge> {
    const charge = await pixChargeRepository.markAsPaid(tenantId, chargeId, paidAt);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PIX_CHARGE_PAID',
      chargeId: charge.id,
      paymentIntentId: charge.paymentIntentId,
      paidAt: paidAt.toISOString(),
    });

    return charge;
  }

  /**
   * Expira charge
   */
  async expireCharge(tenantId: string, chargeId: string): Promise<PixCharge> {
    const charge = await pixChargeRepository.expireCharge(tenantId, chargeId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PIX_CHARGE_EXPIRED',
      chargeId: charge.id,
      paymentIntentId: charge.paymentIntentId,
    });

    return charge;
  }

  /**
   * Busca charge por PaymentIntent
   */
  async getChargeByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PixCharge | null> {
    return await pixChargeRepository.getChargeByPaymentIntent(tenantId, paymentIntentId);
  }

  /**
   * Busca charge por provider_charge_id
   */
  async getChargeByProviderChargeId(
    tenantId: string,
    provider: string,
    providerChargeId: string
  ): Promise<PixCharge | null> {
    return await pixChargeRepository.getChargeByProviderChargeId(
      tenantId,
      provider,
      providerChargeId
    );
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
      await auditService.record(tenantId, {
        event_type: data.eventType ?? data.event_type ?? 'PIX_ACTION',
        severity: 'INFO',
        source: 'payments',
        context: data,
      });
    } catch (error) {
      console.warn('[PixService] Erro ao registrar auditoria:', error);
    }
  }
}

export const pixService = new PixService();






