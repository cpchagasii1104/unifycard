// backend/src/modules/payments/pix-provider.mock.ts
// SPRINT 85: Mock Provider PIX (para desenvolvimento)

import type {
  PixProvider,
  PixChargeResult,
  PixChargeData,
  PixWebhookEvent,
  CreatePixChargeInput,
  PixChargeStatus,
} from './pix-provider.interface';

/**
 * Mock Provider PIX
 * 
 * Simula comportamento de provider real sem integração externa.
 * Para desenvolvimento e testes.
 */
class MockPixProvider implements PixProvider {
  readonly name = 'MOCK';

  private charges: Map<string, {
    chargeId: string;
    status: PixChargeStatus;
    amount: number;
    expiresAt: Date;
    paidAt?: Date;
    metadata?: Record<string, any>;
  }> = new Map();

  async isAvailable(): Promise<boolean> {
    return true; // Mock sempre disponível
  }

  async createCharge(input: CreatePixChargeInput): Promise<PixChargeResult> {
    const chargeId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresInMinutes = input.expiresInMinutes || 30;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Gerar QR Code mock (base64 de uma imagem simples ou texto)
    const qrCodeText = `00020126580014BR.GOV.BCB.PIX0136${chargeId}5204000053039865405${(input.amount / 100).toFixed(2)}5802BR5925MOCK PIX PROVIDER6009SAO PAULO62070503***6304`;

    // Salvar charge no mapa (simulação de banco)
    this.charges.set(chargeId, {
      chargeId,
      status: 'CREATED',
      amount: input.amount,
      expiresAt,
      metadata: input.metadata,
    });

    return {
      success: true,
      chargeId,
      qrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`, // QR Code mock (1x1 pixel)
      qrCodeText,
      expiresAt,
      metadata: {
        provider: 'MOCK',
        chargeId,
      },
    };
  }

  async getChargeStatus(chargeId: string): Promise<PixChargeData | null> {
    const charge = this.charges.get(chargeId);
    if (!charge) {
      return null;
    }

    // Verificar se expirou
    if (charge.status === 'CREATED' && charge.expiresAt < new Date()) {
      charge.status = 'EXPIRED';
    }

    return {
      chargeId: charge.chargeId,
      status: charge.status,
      amount: charge.amount,
      expiresAt: charge.expiresAt,
      paidAt: charge.paidAt,
      metadata: charge.metadata,
    };
  }

  parseWebhook(payload: any): PixWebhookEvent | null {
    // Mock webhook format
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    // Formato esperado do mock:
    // { eventType: 'charge.paid', chargeId: '...', providerEventId: '...', paidAt: '...', amount: ... }
    if (payload.eventType && payload.chargeId && payload.providerEventId) {
      return {
        eventType: payload.eventType as any,
        chargeId: payload.chargeId,
        providerEventId: payload.providerEventId,
        paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
        amount: payload.amount,
        metadata: payload.metadata,
      };
    }

    return null;
  }

  /**
   * Método auxiliar para simular pagamento (apenas para testes)
   */
  async simulatePayment(chargeId: string): Promise<void> {
    const charge = this.charges.get(chargeId);
    if (charge && charge.status === 'CREATED') {
      charge.status = 'PAID';
      charge.paidAt = new Date();
    }
  }
}

export const mockPixProvider = new MockPixProvider();





