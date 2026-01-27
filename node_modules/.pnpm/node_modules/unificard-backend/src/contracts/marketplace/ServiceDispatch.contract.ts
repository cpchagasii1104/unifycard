// backend/src/contracts/marketplace/ServiceDispatch.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceDispatch (Dispatch de Requisição de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceDispatch - Dispatch de Requisição de Serviço
 * 
 * Dispatch determinístico para providers elegíveis.
 * Nada de broadcast para "todo mundo".
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceDispatch {
  dispatch_id: string;
  request_id: string;
  candidates: Array<{
    provider_actor_id: string;
    offering_id: string;
    eligibility_reason: string; // Texto determinístico explicando elegibilidade
  }>;
  rules_applied: {
    trust: boolean; // Trust >= min_trust_level_required
    availability: boolean; // Availability bate com schedule
    online: boolean; // Provider online
    region: boolean; // Região compatível
  };
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  accepted_by?: string; // provider_actor_id
  created_at: string;
  accepted_at?: string;
  expired_at?: string;
}





