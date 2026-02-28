// backend/src/modules/marketplace/external-payment-provider.mock.ts
// Implementação MOCK de provedor de pagamento externo
// Para desenvolvimento e testes

import { v4 as uuidv4 } from 'uuid';
import type { ExternalPaymentProvider } from './external-payment-provider.interface';
import type {
  ExternalChargeResult,
  CreateExternalChargeInput,
} from './external-payment-provider.types';

/**
 * Mock de provedor de pagamento externo
 * Simula sucesso/falha baseado em taxa configurável
 */
export class MockExternalPaymentProvider implements ExternalPaymentProvider {
  private successRate: number;

  constructor(successRate: number = 1.0) {
    // successRate: 0.0 a 1.0 (100% = sempre sucesso)
    this.successRate = Math.max(0, Math.min(1, successRate));
  }

  async createCharge(input: CreateExternalChargeInput): Promise<ExternalChargeResult> {
    // Simular latência de rede
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simular sucesso/falha baseado em taxa
    const shouldSucceed = Math.random() < this.successRate;

    if (shouldSucceed) {
      return {
        external_payment_id: `ext_pay_${uuidv4()}`,
        status: 'succeeded',
        amountCents: input.amountCents,
        currency: input.currency,
        metadata: {
          ...input.metadata,
          mock: true,
          simulatedAt: new Date().toISOString(),
        },
      };
    } else {
      // Simular falha
      throw new Error('Pagamento externo falhou (simulado)');
    }
  }

  isAvailable(): boolean {
    return true;
  }
}

// Instância padrão (100% sucesso para desenvolvimento)
export const mockExternalPaymentProvider = new MockExternalPaymentProvider(1.0);







