// frontend/src/types/operational-state.ts
// CONTINUOUS PRODUCTION: Estado Operacional - SPRINT 6
// Modelo de estado que indica quando permitir, bloquear ou explicar limites

export type OperationalSeverity = 'info' | 'attention' | 'blocking';

export type ActionType =
  | 'create_service'
  | 'create_event'
  | 'invite_member'
  | 'manage_financial'
  | 'receive_payment'
  | 'publish_feed'
  | 'create_group'
  | 'allocate_groups'
  | 'transfer_money'
  | 'create_company';

export interface OperationalState {
  canPerform: boolean; // Se a ação pode ser executada
  reason?: string; // Explicação humana do limite/bloqueio
  severity?: OperationalSeverity; // Severidade do limite
  suggestion?: string; // Sugestão de como resolver (se aplicável)
  metadata?: Record<string, any>; // Dados adicionais
}







