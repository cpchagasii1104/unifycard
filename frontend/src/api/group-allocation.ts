// frontend/src/api/group-allocation.ts
// CONTINUOUS PRODUCTION: API para alocação de grupos - SPRINT 4

import { apiFetch, extractErrorMessage } from './client';
import { observePilotEvent } from '../services/pilot-observer.service';

export interface GroupAllocation {
  groupId: string;
  percentage: number; // 0-100
}

export interface GroupAllocationView {
  groupId: string;
  percentage: number; // 0-1 (decimal)
}

/**
 * Busca alocações de grupos do usuário autenticado
 * 
 * 🔴 REGRA CANÔNICA: Sempre retorna array, nunca lança erro
 * - Se não houver alocações: retorna []
 * - Se houver erro 500: retorna [] (não bloqueia criação de eventos)
 * - Se não autenticado: retorna []
 * - Permite criação de eventos sem contexto financeiro
 */
export async function getUserGroupAllocations(): Promise<GroupAllocationView[]> {
  try {
    const response = await apiFetch('/bank/user/group-allocation', {}, { silent401: true });
    
    if (!response.ok) {
      // Qualquer erro (401, 500, etc.) retorna array vazio
      // Não bloqueia criação de eventos sem contexto financeiro
      return [];
    }
    
    const data = await response.json().catch(() => ({}));
    
    // Garantir que sempre retornamos um array válido
    if (!data || typeof data !== 'object') {
      return [];
    }
    
    const allocations = data.allocations;
    if (!Array.isArray(allocations)) {
      return [];
    }
    
    return allocations;
  } catch (error) {
    // Em caso de qualquer erro (rede, parsing, etc.), retornar array vazio
    // Isso permite que criação de eventos funcione mesmo sem contexto financeiro
    console.warn('Erro ao buscar alocações de grupos (não bloqueante):', error);
    return [];
  }
}

/**
 * Define alocações de grupos do usuário
 */
export async function setUserGroupAllocations(
  allocations: GroupAllocation[]
): Promise<GroupAllocationView[]> {
  const response = await apiFetch(
    '/bank/user/group-allocation',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ allocations }),
    },
    { silent401: false }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao definir alocações: ${response.status}`));
  }
  
  const data = await response.json();
  return data.allocations || [];
}








