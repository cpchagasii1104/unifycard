// frontend/src/api/institutional-memory.ts
// SPRINT 26: Memória Institucional Declarativa
// API client para declarações de aprendizado institucional
//
// ═══════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO DE RESPONSABILIDADE (SPRINT 28)
// ═══════════════════════════════════════════════════════════════
// CAMADA: Memória Institucional
// PÚBLICO PERMITIDO: Apenas admin em modo piloto
// 
// ❌ NÃO USAR FORA DO CONTEXTO DE MEMÓRIA INSTITUCIONAL
// ❌ NÃO importar em componentes de ação
// ❌ NÃO importar em handlers de execução
// ❌ NÃO importar em fluxos de usuário final
// 
// ✅ USAR APENAS em:
//    - Componentes de memória institucional
//    - Painel admin de leitura institucional
//    - Ferramentas de registro de aprendizado
// ═══════════════════════════════════════════════════════════════

import { apiFetch, extractErrorMessage } from './client';

export interface InstitutionalMemoryDeclaration {
  declarationId: string;
  tenantId: string;
  content: string;
  authorUserId: string;
  context: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateInstitutionalMemoryInput {
  content: string;
  context?: string;
}

/**
 * Lista declarações de aprendizado institucional
 */
export async function listInstitutionalMemory(
  options?: {
    limit?: number;
    offset?: number;
    context?: string;
  }
): Promise<InstitutionalMemoryDeclaration[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.context) params.append('context', options.context);

  const response = await apiFetch(`/admin/pilot/institutional-memory?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao listar declarações'));
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Cria uma nova declaração de aprendizado
 */
export async function createInstitutionalMemory(
  input: CreateInstitutionalMemoryInput
): Promise<InstitutionalMemoryDeclaration> {
  const response = await apiFetch('/admin/pilot/institutional-memory', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao criar declaração'));
  }

  const data = await response.json();
  return data.data;
}

/**
 * Atualiza versão de uma declaração
 */
export async function updateInstitutionalMemory(
  declarationId: string,
  content: string
): Promise<InstitutionalMemoryDeclaration> {
  const response = await apiFetch(`/admin/pilot/institutional-memory/${declarationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao atualizar declaração'));
  }

  const data = await response.json();
  return data.data;
}

/**
 * Remove uma declaração (soft delete)
 */
export async function deleteInstitutionalMemory(
  declarationId: string
): Promise<void> {
  const response = await apiFetch(`/admin/pilot/institutional-memory/${declarationId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, 'Erro ao deletar declaração'));
  }
}

