// backend/src/contracts/marketplace/RegionalActivationRule.contract.ts
// CONTRATO PÚBLICO CONGELADO - RegionalActivationRule (Regra de Ativação Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * RegionalActivationRule - Regra de Ativação Regional Automática
 * 
 * Usa EXCLUSIVAMENTE snapshots de Impacto Regional para ativar decisões automáticas
 * de expansão, incentivos e infraestrutura local.
 * 
 * Nada manual. Nada "admin aprovou". Nada subjetivo.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface RegionalActivationRule {
  ruleId: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  trigger: {
    metric: 'total_transactions_amount' | 'total_orders_count' | 'total_stores_active';
    operator: '>=' | '<='; 
    valueCents: number;
    period: 'monthly';
  };
  action: {
    type: 'suggest_hub' | 'unlock_incentive' | 'enable_industry_onboarding';
    payload?: {
      incentiveType?: string;
      maxAmount?: number;
    };
  };
  status: 'active' | 'paused';
  createdAt: string;
  // NÃO incluir updatedAt - regra só pode ser pausada, nunca editada
}






