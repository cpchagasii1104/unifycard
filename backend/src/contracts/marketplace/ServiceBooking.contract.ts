// backend/src/contracts/marketplace/ServiceBooking.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceBooking (Reserva de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceBooking - Reserva de Serviço
 * 
 * Representa uma reserva de serviço agendada.
 * Reserva NÃO executa pagamento - apenas bloqueia slot de agenda.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceBooking {
  bookingId: string;
  offeringId: string;
  userId: string;
  date: string; // ISO 8601 date (YYYY-MM-DD)
  time: string; // HH:mm
  quantity: number;
  status: 'reserved' | 'confirmed' | 'cancelled';
  createdAt: string;
}