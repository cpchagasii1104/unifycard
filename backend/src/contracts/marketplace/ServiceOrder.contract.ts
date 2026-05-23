// backend/src/contracts/marketplace/ServiceOrder.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceOrder (Ordem de serviço - agendamento)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceOrder - Ordem de serviço (agendamento)
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceOrder {
  orderId: string;
  bookingId: string;
  offeringId: string;
  price: {
    amountCents: number;
    currency: string;
  };
  channel: 'online';
  createdAt: string;
  /** Opcional: request de serviço associado (uso interno/domínio). */
  requestId?: string;
  /** Opcional: status da ordem de serviço (uso interno/domínio). */
  status?: string;
}





