// backend/src/contracts/marketplace/ServiceCompletionSignal.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceCompletionSignal (Sinal de Conclusão de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceCompletionSignal - Sinal de Conclusão de Serviço
 * 
 * Sinal enviado por cliente ou provider para confirmar, disputar ou cancelar
 * a conclusão de um serviço.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceCompletionSignal {
  signal_id: string;
  request_id: string;
  actor_id: string;
  role: 'customer' | 'provider';
  action: 'confirm_completed' | 'dispute' | 'cancel';
  reason?: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other';
  created_at: string;
}





