// backend/src/modules/marketplace/unifycard-method.types.ts
// SPRINT 82: UNIFYCARD MULTI-MÉTODOS

/**
 * Tipo de método de pagamento UnifyCard
 */
export type UnifyCardMethodType = 'CREDIT' | 'DEBIT' | 'PIX' | 'CASH' | 'VALE_REFEICAO' | 'VALE_ALIMENTACAO';

/**
 * Método de pagamento UnifyCard
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Nenhuma integração real
 * - Nenhum dinheiro externo
 * - Apenas modelagem
 * - Tudo auditável
 */
export interface UnifyCardMethod {
  id: string;
  tenantId: string;
  methodType: UnifyCardMethodType;
  provider: string; // Sempre 'UNIFYCARD'
  feePercentage: number; // Ex: 0.0299 = 2.99%
  settlementDelayDays: number; // Dias para liquidação
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Input para criar método UnifyCard
 */
export interface CreateUnifyCardMethodInput {
  methodType: UnifyCardMethodType;
  feePercentage?: number;
  settlementDelayDays?: number;
  metadata?: Record<string, any>;
}





