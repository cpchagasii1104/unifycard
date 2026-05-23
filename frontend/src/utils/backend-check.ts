// src/utils/backend-check.ts
// Utilitário para verificar conectividade com o backend

import { apiFetchPublic } from '../api/client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface BackendStatus {
  isOnline: boolean;
  url: string;
  error?: string;
  responseTime?: number;
}

/**
 * Verifica se o backend está online
 */
export async function checkBackendStatus(): Promise<BackendStatus> {
  const startTime = Date.now();
  
  try {
    const response = await apiFetchPublic('/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        isOnline: true,
        url: API_BASE_URL || 'não configurado',
        responseTime,
      };
    } else {
      return {
        isOnline: false,
        url: API_BASE_URL || 'não configurado',
        error: `Backend respondeu com status ${response.status}`,
        responseTime,
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        isOnline: false,
        url: API_BASE_URL || 'não configurado',
        error: `Não foi possível conectar ao backend em ${API_BASE_URL}. Verifique se o servidor está rodando.`,
        responseTime,
      };
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        isOnline: false,
        url: API_BASE_URL || 'não configurado',
        error: 'Timeout ao conectar ao backend. O servidor pode estar lento ou offline.',
        responseTime,
      };
    }
    
    return {
      isOnline: false,
      url: API_BASE_URL || 'não configurado',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      responseTime,
    };
  }
}

/**
 * Gera uma mensagem de erro amigável baseada no status do backend
 */
export function getFriendlyErrorMessage(error: string, backendStatus?: BackendStatus): string {
  // Se já temos uma mensagem amigável, retornar ela
  if (error.includes('Não foi possível conectar ao servidor')) {
    return error;
  }
  
  // Se o backend está offline, fornecer instruções
  if (backendStatus && !backendStatus.isOnline) {
    return `${error}\n\n💡 Dica: Verifique se o backend está rodando em ${backendStatus.url}`;
  }
  
  // Mensagens genéricas de "Failed to fetch"
  if (error.toLowerCase().includes('failed to fetch') || error.toLowerCase().includes('network error')) {
    const baseUrl = API_BASE_URL || 'http://localhost:3000';
    return `Erro de conexão: Não foi possível conectar ao servidor em ${baseUrl}.\n\n` +
           `Verifique:\n` +
           `1. Se o backend está rodando\n` +
           `2. Se a URL está correta no arquivo .env\n` +
           `3. Se não há problemas de firewall ou proxy`;
  }
  
  return error;
}




























