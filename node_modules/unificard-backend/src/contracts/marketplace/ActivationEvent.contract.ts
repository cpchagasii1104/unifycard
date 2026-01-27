// backend/src/contracts/marketplace/ActivationEvent.contract.ts
// CONTRATO PÚBLICO CONGELADO - ActivationEvent (Evento de Ativação Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ActivationEvent - Evento de Ativação Regional
 * 
 * Evento histórico de ativação automática baseada em métricas.
 * Nunca é apagado. Nunca é reexecutado.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ActivationEvent {
  activation_id: string;
  rule_id: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  snapshot_id: string;
  action_type: 'suggest_hub' | 'unlock_incentive' | 'enable_industry_onboarding';
  action_payload?: {
    incentive_type?: string;
    max_amount?: number;
  };
  status: 'triggered' | 'consumed';
  created_at: string;
  consumed_at?: string;
  // NÃO incluir updated_at - evento é histórico e imutável
}





