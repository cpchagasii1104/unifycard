// backend/src/contracts/marketplace/IncentiveGrant.contract.ts
// CONTRATO PÚBLICO CONGELADO - IncentiveGrant (Concessão de Incentivo)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * IncentiveGrant - Concessão de Incentivo Econômico
 * 
 * Incentivo reduz custo real (frete, taxa, onboarding).
 * Nunca vira crédito livre.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface IncentiveGrant {
  grantId: string;
  ruleId: string;
  actorId: string;
  actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  region: {
    country: string;
    state: string;
    city: string;
  };
  incentiveType: 'delivery' | 'onboarding' | 'service' | 'logistics';
  amountCents: number; // Valor do incentivo concedido
  currency: string;
  reference: {
    orderId?: string;
    deliveryId?: string;
    subscriptionId?: string;
    onboardingId?: string;
  };
  status: 'granted' | 'consumed' | 'expired';
  grantedAt: string;
  consumedAt?: string;
  expiredAt?: string;
  // NÃO incluir updatedAt - grant é imutável após criação
}






