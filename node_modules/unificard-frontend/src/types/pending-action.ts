// frontend/src/types/pending-action.ts
// CONTINUOUS PRODUCTION: Tipo de Pendência - SPRINT 5
// Modelo de pendência inferido a partir de dados reais

export type PendingActionSeverity = 'info' | 'attention' | 'blocking';

export type PendingActionType =
  | 'company_no_members'
  | 'company_no_bank_account'
  | 'invitation_pending'
  | 'group_no_allocation'
  | 'zero_balance_with_activity'
  | 'permission_blocked';

export interface PendingAction {
  id: string; // Identificador único da pendência
  actorId: string; // Actor relacionado (company, user, etc.)
  type: PendingActionType;
  message: string; // Mensagem humana explicando a pendência
  severity: PendingActionSeverity;
  createdAt: string; // Timestamp da detecção
  action?: {
    label: string; // Texto do botão/ação
    path?: string; // Rota para resolver
    onClick?: () => void; // Callback alternativo
  };
  metadata?: Record<string, any>; // Dados adicionais (ex: companyId, invitationId)
}







