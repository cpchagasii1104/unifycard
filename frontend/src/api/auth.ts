// src/api/auth.ts
// API de autenticação - Registro e Login

import type { Gender } from '@unificard/contracts';
import { apiFetch, apiFetchPublic } from './client';

export interface RegisterRequest {
  email: string;
  password: string;
  cpf?: string;
  referralCode?: string;
  // 🔴 DADOS CIVIS IMUTÁVEIS (coletados no cadastro)
  fullName?: string;
  birthdate?: string; // YYYY-MM-DD
  /** Vocabulário canónico — alinhado a `auth.routes` + `@unificard/contracts` */
  gender?: Gender;
}

export interface LoginRequest {
  email: string;
  password: string;
  // tenantId é enviado via header x-tenant-id, não no body
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      userId: string;
      email: string;
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    tenantId?: string;
    requiresOnboarding?: boolean; // 🔴 PARTE 2 - ONBOARDING: Flag de primeiro acesso
  };
}

export async function register(
  email: string,
  password: string,
  cpf?: string,
  referralCode?: string,
  fullName?: string,
  birthdate?: string,
  gender?: Gender
): Promise<AuthResponse> {
  let response: Response;
  
  try {
    const body: RegisterRequest = { email, password };
    if (cpf) {
      body.cpf = cpf;
    }
    if (referralCode) {
      body.referralCode = referralCode;
    }
    // 🔴 DADOS CIVIS IMUTÁVEIS
    if (fullName) {
      body.fullName = fullName;
    }
    if (birthdate) {
      body.birthdate = birthdate;
    }
    if (gender) {
      body.gender = gender;
    }
    
    response = await apiFetchPublic('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Erro de rede (Failed to fetch)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('[API] Backend não disponível (register)');
      const friendlyMessage = 'Aguardando conexão com o servidor...';
      const errorObj = new Error(friendlyMessage) as any;
      errorObj.code = 'BACKEND_OFFLINE';
      errorObj.isRetryable = true;
      throw errorObj;
    }
    throw error;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao registrar' }));
    // T2 convergence (2026-05-14): mesmo pipeline canônico de client.ts (Bug 3 fix / 3ed43d50).
    // Backend pode retornar erro em 3 shapes — sem extrair `.message` do objeto aninhado
    // (shape c: Fastify default) o `new Error(obj)` virava "[object Object]" na UI.
    const nestedError = (error as any).error;
    let errorMessage: string;
    if (typeof (error as any).message === 'string') {
      errorMessage = (error as any).message;
    } else if (typeof nestedError === 'string') {
      errorMessage = nestedError;
    } else if (nestedError && typeof nestedError === 'object' && typeof nestedError.message === 'string') {
      errorMessage = nestedError.message;
    } else {
      errorMessage = `HTTP ${response.status}`;
    }
    const errorObj = new Error(errorMessage) as Error & { statusCode?: number };
    errorObj.statusCode = response.status;
    throw errorObj;
  }

  return response.json();
}

// Guard para prevenir múltiplas chamadas simultâneas de login
let loginInProgress = false;
let loginPromise: Promise<AuthResponse> | null = null;

export async function login(email: string, password: string, tenantId?: string): Promise<AuthResponse> {
  // 🔴 GARANTIA CANÔNICA: Login NUNCA deve enviar tenantId
  // tenantId vem do JWT após login bem-sucedido
  if (tenantId) {
    console.warn('[API] ⚠️ AVISO: tenantId fornecido ao login será ignorado (tenantId vem do JWT após login)');
    // Não bloquear, mas avisar - backend ignora mesmo assim
  }

  // Proteção contra múltiplas chamadas simultâneas
  if (loginInProgress && loginPromise) {
    console.warn('[API] Login já em andamento, aguardando requisição existente...');
    return loginPromise;
  }

  loginInProgress = true;
  
  loginPromise = (async () => {
    let response: Response;
    
    // Timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      // 🔴 GARANTIA CANÔNICA: NUNCA enviar x-tenant-id no login
      // Backend busca usuário apenas por email, tenantId vem do JWT após login
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      // tenantId NÃO é enviado - backend ignora mesmo se fornecido
      
      response = await apiFetchPublic('/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Erro de timeout ou abort
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.warn('[API] Timeout ao conectar com backend (login)');
        const errorObj = new Error('Servidor não respondeu. Verifique se o backend está rodando.') as any;
        errorObj.code = 'BACKEND_OFFLINE';
        errorObj.isRetryable = true;
        throw errorObj;
      }
      
      // Erro de rede (Failed to fetch)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('[API] Backend não disponível (login)');
        const errorObj = new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.') as any;
        errorObj.code = 'BACKEND_OFFLINE';
        errorObj.isRetryable = true;
        throw errorObj;
      }
      throw error;
    } finally {
      // Resetar flag após conclusão (sucesso ou erro)
      loginInProgress = false;
      loginPromise = null;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao fazer login' }));
      // T2 convergence (2026-05-14): mesmo pipeline canônico de client.ts (Bug 3 fix / 3ed43d50).
      // Backend pode retornar erro em 3 shapes — sem extrair `.message` do objeto aninhado
      // (shape c: Fastify default) o `new Error(obj)` virava "[object Object]" na UI.
      const nestedError = (error as any).error;
      let errorMessage: string;
      if (typeof (error as any).message === 'string') {
        errorMessage = (error as any).message;
      } else if (typeof nestedError === 'string') {
        errorMessage = nestedError;
      } else if (nestedError && typeof nestedError === 'object' && typeof nestedError.message === 'string') {
        errorMessage = nestedError.message;
      } else {
        errorMessage = `HTTP ${response.status}`;
      }

      // Tratar erro 429 especificamente
      if (response.status === 429) {
        const rateLimitError = new Error('Muitas tentativas de login. Aguarde alguns segundos antes de tentar novamente.') as any;
        rateLimitError.code = 'RATE_LIMIT';
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      throw new Error(errorMessage);
    }

    return response.json();
  })();

  return loginPromise;
}

/**
 * Verifica se um CPF já está cadastrado no sistema
 * @param cpf - CPF a ser verificado (apenas números)
 * @returns true se CPF existe, false caso contrário
 */
export async function checkCpfExists(cpf: string): Promise<boolean> {
  const cpfNumbers = cpf.replace(/\D/g, '');
  
  if (cpfNumbers.length !== 11) {
    return false;
  }

  try {
    const response = await apiFetchPublic(
      `/auth/check-cpf?cpf=${encodeURIComponent(cpfNumbers)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      // Se der erro, assumir que não existe (não bloquear cadastro)
      return false;
    }

    const data = await response.json();
    return data.exists === true;
  } catch (error) {
    // Em caso de erro de rede, não bloquear cadastro
    console.warn('[API] Erro ao verificar CPF:', error);
    return false;
  }
}

// 🔧 FIX (api consolidation): Funções de código de indicação movidas de referral.ts
export interface ReferralCodeResponse {
  referralCode: string;
}

export interface ApplyReferralCodeRequest {
  referralCode: string;
}

export interface ApplyReferralCodeResponse {
  referrerUserId: string;
}

export interface ValidateReferralCodeResponse {
  valid: boolean;
}

export async function getReferralCode(): Promise<ReferralCodeResponse> {
  const response = await apiFetch('/referral/code');
  return response.json();
}

export async function applyReferralCode(referralCode: string): Promise<ApplyReferralCodeResponse> {
  const response = await apiFetch('/referral/apply', {
    method: 'POST',
    body: JSON.stringify({ referralCode }),
  });
  return response.json();
}

/**
 * Validação PRÉ-SESSÃO de código de indicação (F-REGISTER-PRELAUNCH-BLOCKERS A1).
 * Usa o endpoint PÚBLICO /auth/check-referral via apiFetchPublic — sem JWT, sem
 * tenant do cliente (o backend resolve `unificard-inicial` server-side). Antes,
 * isto chamava /referral/validate (rota logada) e lançava TENANT_ID_REQUIRED no
 * pré-cadastro, bloqueando o usuário novo com código válido.
 *
 * Erro técnico pré-sessão NUNCA vira "código inválido" confirmado: só 200 com
 * { valid: false } é inválido confirmado; qualquer falha de rede/HTTP propaga
 * como exceção e o chamador trata como indeterminado (não bloqueia o cadastro).
 */
export async function validateReferralCode(code: string): Promise<ValidateReferralCodeResponse> {
  const response = await apiFetchPublic(`/auth/check-referral?code=${encodeURIComponent(code)}`);
  if (!response.ok) {
    // 400 (formato) também é resposta de validação → inválido confirmado.
    if (response.status === 400) {
      return { valid: false };
    }
    // 429/500/rede: indeterminado — propaga para o chamador NÃO marcar inválido.
    throw new Error(`check-referral falhou: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * A6 (2026-05-15): ganhos acumulados via código de indicação.
 * Backend agrega bank_splits.split_type='referral' onde target_account_id = user account.
 */
export interface ReferralEarnings {
  totalCents: number;
  count: number;
  hasAccount: boolean;
  currency: string;
}

export async function getReferralEarnings(): Promise<ReferralEarnings | null> {
  try {
    const response = await apiFetch('/referral/earnings', {}, { silent401: true, silent404: true });
    if (!response.ok) return null;
    const json = await response.json();
    const data = json?.data ?? json;
    return {
      totalCents: data.totalCents ?? 0,
      count: data.count ?? 0,
      hasAccount: !!data.hasAccount,
      currency: data.currency ?? 'BRL',
    };
  } catch (err) {
    console.warn('[API] Erro ao buscar ganhos de indicação:', err);
    return null;
  }
}
