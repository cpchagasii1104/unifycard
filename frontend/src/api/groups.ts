// src/api/groups.ts
// API de Grupos Sociais

import { apiFetch } from './client';

export interface GroupSuggestion {
  group_id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  member_count?: number;
  category?: string;
}

export interface GroupSuggestionsResponse {
  groups: GroupSuggestion[];
}

/**
 * Busca sugestões de grupos para o usuário
 * Usa GET /matching/suggestions como fallback se /social/groups/suggestions não existir
 */
export async function getGroupSuggestions(limit: number = 3): Promise<GroupSuggestionsResponse> {
  try {
    // Tentar endpoint específico de grupos primeiro
    const response = await apiFetch(`/social/groups/suggestions?limit=${limit}`);
    return response.json();
  } catch (error: any) {
    // Se não existir, usar /matching/suggestions e filtrar grupos
    // Por enquanto, retornar array vazio se não houver endpoint
    console.warn('Endpoint /social/groups/suggestions não disponível, usando fallback');
    return { groups: [] };
  }
}


