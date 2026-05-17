// frontend/src/api/pilot-hypotheses.ts
// SPRINT 16: API para hipóteses de interpretação humana

import { apiFetch, extractErrorMessage } from './client';

export interface PilotHypothesis {
  hypothesisId: string;
  tenantId: string;
  content: string;
  createdByUserId: string;
  createdAt: string;
}

/**
 * Lista hipóteses
 */
export async function listHypotheses(options?: {
  limit?: number;
  offset?: number;
}): Promise<PilotHypothesis[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const response = await apiFetch(`/admin/pilot/observation/hypotheses?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao listar hipóteses'));
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Cria uma hipótese
 */
export async function createHypothesis(content: string): Promise<PilotHypothesis> {
  const response = await apiFetch('/admin/pilot/observation/hypotheses', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao criar hipótese'));
  }

  const data = await response.json();
  return data.data;
}

/**
 * Deleta uma hipótese
 */
export async function deleteHypothesis(hypothesisId: string): Promise<boolean> {
  const response = await apiFetch(`/admin/pilot/observation/hypotheses/${hypothesisId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao deletar hipótese'));
  }

  const data = await response.json();
  return data.data?.deleted || false;
}







