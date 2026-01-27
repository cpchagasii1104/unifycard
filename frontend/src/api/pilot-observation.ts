// frontend/src/api/pilot-observation.ts
// SPRINT 15: API para observação humana (checklist e notas)

import { apiFetch } from './client';

export interface PilotChecklistItem {
  checklistId: string;
  tenantId: string;
  observedUserId: string;
  itemKey: string;
  itemLabel: string;
  checked: boolean;
  checkedByUserId?: string;
  checkedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PilotNote {
  noteId: string;
  tenantId: string;
  observedUserId: string;
  content: string;
  createdByUserId: string;
  createdAt: string;
}

/**
 * Lista usuários com checklist
 */
export async function listObservationUsers(): Promise<string[]> {
  const response = await apiFetch('/admin/pilot/observation/users');
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao listar usuários');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Lista checklist de um usuário
 */
export async function getChecklist(userId: string): Promise<PilotChecklistItem[]> {
  const response = await apiFetch(`/admin/pilot/observation/checklist/${userId}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao buscar checklist');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Inicializa checklist padrão para um usuário
 */
export async function initializeChecklist(userId: string): Promise<PilotChecklistItem[]> {
  const response = await apiFetch(`/admin/pilot/observation/checklist/${userId}/initialize`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao inicializar checklist');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Atualiza item do checklist
 */
export async function updateChecklistItem(
  userId: string,
  itemKey: string,
  itemLabel: string,
  checked: boolean
): Promise<PilotChecklistItem> {
  const response = await apiFetch(`/admin/pilot/observation/checklist/${userId}/item`, {
    method: 'PUT',
    body: JSON.stringify({
      itemKey,
      itemLabel,
      checked,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao atualizar checklist');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Lista notas de um usuário
 */
export async function getNotes(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<PilotNote[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const response = await apiFetch(`/admin/pilot/observation/notes/${userId}?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao listar notas');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Cria uma nota
 */
export async function createNote(userId: string, content: string): Promise<PilotNote> {
  const response = await apiFetch(`/admin/pilot/observation/notes/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao criar nota');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Deleta uma nota
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  const response = await apiFetch(`/admin/pilot/observation/notes/${noteId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao deletar nota');
  }

  const data = await response.json();
  return data.data?.deleted || false;
}







