// backend/src/modules/marketplace/event-settlement.types.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

/**
 * Status do settlement de evento
 */
export type EventSettlementStatus = 'PENDING' | 'SETTLED';

/**
 * Event Settlement
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Evento ≠ Empresa
 * - Evento ≠ Payout
 * - Tudo explícito
 * - Nada automático
 */
export interface EventSettlement {
  id: string;
  tenantId: string;
  eventId: string;
  grossRevenue: number; // em centavos
  commissionsAmount: number; // em centavos
  regionalFeeAmount: number; // em centavos
  netAmount: number; // em centavos
  currency: string;
  status: EventSettlementStatus;
  settlementId: string | null;
  settledAt: Date | null;
  settledByActorId: string | null;
  settledByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar settlement de evento
 */
export interface CreateEventSettlementInput {
  eventId: string;
  grossRevenue: number; // em centavos
  commissionsAmount?: number; // em centavos
  regionalFeeAmount?: number; // em centavos
  metadata?: Record<string, any>;
}

/**
 * Input para liquidar settlement de evento
 */
export interface SettleEventSettlementInput {
  settlementId?: string; // Settlement core vinculado
}





