// src/api/client.ts
import { getAuthToken, getTenantId } from '../config/auth';

// Usar valor padrão se não estiver configurado (desenvolvimento local)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Aviso apenas em console, não quebra o sistema
if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn('[API] VITE_API_BASE_URL não configurada, usando padrão:', API_BASE_URL);
  console.warn('[API] Para configurar, crie arquivo .env na pasta frontend/ com: VITE_API_BASE_URL=http://localhost:3000');
}

// Flag global para indicar se estamos em bootstrap inicial (após login)
// Durante bootstrap, 401s não devem causar logout
let isBootstraping = false;
let bootstrapStartTime = 0;
const BOOTSTRAP_GRACE_PERIOD = 5000; // 5 segundos após login

export function setBootstraping(value: boolean) {
  isBootstraping = value;
  if (value) {
    bootstrapStartTime = Date.now();
  }
}

export function isInBootstrapGracePeriod(): boolean {
  if (!isBootstraping) return false;
  return Date.now() - bootstrapStartTime < BOOTSTRAP_GRACE_PERIOD;
}

// 🔴 ESTABILIZAÇÃO DE SESSÃO: Lista explícita de endpoints NÃO-CRÍTICOS para 401
// Estes endpoints podem retornar 401 sem limpar a sessão
// Critérios: token presente + sessão autenticada + endpoint na lista
const NON_CRITICAL_401_ENDPOINTS = [
  '/profile/progress',
  '/profile/inference',
  '/plan',
  // ✅ FIX: REMOVIDO daqui porque é endpoint CRÍTICO pro bootstrap
  // '/social/actors/available',
] as const;

/**
 * Verifica se um endpoint é considerado NÃO-CRÍTICO para 401
 * @param path Caminho do endpoint
 * @returns true se o endpoint está na lista de não-críticos
 */
function isNonCritical401Endpoint(path: string): boolean {
  return NON_CRITICAL_401_ENDPOINTS.some(endpoint => path.includes(endpoint));
}

/**
 * Verifica se um 401 deve ser tratado como CRÍTICO (limpar sessão) ou NÃO-CRÍTICO (apenas logar)
 * @param path Caminho do endpoint
 * @param errorMessage Mensagem de erro da resposta
 * @returns true se for 401 CRÍTICO (deve limpar sessão)
 */
function isCritical401(path: string, errorMessage: string): boolean {
  // 1. Endpoints de identidade/autenticação são SEMPRE críticos
  if (path.startsWith('/auth/') || path.startsWith('/session/') || path === '/auth/me') {
    return true;
  }
  
  // 2. Mensagem explícita de token inválido/expirado é SEMPRE crítica
  const expiredKeywords = [
    'expired',
    'expirada',
    'invalid or expired token',
    'token expired',
    'token inválido',
    'token invalido',
  ];
  const isExplicitlyExpired = expiredKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
  if (isExplicitlyExpired) {
    return true;
  }
  
  // 3. Se endpoint está na lista de não-críticos, não é crítico
  if (isNonCritical401Endpoint(path)) {
    return false;
  }
  
  // 4. Por padrão, outros 401s são críticos (comportamento conservador)
  return true;
}

export interface ApiFetchContextOptions {
  silent401?: boolean;
  silent404?: boolean; // Tratar 404 como feature indisponível (não erro)
}

const ACTOR_STORAGE_KEY = 'unificard_active_actor_id';

/**
 * Aguarda `unificard_active_actor_id` no localStorage (ex.: outro fluxo acabou de persistir).
 * Não bloqueia a UI; usar apenas de apiFetch ou chamadas pontuais.
 */
export async function waitForActorContext(maxMs = 2000, pollMs = 50): Promise<string | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const id = localStorage.getItem(ACTOR_STORAGE_KEY)?.trim();
    if (id) return id;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}

/**
 * Rotas que NÃO exigem actorId no cliente (bootstrap, auth, health).
 * Demais rotas com token+tenant disparam enforcement se actor ausente após espera.
 */
export function isPathExemptFromActorRequirement(path: string): boolean {
  const p = path.split('?')[0];
  if (p.startsWith('/auth/')) return true;
  if (p.includes('/social/actors/available')) return true;
  if (p === '/health' || p.startsWith('/health/')) return true;
  // CORE profile: JWT + tenant; actorId é query opcional (contrato core.routes).
  if (p === '/core/profile') return true;
  return false;
}

/**
 * HTTP para rotas públicas ou pré-sessão (sem tenant obrigatório nem ActionContext).
 * Registo, login, health, links de pagamento guest. Única implementação de `fetch` além de `apiFetch`.
 */
export async function apiFetchPublic(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  delete headers['x-acting-actor-id'];
  delete headers['x-actor-id'];

  const timeoutMs = path.includes('/location/cep/') ? 15000 : 10000;
  return fetch(url, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export async function apiFetch(
  path: string, 
  options: RequestInit = {},
  contextOptions?: ApiFetchContextOptions
): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  
  // Se body for FormData, não definir Content-Type (browser define automaticamente com boundary)
  const isFormData = options.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  // Não enviar headers que o backend ActionContext não usa (evita confusão com contrato V2)
  delete headers['x-acting-actor-id'];
  delete headers['x-actor-id'];

  // Adicionar token de autenticação se existir
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 🔴 INVARIANTE ABSOLUTA: tenantId é OBRIGATÓRIO após autenticação
  // JWT é a fonte única de verdade - storage é apenas cache
  // Nenhuma request autenticada pode prosseguir sem tenantId válido
  
  // FASE 1: Tentar obter do storage (cache)
  let tenantId = getTenantId();
  
  // FASE 2: Se não estiver no storage E houver token, extrair do JWT (UMA VEZ)
  // Após extrair e salvar, nunca re-extrai (storage é atualizado imediatamente)
  if (!tenantId && token) {
    try {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      tenantId = tokenPayload.tenantId;
      
      // 🔴 VALIDAÇÃO EXPLÍCITA: tenantId deve ser string não vazia
      if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        throw new Error('tenantId ausente ou inválido no JWT');
      }
      
      // 🔴 SALVAR IMEDIATAMENTE: Persistir no storage para próximas requisições
      // Após salvar, nunca re-extrai (storage é atualizado)
      const { setTenantId } = await import('../config/auth');
      setTenantId(tenantId);
      // Log apenas em desenvolvimento para diagnóstico
      if (import.meta.env.DEV) {
        console.log('[API] tenantId extraído do JWT e salvo no storage');
      }
    } catch (e) {
      // 🔴 ERRO FATAL: Não continuar sem tenantId válido
      const errorMessage = e instanceof Error ? e.message : 'Falha ao extrair tenantId do JWT';
      const error = new Error(`TENANT_ID_REQUIRED: ${errorMessage}`) as any;
      error.code = 'MISSING_TENANT';
      error.status = 400;
      error.details = { 
        tokenPresent: !!token, 
        extractionFailed: true,
        path 
      };
      throw error;
    }
  }
  
  // 🔴 INVARIANTE ABSOLUTA: Se não houver tenantId após tentativas, ERRO FATAL
  // Nenhuma request autenticada pode prosseguir sem tenantId
  if (!tenantId) {
    const error = new Error('TENANT_ID_REQUIRED: tenantId ausente — estado inválido de sessão') as any;
    error.code = 'MISSING_TENANT';
    error.status = 400;
    error.details = { 
      tokenPresent: !!token,
      path 
    };
    throw error;
  }
  
  // 🔴 GARANTIA FINAL: tenantId válido - sempre enviar header
  headers['x-tenant-id'] = tenantId;

  // ActionContext V2 (SSOT): actorId só de unificard_active_actor_id (nunca JWT/userId).
  // Enforcement: rotas protegidas sem actor após espera → DEV throw, PROD console.error
  const exemptFromActor = isPathExemptFromActorRequirement(path);
  if (!headers['x-action-context'] && token && tenantId.trim() !== '') {
    let actorForContext = localStorage.getItem(ACTOR_STORAGE_KEY)?.trim() ?? '';
    if (!actorForContext && !exemptFromActor) {
      actorForContext = (await waitForActorContext(2000))?.trim() ?? '';
    }
    if (!exemptFromActor && !actorForContext) {
      const payload = { path, hasToken: true, hasActor: false };
      if (import.meta.env.DEV) {
        console.error('[apiFetch] Protected route without ActionContext', payload);
        throw new Error('Protected route called without ActionContext (actorId missing)');
      }
      console.error('[apiFetch] Protected route without ActionContext', payload);
    }
    if (actorForContext) {
      headers['x-action-context'] = JSON.stringify({
        actorId: actorForContext,
        intent: 'user_action',
        source: 'frontend',
        scope: `tenant:${tenantId.trim()}`,
      });
    }
  }
  
  // 🔴 DIAGNÓSTICO: Log apenas em desenvolvimento e apenas para endpoints específicos
  // Eliminar logs ambíguos - apenas informações essenciais
  if (import.meta.env.DEV && (path.includes('/autocomplete') || path.includes('/categories/tree'))) {
    console.log('[apiFetch]', {
      path,
      tenantId: headers['x-tenant-id'] ? 'present' : 'MISSING',
      hasToken: !!token
    });
  }

  let response: Response;
  try {
    // 🔴 TIMEOUT OTIMIZADO: Backend agora tenta BrasilAPI primeiro (5s) + ViaCEP fallback (8s)
    // Total máximo: ~13s, mas geralmente responde em 1-3s
    const timeoutMs = path.includes('/location/cep/') ? 15000 : 10000;
    
    response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Erro de rede (Failed to fetch) - mensagem mais amigável
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Não lançar erro imediatamente - deixar o sistema tentar reconectar
      // Apenas logar no console para debug
      console.warn('[API] Backend não disponível, tentando reconectar...', API_BASE_URL);
      
      // Retornar uma resposta de erro amigável que não quebra o sistema
      const friendlyMessage = 'Aguardando conexão com o servidor...';
      const errorObj = new Error(friendlyMessage) as any;
      errorObj.code = 'BACKEND_OFFLINE';
      errorObj.isRetryable = true;
      throw errorObj;
    }
    
    // Timeout - mensagem mais amigável
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[API] Timeout ao conectar:', API_BASE_URL);
      const errorObj = new Error('Aguardando conexão com o servidor...') as any;
      errorObj.code = 'BACKEND_OFFLINE';
      errorObj.isRetryable = true;
      throw errorObj;
    }
    
    throw error;
  }

  if (!response.ok) {
    // Tentar extrair mensagem de erro da resposta primeiro
    let errorMessage = `HTTP ${response.status}`;
    let errorDetails: any = null;
    
    try {
      errorDetails = await response.json();
      
      // 🔴 DIAGNÓSTICO: Log apenas em desenvolvimento e apenas para erros críticos
      if (import.meta.env.DEV && (path.includes('/autocomplete') || path.includes('/categories/tree'))) {
        console.error('[apiFetch] ERROR:', {
          path,
          status: response.status,
          error: errorDetails.error || errorDetails.message
        });
      }
      
      // Bug 3 fix (2026-05-14): backend pode retornar erro em 3 shapes:
      //   (a) { message: "string" }                              — direto
      //   (b) { error: "string" }                                — flat
      //   (c) { error: { code, message, details }, meta: {...} } — aninhado (Fastify error handler padrão)
      // Antes (errorDetails.message || errorDetails.error) caía no shape (c) → errorMessage virava
      // OBJETO → new Error(obj) → renderizava "[object Object]". Agora extrai .message do objeto
      // aninhado para sempre obter string legível.
      const nestedError = errorDetails.error;
      if (typeof errorDetails.message === 'string') {
        errorMessage = errorDetails.message;
      } else if (typeof nestedError === 'string') {
        errorMessage = nestedError;
      } else if (nestedError && typeof nestedError === 'object' && typeof nestedError.message === 'string') {
        errorMessage = nestedError.message;
      }

      // Preservar código de erro se disponível (top-level OU aninhado)
      const error = new Error(errorMessage) as any;
      if (errorDetails.code) {
        error.code = errorDetails.code;
      } else if (nestedError && typeof nestedError === 'object' && nestedError.code) {
        error.code = nestedError.code;
      }
      if (errorDetails.errorCode) {
        error.errorCode = errorDetails.errorCode;
      }

      // Tratamento especial para 404 (feature indisponível)
      if (response.status === 404) {
        // Se silent404 estiver ativado, tratar silenciosamente
        if (contextOptions?.silent404) {
          const silentError = new Error('FEATURE_UNAVAILABLE') as any;
          silentError.status = 404;
          silentError.code = 'FEATURE_UNAVAILABLE';
          // Não logar - feature simplesmente não está disponível
          throw silentError;
        }
      }

      // 🔴 ESTABILIZAÇÃO DE SESSÃO: Tratamento especial para 401
      if (response.status === 401) {
        // Se silent401 estiver ativado, tratar silenciosamente (sem acesso bancário, etc)
        if (contextOptions?.silent401) {
          const silentError = new Error('FEATURE_UNAVAILABLE') as any;
          silentError.status = 401;
          silentError.code = 'FEATURE_UNAVAILABLE';
          // Não logar - é condição esperada (ex: sem escopo bancário)
          throw silentError;
        }
        
        // 🔴 VALIDAÇÃO: Verificar se token está presente e sessão está autenticada
        // tenantId já foi validado acima (invariante absoluta - sempre presente após autenticação)
        const token = getAuthToken();
        const tenantId = getTenantId();
        const hasToken = !!token;
        // 🔴 GARANTIA: tenantId sempre presente após autenticação (invariante)
        const isAuthenticated = hasToken && !!tenantId;
        
        // Verificar se está em bootstrap grace period
        const inBootstrap = isInBootstrapGracePeriod();
        
        // ✅ FIX: Durante bootstrap, 401 é sessão inválida (não ignorar)
        if (inBootstrap) {
          console.error('[API] ❌ 401 durante bootstrap - sessão inválida:', path);
          const { clearSession } = await import('../config/auth');
          clearSession();
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
        
        // 🔴 REGRA: Verificar se é 401 CRÍTICO ou NÃO-CRÍTICO
        const isCritical = isCritical401(path, errorMessage);
        
        // Se for CRÍTICO: limpar sessão
        if (isCritical) {
          console.error('[API] ❌ 401 CRÍTICO - limpando sessão:', path);
          const { clearSession } = await import('../config/auth');
          clearSession();
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
        
        // Se for NÃO-CRÍTICO: verificar critérios obrigatórios
        // TODOS devem ser verdadeiros para não limpar sessão:
        // 1. Token presente
        // 2. Sessão autenticada (token + tenantId)
        // 3. Endpoint na lista de não-críticos
        if (hasToken && isAuthenticated && isNonCritical401Endpoint(path)) {
          // 🔴 REGRA: 401 NÃO-CRÍTICO - NÃO limpar sessão
          // Apenas logar warning e propagar erro
          console.warn('[API] ⚠️ 401 NÃO-CRÍTICO (não limpar sessão):', path);
          // Propagar erro para caller (componente deve tratar)
          throw error;
        } else {
          // Se não atende critérios de não-crítico, tratar como crítico
          console.error('[API] ❌ 401 sem critérios de não-crítico - limpando sessão:', path);
          const { clearSession } = await import('../config/auth');
          clearSession();
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
      }
      
      throw error;
    } catch (parseError: any) {
      // Se não conseguir parsear JSON, usar status
      // Se já foi lançado erro acima, re-lançar
      if (parseError.code || parseError.message) {
        throw parseError;
      }
      errorMessage = `Erro ${response.status}: ${response.statusText || 'Erro desconhecido'}`;
      const error = new Error(errorMessage) as any;
      // Tentar inferir código baseado no status
      if (response.status === 400) {
        error.code = 'BAD_REQUEST';
      } else if (response.status === 401) {
        error.code = 'UNAUTHORIZED';
      } else if (response.status === 403) {
        error.code = 'FORBIDDEN';
      } else if (response.status >= 500) {
        error.code = 'INTERNAL_ERROR';
      }
      throw error;
    }
  }

  return response;
}

/**
 * Wrapper para apiFetch que retorna JSON tipado diretamente.
 * Valida response.ok e retorna o JSON parseado.
 */
export async function apiFetchJson<T>(
  path: string, 
  options: RequestInit = {},
  contextOptions?: ApiFetchContextOptions
): Promise<T> {
  const response = await apiFetch(path, options, contextOptions);
  if (!response.ok) {
    // apiFetch já lança erro para !response.ok, mas garantimos aqui também
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

