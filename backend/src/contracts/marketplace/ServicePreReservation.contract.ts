// backend/src/contracts/marketplace/ServicePreReservation.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServicePreReservation (Pré-Reserva de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServicePreReservation - Pré-Reserva Temporária de Serviço
 * 
 * Sistema de pré-reserva (hold) temporária na agenda do provider.
 * Duração padrão: 10 minutos (configurável).
 * Expira automaticamente se não houver resposta.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServicePreReservation {
  preReservationId: string;
  dispatchId: string;
  requestId: string;
  providerActorId: string;
  offeringId: string;
  date: string; // ISO 8601 date
  time: string; // HH:mm
  quantity: number;
  holdDurationMinutes: number; // Duração da pré-reserva (padrão: 10)
  expiresAt: string; // ISO 8601 - Quando a pré-reserva expira
  status: 'active' | 'confirmed' | 'expired' | 'released';
  createdAt: string;
  confirmedAt?: string; // Quando vira ServiceBooking confirmado
  expiredAt?: string; // Quando expira sem resposta
  releasedAt?: string; // Quando é liberada manualmente
}





