// src/api/identity.ts
// API de identidade global do usuário

import { apiFetch } from './client';

export interface IdentityProfile {
  global: {
    globalUserId: string;
    fullName: string | null;
    avatarUrl: string | null;
    birthdate: string | null;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  };
  local: {
    userId: string;
    tenantId: string;
    email: string;
    createdAt: string;
  };
  reputation?: {
    scores: Record<string, number>;
    summary: string;
  };
  wallet?: {
    balance: number;
    currency: string;
    totalIn: number;
    totalOut: number;
    lastTransactions: Array<{
      transactionId: string;
      type: 'credit' | 'debit';
      amount: number;
      createdAt: string;
    }>;
  };
  residence?: {
    country: {
      countryId: string;
      name: string;
      code: string;
    } | null;
    state: {
      stateId: string;
      name: string;
      code: string;
    } | null;
    city: {
      cityId: string;
      name: string;
    } | null;
    timezone: string | null;
    currency: string;
    languages: string[];
  };
}

export interface UpdateIdentityInput {
  fullName?: string | null;
  avatarUrl?: string | null;
  birthdate?: string | null;
  metadata?: Record<string, any>;
}

export async function getIdentityProfile(): Promise<IdentityProfile> {
  const response = await apiFetch('/identity/me');
  const result = await response.json();
  // Suportar formato antigo e novo
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

export async function updateIdentity(input: UpdateIdentityInput): Promise<IdentityProfile['global']> {
  console.log('[identity.ts] ========== INICIANDO updateIdentity ==========');
  console.log('[identity.ts] Input original:', input);
  
  // 🔴 CORREÇÃO DEFINITIVA: Garantir que birthdate seja SEMPRE string YYYY-MM-DD ou null
  // REGRA DE OURO: Data só vira string ISO curta. Nunca Date. Nunca .toString()
  const sanitizedInput: UpdateIdentityInput = { ...input };
  
  // Normalizar birthdate de forma agressiva e definitiva
  if (sanitizedInput.birthdate !== null && sanitizedInput.birthdate !== undefined && sanitizedInput.birthdate !== '') {
    let normalized: string | null = null;
    
    // Se for Date, converter para YYYY-MM-DD usando UTC
    // Verificação segura: usar type guard explícito
    const birthdateValue = sanitizedInput.birthdate;
    if (birthdateValue !== null && birthdateValue !== undefined) {
      // Verificar se é Date usando Object.prototype.toString para evitar erro TS2358
      const isDate = typeof birthdateValue === 'object' && Object.prototype.toString.call(birthdateValue) === '[object Date]';
      if (isDate) {
        const dateValue = birthdateValue as Date;
        const year = dateValue.getUTCFullYear();
        const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getUTCDate()).padStart(2, '0');
        normalized = `${year}-${month}-${day}`;
        console.warn('[identity.ts] ⚠️ birthdate era Date, convertido para:', normalized);
      }
    }
    // Se for string
    else if (typeof sanitizedInput.birthdate === 'string') {
      const str = sanitizedInput.birthdate.trim();
      
      // Se já está no formato YYYY-MM-DD, usar diretamente
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        normalized = str;
      }
      // Se parece ser string de Date (GMT ou dia da semana), converter
      else if (str.includes('GMT') || str.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
        try {
          const date = new Date(str);
          if (!isNaN(date.getTime())) {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            normalized = `${year}-${month}-${day}`;
            console.warn('[identity.ts] ⚠️ birthdate era string de Date, convertido para:', normalized);
          }
        } catch (e) {
          console.error('[identity.ts] ❌ Erro ao converter string de Date:', e);
          normalized = null;
        }
      }
      // Se contém T (ISO), extrair YYYY-MM-DD
      else if (str.includes('T')) {
        const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          normalized = match[0];
        }
      }
    }
    
    // Garantir que normalized seja string YYYY-MM-DD ou null
    if (normalized && !normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error('[identity.ts] ❌ Formato inválido após normalização:', normalized);
      normalized = null;
    }
    
    sanitizedInput.birthdate = normalized;
  }
  
  console.log('[identity.ts] Input sanitizado:', sanitizedInput);
  console.log('[identity.ts] URL completa:', `${import.meta.env.VITE_API_BASE_URL}/identity/update`);
  
  // 🔴 CRÍTICO: JSON.stringify com replacer que PROÍBE qualquer Date
  const jsonBody = JSON.stringify(sanitizedInput, (key, value) => {
    // PROIBIR Date - nunca deve chegar aqui, mas garantir
    if (value instanceof Date) {
      const year = value.getUTCFullYear();
      const month = String(value.getUTCMonth() + 1).padStart(2, '0');
      const day = String(value.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      console.error(`[identity.ts] ❌ ERRO CRÍTICO: Date encontrado no JSON.stringify no campo "${key}"! Convertendo para:`, dateStr);
      return dateStr;
    }
    // PROIBIR strings de Date
    if (typeof value === 'string' && (value.includes('GMT') || value.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/))) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          console.error(`[identity.ts] ❌ ERRO CRÍTICO: String de Date encontrada no JSON.stringify no campo "${key}"! Convertendo para:`, dateStr);
          return dateStr;
        }
      } catch (e) {
        // Ignorar
      }
    }
    return value;
  });
  
  console.log('[identity.ts] 📦 Body JSON final:', jsonBody);
  
  try {
    const response = await apiFetch('/identity/update', {
      method: 'POST',
      body: jsonBody,
    });
    
    console.log('[identity.ts] Status da resposta:', response.status, response.statusText);
    console.log('[identity.ts] Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      console.error('[identity.ts] ❌ ERRO na resposta:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(errorData.error || errorData.message || `Erro ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[identity.ts] ✅ Resposta recebida (sucesso):', result);
    console.log('[identity.ts] Tipo do resultado:', typeof result);
    console.log('[identity.ts] Keys do resultado:', Object.keys(result));
    
    // Verificar se o resultado tem a estrutura esperada
    if (!result || typeof result !== 'object') {
      console.error('[identity.ts] ❌ Resposta inválida - não é um objeto:', result);
      throw new Error('Resposta inválida do servidor');
    }
    
    return result;
  } catch (error) {
    console.error('[identity.ts] ❌ ERRO COMPLETO em updateIdentity:', error);
    throw error;
  }
}

