// backend/src/contracts/marketplace/RegionalFund.contract.ts
// CONTRATO PÚBLICO CONGELADO - RegionalFund (Fundo Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * RegionalFund - Fundo Regional do Marketplace
 * 
 * Ator econômico real do ecossistema, com regras claras de entrada, saída, uso e impacto local.
 * Totalmente auditável e determinístico.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface RegionalFund {
  regional_fund_id: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  balance: number; // Saldo atual do fundo
  currency: string; // Moeda (ex: 'BRL')
  rules: {
    min_reserve: number; // Reserva mínima (fundo nunca pode zerar abaixo disso)
    max_monthly_outflow: number; // Saída máxima mensal permitida
    allowed_uses: Array<'infrastructure' | 'incentives' | 'subsidies' | 'community_services'>;
  };
  governance: {
    decision_model: 'automatic' | 'council';
    council_actor_ids?: string[]; // IDs dos atores do conselho (se decision_model = 'council')
  };
  status: 'active' | 'restricted';
  created_at: string;
  updated_at: string;
}





