// backend/src/modules/payments/pix-provider.interface.ts
// SPRINT 85: PIX INTEGRATION (REAL, SEGURA, CANÔNICA)

/**
 * Resultado de criação de charge PIX
 */
export interface PixChargeResult {
  success: boolean;
  chargeId: string; // ID do charge no provider
  qrCode?: string; // QR Code (base64 ou string)
  qrCodeText?: string; // Código copia-e-cola
  expiresAt: Date; // Data de expiração
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Status do charge PIX
 */
export type PixChargeStatus = 'CREATED' | 'PAID' | 'EXPIRED' | 'CANCELLED';

/**
 * Dados do charge PIX
 */
export interface PixChargeData {
  chargeId: string;
  status: PixChargeStatus;
  amount: number; // em centavos
  expiresAt: Date;
  paidAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Evento de webhook PIX
 */
export interface PixWebhookEvent {
  eventType: 'charge.paid' | 'charge.expired' | 'charge.cancelled';
  chargeId: string; // ID do charge no provider
  providerEventId: string; // ID do evento no provider (para idempotência)
  paidAt?: Date;
  amount?: number; // em centavos
  metadata?: Record<string, any>;
}

/**
 * Input para criar charge PIX
 */
export interface CreatePixChargeInput {
  amount: number; // em centavos
  description?: string;
  expiresInMinutes?: number; // Tempo de expiração em minutos (padrão: 30)
  payerTaxId?: string; // CPF/CNPJ do pagador (opcional)
  payerName?: string; // Nome do pagador (opcional)
  metadata?: Record<string, any>;
}

/**
 * Interface do Provider PIX
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Provider é plugável (mock, Asaas, MercadoPago, etc.)
 * - Nenhuma lógica de negócio no provider
 * - Provider apenas comunica com serviço externo
 * - Falhas do provider não quebram o sistema
 */
export interface PixProvider {
  /**
   * Nome do provider
   */
  readonly name: string;

  /**
   * Verifica se provider está disponível
   */
  isAvailable(): Promise<boolean>;

  /**
   * Cria charge PIX
   */
  createCharge(input: CreatePixChargeInput): Promise<PixChargeResult>;

  /**
   * Busca status do charge
   */
  getChargeStatus(chargeId: string): Promise<PixChargeData | null>;

  /**
   * Parse webhook payload
   */
  parseWebhook(payload: any): PixWebhookEvent | null;
}





