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
  rule_id: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  trigger: {
    metric: 'total_transactions_amount' | 'total_orders_count' | 'total_stores_active';
    operator: '>=' | '<=';
    value: number;
    period: 'monthly';
  };
  action: {
    type: 'suggest_hub' | 'unlock_incentive' | 'enable_industry_onboarding';
    payload?: {
      incentive_type?: string;
      max_amount?: number;
    };
  };
  status: 'active' | 'paused';
  created_at: string;
  // NÃO incluir updated_at - regra só pode ser pausada, nunca editada
}





