// src/utils/guardrails.ts
// Guardrails e fallbacks para estados indefinidos

import { devLog } from './devLog';

/**
 * Valida se activeActor está disponível e válido
 */
export function validateActiveActor(activeActor: any): boolean {
  if (!activeActor) {
    devLog.warn('activeActor não está disponível');
    return false;
  }
  if (!activeActor.actor_id || !activeActor.actor_type) {
    devLog.warn('activeActor está incompleto:', activeActor);
    return false;
  }
  return true;
}

/**
 * Valida e retorna userCity com fallback
 */
export function safeUserCity(userCity: string | null | undefined): string | null {
  if (!userCity || typeof userCity !== 'string' || userCity.trim() === '') {
    return null;
  }
  return userCity.trim();
}

/**
 * Valida e retorna array de posts com fallback
 */
export function safePostsArray(posts: any[] | null | undefined): any[] {
  if (!Array.isArray(posts)) {
    devLog.warn('posts não é um array válido:', posts);
    return [];
  }
  return posts;
}

/**
 * Valida e retorna ledger entries com fallback
 */
export function safeLedgerEntries(entries: any[] | null | undefined): any[] {
  if (!Array.isArray(entries)) {
    devLog.warn('ledger entries não é um array válido:', entries);
    return [];
  }
  return entries;
}

/**
 * Valida e retorna número com fallback
 */
export function safeNumber(value: any, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  return fallback;
}

/**
 * Valida e retorna string com fallback
 */
export function safeString(value: any, fallback: string = ''): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return fallback;
}

/**
 * Valida e retorna timestamp de data com fallback
 */
export function safeDate(dateString: any, fallback: number = 0): number {
  if (!dateString) return fallback;
  try {
    const date = new Date(dateString).getTime();
    return isNaN(date) ? fallback : date;
  } catch {
    return fallback;
  }
}

/**
 * Valida e retorna array genérico com fallback
 */
export function safeArray<T>(value: any, fallback: T[] = []): T[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value;
}

/**
 * Wrapper para chamadas de API com tratamento de erro silencioso
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (err) {
    if (errorMessage) {
      devLog.warn(errorMessage, err);
    }
    return fallback;
  }
}


