// backend/src/contracts/marketplace/ServiceVisit.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceVisit (Visita de Orçamento)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceVisit - Visita de Orçamento
 * 
 * Representa uma visita agendada para orçamento de serviço.
 * Criada quando provider aceita um ServiceRequest com intent='quote_required'.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceVisit {
  visitId: string;
  requestId: string;
  dispatchId: string;
  providerActorId: string;
  scheduledDate: string; // ISO 8601 date
  scheduledTime: string; // HH:mm
  status: 'visit_scheduled' | 'visit_completed' | 'visit_cancelled' | 'visit_expired';
  createdAt: string;
  completedAt?: string; // Quando a visita foi realizada
  cancelledAt?: string;
  expiredAt?: string;
}





