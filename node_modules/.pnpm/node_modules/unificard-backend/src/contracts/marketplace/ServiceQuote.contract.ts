// backend/src/contracts/marketplace/ServiceQuote.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceQuote (Orçamento de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceQuote - Orçamento de Serviço
 * 
 * Orçamento enviado pelo provider após realizar visita.
 * Usuário pode aceitar, recusar ou solicitar nova visita.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceQuote {
  quoteId: string;
  requestId: string;
  visitId: string;
  providerActorId: string;
  serviceValue: {
    amountCents: number;
    currency: string;
  };
  description: string;
  requiresMaterials: boolean;
  executionDate?: string; // ISO 8601 date (opcional)
  executionTime?: string; // HH:mm (opcional)
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  expiredAt?: string;
  // Se aceito, gera ServiceBooking + ServiceOrder
  bookingId?: string;
  orderId?: string;
}





