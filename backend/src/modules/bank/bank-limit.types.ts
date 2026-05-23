// backend/src/modules/bank/bank-limit.types.ts
// SPRINT 36.1: BANK SAFETY LAYER - Modelo Canônico de Limites
// Tipos para pedidos de mudança de limite

import type { MoneyCents } from '@contracts/marketplace/canonical';

/**
 * Tipo de limite bancário
 */
export type BankLimitType = 'pix_out' | 'transfer_out' | 'payment_out' | 'daily_out' | 'monthly_out';

/**
 * Status do pedido de mudança de limite
 */
export type LimitChangeRequestStatus = 'pending' | 'applied' | 'cancelled';

/**
 * Fonte de autoridade para mudança de limite
 */
export type AuthoritySource = 'self' | 'delegated' | 'system';

/**
 * Pedido de mudança de limite (append-only)
 */
export interface BankLimitChangeRequest {
  id: string;
  tenantId: string;
  actorId: string;
  limitType: BankLimitType;
  /** Valor pedido em centavos (inteiro). */
  requestedAmountCents: MoneyCents;
  requestedAt: Date;
  effectiveAt: Date;
  status: LimitChangeRequestStatus;
  requestedByUserId?: string | null;
  authoritySource: AuthoritySource;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar pedido de mudança de limite
 */
export interface RequestLimitChangeInput {
  actorId: string;
  limitType: BankLimitType;
  amountCents: MoneyCents;
  requestedByUserId?: string;
  authoritySource?: AuthoritySource;
  metadata?: Record<string, any>;
  stepUpVerified?: boolean; // SPRINT 36.3: Flag de step-up verificado
}

/**
 * Limites atuais de um actor
 */
export interface CurrentLimits {
  actorId: string;
  limits: Record<
    BankLimitType,
    {
      currentAmountCents: MoneyCents;
      pending: {
        requestedAmountCents: MoneyCents;
        effectiveAt: Date;
      } | null;
    }
  >;
}

/**
 * Limite atual (derivado do read model ou calculado)
 */
export interface ActorLimit {
  limitType: BankLimitType;
  currentAmountCents: MoneyCents;
  pendingAmountCents?: MoneyCents | null;
  pendingEffectiveAt?: Date | null;
}



