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
  grant_id: string;
  rule_id: string;
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  region: {
    country: string;
    state: string;
    city: string;
  };
  incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
  amount: number; // Valor do incentivo concedido
  currency: string;
  reference: {
    order_id?: string;
    delivery_id?: string;
    subscription_id?: string;
    onboarding_id?: string;
  };
  status: 'granted' | 'consumed' | 'expired';
  granted_at: string;
  consumed_at?: string;
  expired_at?: string;
  // NÃO incluir updated_at - grant é imutável após criação
}





