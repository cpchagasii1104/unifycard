// src/api/unread.ts
// API para contadores de novidade

import { apiFetch } from './client';

export interface UnreadCounts {
  feed: number;
  groups: number;
  events: number;
  services: number;
}

/**
 * Busca contadores de novidade para o menu social
 * Usa GET /feed/unread-counts (CORE FEED)
 */
export async function getUnreadCounts(): Promise<UnreadCounts> {
  try {
    const response = await apiFetch('/feed/unread-counts');
    return response.json();
  } catch (error) {
    // Em caso de erro, retornar zeros (não quebrar UI)
    console.warn('Erro ao buscar contadores de novidade:', error);
    return {
      feed: 0,
      groups: 0,
      events: 0,
      services: 0,
    };
  }
}

