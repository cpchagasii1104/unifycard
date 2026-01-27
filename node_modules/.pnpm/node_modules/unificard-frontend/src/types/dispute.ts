// frontend/src/types/dispute.ts
// CONTINUOUS PRODUCTION: Tipos de Disputa - SPRINT 11
// Modelo institucional leve para contestação, esclarecimento e reversão humana

export type DisputeStatus = 'open' | 'resolved' | 'rejected' | 'reverted';

export type DisputeReason = 'erro' | 'desacordo' | 'execucao_indevida' | 'outro';

export interface Dispute {
  id: string;
  relatedActivityId: string; // ID da atividade contestada
  actorId: string; // Actor relacionado à disputa
  openedByUserId: string; // Usuário que abriu a disputa
  openedAt: string; // ISO timestamp
  reason: DisputeReason;
  description: string; // Descrição humana da contestação
  status: DisputeStatus;
  resolvedByUserId?: string; // Usuário que resolveu (se resolvida)
  resolvedAt?: string; // ISO timestamp
  resolutionNote?: string; // Nota de resolução
  revertedTransactionId?: string; // ID da transação revertida (se aplicável)
  metadata?: {
    [key: string]: any;
  };
}

export function getDisputeStatusLabel(status: DisputeStatus): string {
  switch (status) {
    case 'open':
      return 'Aberta';
    case 'resolved':
      return 'Resolvida';
    case 'rejected':
      return 'Rejeitada';
    case 'reverted':
      return 'Revertida';
    default:
      return 'Desconhecido';
  }
}

export function getDisputeReasonLabel(reason: DisputeReason): string {
  switch (reason) {
    case 'erro':
      return 'Erro na execução';
    case 'desacordo':
      return 'Desacordo sobre a ação';
    case 'execucao_indevida':
      return 'Execução indevida';
    case 'outro':
      return 'Outro motivo';
    default:
      return 'Não especificado';
  }
}

export function getDisputeReasonDescription(reason: DisputeReason): string {
  switch (reason) {
    case 'erro':
      return 'A ação foi executada incorretamente ou com dados errados';
    case 'desacordo':
      return 'Há desacordo sobre a necessidade ou validade da ação';
    case 'execucao_indevida':
      return 'A ação foi executada sem autorização adequada';
    case 'outro':
      return 'Outro motivo que requer revisão';
    default:
      return '';
  }
}







