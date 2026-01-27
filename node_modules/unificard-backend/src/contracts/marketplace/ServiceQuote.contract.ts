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
  quote_id: string;
  request_id: string;
  visit_id: string;
  provider_actor_id: string;
  service_value: {
    amount: number;
    currency: string;
  };
  description: string;
  requires_materials: boolean;
  execution_date?: string; // ISO 8601 date (opcional)
  execution_time?: string; // HH:mm (opcional)
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  accepted_at?: string;
  declined_at?: string;
  expired_at?: string;
  // Se aceito, gera ServiceBooking + ServiceOrder
  booking_id?: string;
  order_id?: string;
}





