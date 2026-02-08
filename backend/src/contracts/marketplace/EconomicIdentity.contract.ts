// backend/src/contracts/marketplace/EconomicIdentity.contract.ts
// CONTRATO PÚBLICO CONGELADO - EconomicIdentity (Identidade Econômica)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * EconomicIdentity - Identidade Econômica de um ator
 * 
 * Trust Level é derivado de fatos objetivos, nunca manual.
 * Sem IA, sem score oculto, sem override manual.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface EconomicIdentity {
  economicIdentityId: string;
  actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  actorId: string;
  trustLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  verifiedAssets: {
    documentsVerified: boolean; // CPF/CNPJ verificado
    bankAccountVerified: boolean; // Conta bancária verificada
    companyVerified: boolean; // Empresa verificada (se aplicável)
  };
  limits: {
    maxInvoiceAmount: number; // Valor máximo para faturamento B2B
    maxMonthlyVolume: number; // Volume mensal máximo permitido
  };
  status: 'active' | 'restricted' | 'suspended';
  createdAt: string;
  updatedAt: string;
}





