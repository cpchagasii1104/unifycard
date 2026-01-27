// frontend/src/api/agreements.ts
// API client para Negociação Assistida e Registro de Acordos
// 🔴 BLINDAGEM: Frontend NÃO calcula valores, apenas reflete estado do backend

import { apiFetch, apiFetchJson } from './client';

/**
 * Tipo de contexto do acordo
 */
export type AgreementContextType = 'event' | 'service' | 'rfq' | 'booking' | 'bundle';

/**
 * Status do acordo
 */
export type AgreementStatus = 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'FINALIZED';

/**
 * Agreement Draft
 */
export interface Agreement {
  agreementId: string;
  tenantId: string;
  contextType: AgreementContextType;
  contextId: string;
  threadId: string | null;
  requesterActorId: string;
  providerActorId: string;
  priceCents: number;
  currency: string;
  scope: string;
  includedItems: string[];
  excludedItems: string[];
  responsibilities: string;
  capacityAssumptions: string | null;
  status: AgreementStatus;
  createdByActorId: string;
  createdByUserId: string | null;
  finalizedAt: string | null;
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
 * Input para propor acordo
 */
export interface ProposeAgreementInput {
  messageId?: string;
}

/**
 * Input para aceitar acordo
 */
export interface AcceptAgreementInput {
  messageId?: string;
  actorId: string;
}

/**
 * Input para finalizar acordo
 */
export interface FinalizeAgreementInput {
  actorId: string;
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

/**
 * Cria um novo Agreement Draft
 */
export async function createAgreement(input: CreateAgreementInput): Promise<Agreement> {
  const response = await apiFetch('/agreements', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar acordo' }));
    throw new Error(error.error || 'Erro ao criar acordo');
  }

  const data = await response.json();
  return data.agreement;
}

/**
 * Busca agreement por ID
 */
export async function getAgreement(agreementId: string): Promise<Agreement> {
  return apiFetchJson<Agreement>(`/agreements/${agreementId}`);
}

/**
 * Lista agreements com filtros
 */
export async function listAgreements(filters: AgreementFilters = {}): Promise<{
  agreements: Agreement[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (filters.contextType) params.append('contextType', filters.contextType);
  if (filters.contextId) params.append('contextId', filters.contextId);
  if (filters.threadId) params.append('threadId', filters.threadId);
  if (filters.requesterActorId) params.append('requesterActorId', filters.requesterActorId);
  if (filters.providerActorId) params.append('providerActorId', filters.providerActorId);
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  return apiFetchJson<{ agreements: Agreement[]; total: number }>(
    `/agreements${queryString ? `?${queryString}` : ''}`
  );
}

/**
 * Busca agreement finalizado por contexto
 * 🔴 BLINDAGEM: Usado para validar se pode criar booking/bundle/service-order
 */
export async function getFinalizedAgreementByContext(
  contextType: string,
  contextId: string
): Promise<Agreement | null> {
  try {
    const response = await apiFetch(`/agreements/context/${contextType}/${contextId}/finalized`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Erro ao buscar acordo finalizado');
    }
    const data = await response.json();
    return data.agreement;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('não encontrado')) {
      return null;
    }
    throw error;
  }
}

/**
 * Atualiza Agreement Draft
 */
export async function updateAgreement(
  agreementId: string,
  input: UpdateAgreementInput
): Promise<Agreement> {
  const response = await apiFetch(`/agreements/${agreementId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao atualizar acordo' }));
    throw new Error(error.error || 'Erro ao atualizar acordo');
  }

  const data = await response.json();
  return data.agreement;
}

/**
 * Propõe acordo (muda status para PROPOSED)
 */
export async function proposeAgreement(
  agreementId: string,
  input: ProposeAgreementInput = {}
): Promise<Agreement> {
  const response = await apiFetch(`/agreements/${agreementId}/propose`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao propor acordo' }));
    throw new Error(error.error || 'Erro ao propor acordo');
  }

  const data = await response.json();
  return data.agreement;
}

/**
 * Aceita acordo (muda status para ACCEPTED)
 */
export async function acceptAgreement(
  agreementId: string,
  input: AcceptAgreementInput
): Promise<Agreement> {
  const response = await apiFetch(`/agreements/${agreementId}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao aceitar acordo' }));
    throw new Error(error.error || 'Erro ao aceitar acordo');
  }

  const data = await response.json();
  return data.agreement;
}

/**
 * Finaliza acordo (muda status para FINALIZED)
 */
export async function finalizeAgreement(
  agreementId: string,
  input: FinalizeAgreementInput
): Promise<Agreement> {
  const response = await apiFetch(`/agreements/${agreementId}/finalize`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao finalizar acordo' }));
    throw new Error(error.error || 'Erro ao finalizar acordo');
  }

  const data = await response.json();
  return data.agreement;
}

/**
 * Valida se pode criar booking/bundle/service-order
 * 🔴 BLINDAGEM: Endpoint usado internamente para validação
 */
export async function validateAgreementForClosure(input: {
  contextType: string;
  contextId: string;
  expectedPriceCents: number;
}): Promise<{ valid: boolean; agreement: Agreement | null; error?: string }> {
  const response = await apiFetch('/agreements/validate-closure', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao validar acordo' }));
    throw new Error(error.error || 'Erro ao validar acordo');
  }

  return response.json();
}




