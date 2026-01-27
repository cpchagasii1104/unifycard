// backend/src/contracts/marketplace/ServiceRequest.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceRequest (Requisição de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceRequest - Requisição de Serviço
 * 
 * Orquestrador de demanda de serviços com 3 intenções:
 * - "Quero agora" (on-demand imediato)
 * - "Quero em data/horário" (agenda futura)
 * - "Quero um combo" (vários serviços no mesmo pacote)
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceRequest {
  request_id: string;
  requester_actor_id: string; // user
  city: string;
  neighborhood?: string; // Local determinístico; sem GPS
  intent: 'now' | 'scheduled' | 'bundle' | 'quote_required';
  service_items: Array<{
    offering_id: string;
    quantity: number;
  }>;
  schedule: {
    mode: 'now' | 'scheduled';
    max_wait_minutes?: number; // Para 'now'
    date?: string; // ISO 8601 - Para 'scheduled'
    time_window_minutes?: number; // Para 'scheduled'
  };
  constraints: {
    provider_radius_mode: 'same_neighborhood' | 'same_city'; // Sem distância real
    min_trust_level_required: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    allow_multiple_providers: boolean; // Para bundle
  };
  status: 'open' | 'dispatched' | 'accepted' | 'expired' | 'cancelled';
  created_at: string;
  dispatched_at?: string;
  accepted_at?: string;
  expired_at?: string;
  cancelled_at?: string;
}

