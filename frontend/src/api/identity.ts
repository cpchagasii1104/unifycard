// src/api/identity.ts
// API de identidade global do usuário

import { apiFetch, extractErrorMessage } from './client';

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
  // DECISION-0120: estado da camada IDENTITY (projeção; profiles não é autoridade).
  // first_access_notice_seen → controla o MODAL (D2). can_edit_personal_data /
  // civil_data_confirmed → controlam o CADEADO civil (D3/D6).
  first_access_notice_seen?: boolean;
  civil_data_confirmed?: boolean;
  can_edit_personal_data?: boolean;
  // 🟢 F-ONBOARDING-MARCOS-PROJECTION (DECISION-0150): marcos READ-ONLY projetados pelo backend (não-autoridade;
  // o frontend CONSOME como hint em vez de adivinhar por metadata/has*). companyReady/providerReady/sellerReady
  // são per-company → endpoint próprio futuro (F-COMPANY-READINESS-PROJECTION), não vêm aqui.
  milestones?: {
    civilIdentityPresent: boolean;
    civilIdentityConfirmed: boolean;
    profileMinimumCompleted: boolean;
    actorReady: boolean;
  };
}

/**
 * DECISION-0120 D3: confirmação CIVIL EXPLÍCITA (depois de exibir os campos civis).
 * Grava evento auditável na camada identity e trava a edição civil.
 */
export async function confirmCivilData(): Promise<{ civil_data_confirmed: boolean; can_edit_personal_data: boolean }> {
  const response = await apiFetch('/identity/confirm-civil-data', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  return response.json();
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
  
  // 🔴 CORREÇÃO DEFINITIVA: Garantir que birthdate seja SEMPRE string YYYY-MM-DD (DATE puro) ou null
  // REGRA DE OURO: Backend só persiste DATE (YYYY-MM-DD), não aceita ISO completo
  // NUNCA enviar ISO completo (com T e timezone) - sempre extrair apenas YYYY-MM-DD
  const sanitizedInput: UpdateIdentityInput = { ...input };
  
  // 🔧 FIX (do not clear birthdate on partial update): Só processar birthdate se estiver presente no input
  // Se birthdate NÃO existir no input, NÃO adicionar ao payload (não apagar data existente)
  if ('birthdate' in input) {
    // Normalizar birthdate: aceita string "DD/MM/YYYY", "YYYY-MM-DD" ou ISO completo
    if (sanitizedInput.birthdate !== null && sanitizedInput.birthdate !== undefined && sanitizedInput.birthdate !== '') {
      let normalized: string | null = null;
      const birthdateValue = sanitizedInput.birthdate;
      
      // birthdate é sempre string no UpdateIdentityInput
      if (typeof birthdateValue === 'string') {
        const str = birthdateValue.trim();
        
        // 🔴 CORREÇÃO OBRIGATÓRIA: Se contém 'T' (ISO completo), extrair apenas YYYY-MM-DD
        if (str.includes('T')) {
          const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
          if (match) {
            normalized = match[1]; // Extrair apenas YYYY-MM-DD (slice(0, 10) equivalente)
          }
        }
        // Se já está no formato YYYY-MM-DD, usar diretamente
        else if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          normalized = str;
        }
        // Se contém "/" e tem 3 partes => DD/MM/YYYY ou MM/DD/YYYY
        else if (str.includes('/')) {
          const parts = str.split('/').filter(p => p.trim() !== '');
          if (parts.length === 3) {
            // Assumir formato brasileiro DD/MM/YYYY
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            // Validar se é data válida
            if (year.length === 4 && parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
              normalized = `${year}-${month}-${day}`;
            }
          }
        }
        // Se parece ser string de Date (GMT ou dia da semana), converter
        else if (str.includes('GMT') || str.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
          try {
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
              // 🔴 CRÍTICO: Extrair apenas YYYY-MM-DD (não usar toISOString que inclui hora/timezone)
              const year = date.getUTCFullYear();
              const month = String(date.getUTCMonth() + 1).padStart(2, '0');
              const day = String(date.getUTCDate()).padStart(2, '0');
              normalized = `${year}-${month}-${day}`;
            }
          } catch (e) {
            // Ignorar erro
          }
        }
      }
      
      // 🔴 GARANTIA FINAL: Garantir que normalized seja string YYYY-MM-DD ou null
      // Se por algum motivo ainda contém 'T' ou timezone, extrair apenas DATE puro
      if (normalized && normalized.includes('T')) {
        normalized = normalized.slice(0, 10);
      }
      
      // Validar formato final
      if (normalized && !normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        normalized = null;
      }
      
      sanitizedInput.birthdate = normalized;
    } else {
      // Se for vazio, null ou undefined (mas presente no input), enviar null
      sanitizedInput.birthdate = null;
    }
  } else {
    // 🔧 FIX (do not clear birthdate on partial update): Se birthdate NÃO está no input, remover do payload
    // Isso previne que a data existente seja apagada
    delete sanitizedInput.birthdate;
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
      throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
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

