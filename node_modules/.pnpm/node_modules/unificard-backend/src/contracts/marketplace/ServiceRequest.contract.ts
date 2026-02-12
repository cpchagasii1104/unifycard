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
  requestId: string;
  requesterActorId: string; // user
  city: string;
  neighborhood?: string; // Local determinístico; sem GPS
  intent: 'now' | 'scheduled' | 'bundle' | 'quote_required';
  serviceItems: Array<{
    offeringId: string;
    quantity: number;
  }>;
  schedule: {
    mode: 'now' | 'scheduled';
    maxWaitMinutes?: number; // Para 'now'
    date?: string; // ISO 8601 - Para 'scheduled'
    timeWindowMinutes?: number; // Para 'scheduled'
  };
  constraints: {
    providerRadiusMode: 'same_neighborhood' | 'same_city'; // Sem distância real
    minTrustLevelRequired: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    allowMultipleProviders: boolean; // Para bundle
  };
  status: 'open' | 'dispatched' | 'accepted' | 'expired' | 'cancelled';
  createdAt: string;
  dispatchedAt?: string;
  acceptedAt?: string;
  expiredAt?: string;
  cancelledAt?: string;
}

