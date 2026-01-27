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
  pre_reservation_id: string;
  dispatch_id: string;
  request_id: string;
  provider_actor_id: string;
  offering_id: string;
  date: string; // ISO 8601 date
  time: string; // HH:mm
  quantity: number;
  hold_duration_minutes: number; // Duração da pré-reserva (padrão: 10)
  expires_at: string; // ISO 8601 - Quando a pré-reserva expira
  status: 'active' | 'confirmed' | 'expired' | 'released';
  created_at: string;
  confirmed_at?: string; // Quando vira ServiceBooking confirmado
  expired_at?: string; // Quando expira sem resposta
  released_at?: string; // Quando é liberada manualmente
}





