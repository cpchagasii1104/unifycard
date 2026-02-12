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
  activationId: string;
  ruleId: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  snapshotId: string;
  actionType: 'suggest_hub' | 'unlock_incentive' | 'enable_industry_onboarding';
  actionPayload?: {
    incentiveType?: string;
    maxAmount?: number;
  };
  status: 'triggered' | 'consumed';
  createdAt: string;
  consumedAt?: string;
  // NÃO incluir updatedAt - evento é histórico e imutável
}





