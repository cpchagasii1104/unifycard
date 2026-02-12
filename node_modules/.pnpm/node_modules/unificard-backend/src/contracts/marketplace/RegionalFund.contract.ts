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
  regionalFundId: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  balance: number; // Saldo atual do fundo
  currency: string; // Moeda (ex: 'BRL')
  rules: {
    minReserve: number; // Reserva mínima (fundo nunca pode zerar abaixo disso)
    maxMonthlyOutflow: number; // Saída máxima mensal permitida
    allowedUses: Array<'infrastructure' | 'incentives' | 'subsidies' | 'community_services'>;
  };
  governance: {
    decisionModel: 'automatic' | 'council';
    councilActorIds?: string[]; // IDs dos atores do conselho (se decisionModel = 'council')
  };
  status: 'active' | 'restricted';
  createdAt: string;
  updatedAt: string;
}





