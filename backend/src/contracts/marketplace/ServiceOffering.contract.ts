// backend/src/contracts/marketplace/ServiceOffering.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceOffering (Oferta de Serviço por Loja)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceOffering - Oferta de Serviço por Loja
 * 
 * Representa uma oferta de serviço ativada por uma loja a partir de um template canônico.
 * Cada loja pode ter múltiplas ofertas baseadas no mesmo template com preços e configurações diferentes.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceOffering {
  offeringId: string;
  storeId: string;
  templateId: string;
  price: {
    amountCents: number;
    currency: string;
  };
  durationMinutes?: number;
  recurrence?: 'weekly' | 'monthly';
  isActive: boolean;
}