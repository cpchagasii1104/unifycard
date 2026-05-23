// src/modules/dispatch/opportunity-dispatch.types.ts
// Tipos do Domínio de DISPATCH DE OPORTUNIDADES
// 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
// 🔴 BLINDAGEM: Aceitar não garante nada
// 🔴 BLINDAGEM: Rejeitar não penaliza
// 🔴 BLINDAGEM: Expirar não gera score
// 🔴 BLINDAGEM: NÃO faz matching
// 🔴 BLINDAGEM: NÃO prioriza
// 🔴 BLINDAGEM: NÃO escolhe "melhor"
// 🔴 BLINDAGEM: Apenas NOTIFICA quem PODE atuar

/**
 * Tipo de Oportunidade
 * 🔴 BLINDAGEM: Fontes de oportunidade são explícitas
 */
export enum OpportunityType {
  SERVICE = 'service', // Serviço disponível
  JOB = 'job',         // Vaga publicada
  PROJECT = 'project', // Projeto criado
}

/**
 * Resposta ao Dispatch
 * 🔴 BLINDAGEM: Resposta não garante nada, não penaliza, não gera score
 */
export enum DispatchResponse {
  ACCEPTED = 'accepted', // Dispatch aceito
  DECLINED = 'declined', // Dispatch rejeitado
  EXPIRED = 'expired',   // Dispatch expirado
}

/**
 * Dispatch de Oportunidade (entidade de domínio)
 * 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
 * 🔴 BLINDAGEM: Aceitar não garante nada
 * 🔴 BLINDAGEM: Rejeitar não penaliza
 * 🔴 BLINDAGEM: Expirar não gera score
 */
export interface OpportunityDispatch {
  dispatchId: string;
  tenantId: string;
  opportunityId: string; // OBRIGATÓRIO: ID da oportunidade
  opportunityType: OpportunityType; // OBRIGATÓRIO: Tipo da oportunidade
  targetActorId: string; // OBRIGATÓRIO: Actor que recebe o dispatch
  response?: DispatchResponse | null; // Resposta do actor (nullable até responder)
  dispatchedAt: Date;
  respondedAt?: Date | null; // Quando foi respondido (se response não for null)
  expiresAt?: Date | null; // Quando expira (opcional)
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Linha do banco de dados (OpportunityDispatchRow)
 */
export interface OpportunityDispatchRow {
  dispatch_id: string;
  tenant_id: string;
  opportunity_id: string;
  opportunity_type: OpportunityType;
  target_actor_id: string;
  response: DispatchResponse | null;
  dispatched_at: Date;
  responded_at: Date | null;
  expires_at: Date | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Input para criar dispatch de oportunidade
 * 🔴 BLINDAGEM: opportunityId, opportunityType e targetActorId são OBRIGATÓRIOS
 */
export interface CreateOpportunityDispatchInput {
  opportunityId: string; // OBRIGATÓRIO
  opportunityType: OpportunityType; // OBRIGATÓRIO
  targetActorId: string; // OBRIGATÓRIO
  expiresAt?: Date | null; // Opcional: Quando expira
  metadata?: Record<string, any>;
}

/**
 * Input para responder a um dispatch
 * 🔴 BLINDAGEM: response é OBRIGATÓRIO
 */
export interface RespondToDispatchInput {
  response: DispatchResponse; // OBRIGATÓRIO
  metadata?: Record<string, any>;
}

/**
 * Filtros para busca de dispatches
 */
export interface OpportunityDispatchFilters {
  opportunityId?: string;
  opportunityType?: OpportunityType;
  targetActorId?: string;
  response?: DispatchResponse | null; // null = pendentes
}



