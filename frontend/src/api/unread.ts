// src/api/unread.ts
// API para contadores de novidade

import { apiFetch } from './client';

// F-C1-AUTO-REACHABLE-READ-PURITY: cada contador pode ser `null` = INDISPONÍVEL (erro estrutural
// no backend), distinto de `0` = contado/nada novo. O backend não retorna mais zero falso; a UI
// trata null como "sem badge / indisponível", nunca como "0 novas".
export interface UnreadCounts {
  feed: number | null;
  groups: number | null;
  events: number | null;
  services: number | null;
}

/**
 * Busca contadores de novidade para o menu social
 * Usa GET /social/unread-counts
 * Trata 404 como feature indisponível (não erro)
 */
export async function getUnreadCounts(): Promise<UnreadCounts> {
  try {
    const response = await apiFetch('/social/unread-counts', {}, { silent404: true });
    return await response.json();
  } catch (error: any) {
    // Se 404, tratar como feature indisponível (não erro)
    if (error?.code === 'FEATURE_UNAVAILABLE' || error?.status === 404) {
      return {
        feed: 0,
        groups: 0,
        events: 0,
        services: 0,
      };
    }
    
    // Fallback para rota antiga se nova rota não existir (não 404)
    try {
      const fallbackResponse = await apiFetch('/feed/unread-counts', {}, { silent404: true });
      return await fallbackResponse.json();
    } catch (fallbackError: any) {
      // Se 404 no fallback também, retornar zeros silenciosamente
      if (fallbackError?.code === 'FEATURE_UNAVAILABLE' || fallbackError?.status === 404) {
        return {
          feed: 0,
          groups: 0,
          events: 0,
          services: 0,
        };
      }
      
      // Outro erro - retornar zeros (não quebrar UI)
      return {
        feed: 0,
        groups: 0,
        events: 0,
        services: 0,
      };
    }
  }
}

