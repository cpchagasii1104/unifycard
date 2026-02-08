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
  dispatchId: string;
  requestId: string;
  candidates: Array<{
    providerActorId: string;
    offeringId: string;
    eligibilityReason: string; // Texto determinístico explicando elegibilidade
  }>;
  rulesApplied: {
    trust: boolean; // Trust >= minTrustLevelRequired
    availability: boolean; // Availability bate com schedule
    online: boolean; // Provider online
    region: boolean; // Região compatível
  };
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  acceptedBy?: string; // providerActorId
  createdAt: string;
  acceptedAt?: string;
  expiredAt?: string;
}





