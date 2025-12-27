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

export interface ApiFetchContextOptions {
  silent401?: boolean;
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

  // Adicionar token de autenticação se existir
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Adicionar tenant ID se existir
  // IMPORTANTE: Todos os endpoints protegidos exigem tenant
  const tenantId = getTenantId();
  
  // DIAGNÓSTICO: Log para identificar problema real
  if (path.includes('/autocomplete') || path.includes('/categories/') || path.includes('/bank/')) {
    console.log('[apiFetch] REQUEST:', {
      url,
      tenantId: tenantId || 'MISSING',
      hasToken: !!token,
      path
    });
  }
  
  // REGRA CRÍTICA: Endpoints protegidos exigem tenant
  // Se tiver token mas não tiver tenant, NÃO fazer requisição
  // Isso previne requests com tenantId = MISSING
  if (token && !tenantId) {
    const error = new Error('Tenant ID não encontrado. Faça login novamente.') as any;
    error.code = 'MISSING_TENANT';
    error.status = 400;
    throw error;
  }
  
  // REGRA: Sempre enviar tenantId se existir (para endpoints protegidos)
  // Se não existir e for endpoint protegido, já foi bloqueado acima
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  } else if (token) {
    // Se tem token mas não tem tenantId, não fazer request
    // Isso não deveria acontecer, mas é uma segurança extra
    const error = new Error('Sessão incompleta. Faça login novamente.') as any;
    error.code = 'MISSING_TENANT';
    error.status = 400;
    throw error;
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
    // DIAGNÓSTICO: Log resposta de erro completa
    if (path.includes('/autocomplete') || path.includes('/categories/')) {
      console.error('[apiFetch] ERROR RESPONSE:', {
        status: response.status,
        statusText: response.statusText,
        url
      });
    }
    
    // Tentar extrair mensagem de erro da resposta primeiro
    let errorMessage = `HTTP ${response.status}`;
    let errorDetails: any = null;
    
    try {
      errorDetails = await response.json();
      
      // DIAGNÓSTICO: Log body da resposta de erro
      if (path.includes('/autocomplete') || path.includes('/categories/')) {
        console.error('[apiFetch] ERROR BODY:', errorDetails);
      }
      
      // Priorizar mensagem específica do backend (suporta ambos os formatos)
      errorMessage = errorDetails.message || errorDetails.error || errorMessage;
      
      // Preservar código de erro se disponível
      const error = new Error(errorMessage) as any;
      if (errorDetails.code) {
        error.code = errorDetails.code;
      }
      
      // Tratamento especial para 401 (sessão expirada)
      if (response.status === 401) {
        // Se silent401 estiver ativado, tratar silenciosamente
        if (contextOptions?.silent401) {
          const silentError = new Error('SILENT_401') as any;
          silentError.status = 401;
          silentError.code = 'SILENT_401';
          console.warn('[API] 401 silencioso (bootstrap)');
          throw silentError;
        }
        
        const isExpired = errorMessage.toLowerCase().includes('expired') || 
                         errorMessage.toLowerCase().includes('expirada') ||
                         errorMessage.toLowerCase().includes('invalid or expired token') ||
                         errorMessage.toLowerCase().includes('token expired');
        
        const inBootstrap = isInBootstrapGracePeriod();
        
        // Durante bootstrap, NUNCA limpar token, mesmo se "expired"
        // Isso previne loop de login quando endpoints auxiliares falham
        if (inBootstrap) {
          console.warn('[API] ⚠️ 401 durante bootstrap - ignorando (não limpar token)');
          console.warn('[API] Path:', path, '| Mensagem:', errorMessage);
          // Apenas lançar erro sem limpar token
          // Componentes devem tratar esse erro como não-crítico durante bootstrap
          throw error;
        }
        
        // Fora do bootstrap, apenas limpar se realmente expirado
        if (isExpired) {
          console.error('[API] ❌ Token expirado - limpando sessão');
          const { clearAuthToken } = await import('../config/auth');
          clearAuthToken();
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
        
        // Para outros 401 fora do bootstrap, apenas lançar erro sem limpar token
        // Isso permite que o sistema tente novamente
        console.warn('[API] ⚠️ 401 não crítico (fora do bootstrap):', errorMessage);
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
export async function apiFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    // apiFetch já lança erro para !response.ok, mas garantimos aqui também
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

