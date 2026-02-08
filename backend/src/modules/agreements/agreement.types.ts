// backend/src/modules/agreements/agreement.types.ts
// Negociação Assistida e Registro de Acordos
// 🔴 BLINDAGEM: Nenhum booking/bundle/service-order pode ser confirmado sem acordo FINALIZED

/**
 * Tipo de contexto do acordo
 */
export type AgreementContextType = 'event' | 'service' | 'rfq' | 'booking' | 'bundle';

/**
 * Status do acordo
 */
export type AgreementStatus = 'draft' | 'proposed' | 'accepted' | 'finalized';

/**
 * Tipo de mensagem no chat de negociação
 */
export type NegotiationMessageType = 'informational' | 'proposal' | 'confirmation';

/**
 * Agreement Draft (Rascunho de Acordo)
 * 
 * REGRAS:
 * - Deve estar FINALIZED antes de qualquer fechamento
 * - Ambos os actors devem aceitar explicitamente
 * - Valor final do serviço vem do acordo, não do frontend
 */
export interface Agreement {
  agreementId: string;
  tenantId: string;
  contextType: AgreementContextType;
  contextId: string;
  threadId: string | null; // ID do chat contextual
  requesterActorId: string;
  providerActorId: string;
  priceCents: number;
  currency: string;
  scope: string; // Texto livre estruturado
  includedItems: string[]; // Equipamentos, serviços inclusos
  excludedItems: string[]; // Itens explicitamente excluídos
  responsibilities: string; // Quem fornece o quê
  capacityAssumptions: string | null; // Público estimado, carga técnica
  status: AgreementStatus;
  createdByActorId: string;
  createdByUserId: string | null;
  finalizedAt: Date | null;
  finalizedByActorId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar Agreement Draft
 */
export interface CreateAgreementInput {
  contextType: AgreementContextType;
  contextId: string;
  threadId?: string | null;
  requesterActorId: string;
  providerActorId: string;
  priceCents: number;
  currency: string;
  scope: string;
  includedItems?: string[];
  excludedItems?: string[];
  responsibilities?: string;
  capacityAssumptions?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar Agreement Draft
 */
export interface UpdateAgreementInput {
  priceCents?: number;
  currency?: string;
  scope?: string;
  includedItems?: string[];
  excludedItems?: string[];
  responsibilities?: string;
  capacityAssumptions?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para propor acordo (mudar status para PROPOSED)
 */
export interface ProposeAgreementInput {
  messageId?: string; // ID da mensagem do chat que contém a proposta
}

/**
 * Input para aceitar acordo (mudar status para ACCEPTED)
 */
export interface AcceptAgreementInput {
  messageId?: string; // ID da mensagem do chat que contém a confirmação
  actorId: string; // Actor que está aceitando
}

/**
 * Input para finalizar acordo (mudar status para FINALIZED)
 */
export interface FinalizeAgreementInput {
  actorId: string; // Actor que está finalizando
}

/**
 * Filtros para buscar agreements
 */
export interface AgreementFilters {
  contextType?: AgreementContextType;
  contextId?: string;
  threadId?: string;
  requesterActorId?: string;
  providerActorId?: string;
  status?: AgreementStatus;
  limit?: number;
  offset?: number;
}





