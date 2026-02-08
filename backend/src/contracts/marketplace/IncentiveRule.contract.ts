// backend/src/contracts/marketplace/IncentiveRule.contract.ts
// CONTRATO PÚBLICO CONGELADO - IncentiveRule (Regra de Incentivo)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * IncentiveRule - Regra de Incentivo Econômico Direcionado
 * 
 * Incentivo nunca é automático.
 * Incentivo nunca é global.
 * Incentivo só pode ser usado se:
 * - Região desbloqueou incentive via snapshot
 * - Ator tem trust >= L2
 * - Tipo de incentivo está permitido
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface IncentiveRule {
  ruleId: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  incentiveType: 'delivery' | 'onboarding' | 'service' | 'logistics';
  maxAmountCents: number; // Valor máximo do incentivo
  maxPerActor: number; // Valor máximo por ator
  maxPerPeriod: number; // Valor máximo por período (mensal)
  currency: string;
  requiresTrustLevel: 'L2' | 'L3' | 'L4' | 'L5'; // Trust level mínimo
  status: 'active' | 'paused';
  createdAt: string;
  // NÃO incluir updatedAt - regra só pode ser pausada, nunca editada
}





