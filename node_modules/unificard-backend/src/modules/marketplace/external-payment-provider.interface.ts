// backend/src/modules/marketplace/external-payment-provider.interface.ts
// Interface canônica para provedores de pagamento externo

import type {
  ExternalChargeResult,
  CreateExternalChargeInput,
} from './external-payment-provider.types';

/**
 * Interface canônica para provedores de pagamento externo
 * (Stripe, PagSeguro, Mercado Pago, etc.)
 */
export interface ExternalPaymentProvider {
  /**
   * Criar cobrança externa
   * @param input - Dados da cobrança
   * @returns Resultado da cobrança
   */
  createCharge(input: CreateExternalChargeInput): Promise<ExternalChargeResult>;

  /**
   * Verificar se o provider está disponível
   */
  isAvailable(): boolean;
}





