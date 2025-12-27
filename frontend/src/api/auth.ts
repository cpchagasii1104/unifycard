// src/api/auth.ts
// API de autenticação - Registro e Login

// Usar valor padrão se não estiver configurado (desenvolvimento local)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Aviso apenas em console, não quebra o sistema
if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn('[API] VITE_API_BASE_URL não configurada, usando padrão:', API_BASE_URL);
}

export interface RegisterRequest {
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId: string;
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
  };
}

export async function register(email: string, password: string, tenantId: string): Promise<AuthResponse> {
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    // Erro de rede (Failed to fetch)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('[API] Backend não disponível:', API_BASE_URL);
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
    // Suporta ambos os formatos: { error: ... } e { ok: false, message: ... }
    const errorMessage = error.message || error.error || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

// Guard para prevenir múltiplas chamadas simultâneas de login
let loginInProgress = false;
let loginPromise: Promise<AuthResponse> | null = null;

export async function login(email: string, password: string, tenantId: string): Promise<AuthResponse> {
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
      response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Erro de timeout ou abort
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.warn('[API] Timeout ao conectar com backend:', API_BASE_URL);
        const errorObj = new Error('Servidor não respondeu. Verifique se o backend está rodando.') as any;
        errorObj.code = 'BACKEND_OFFLINE';
        errorObj.isRetryable = true;
        throw errorObj;
      }
      
      // Erro de rede (Failed to fetch)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('[API] Backend não disponível:', API_BASE_URL);
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
      // Suporta ambos os formatos: { error: ... } e { ok: false, message: ... }
      const errorMessage = error.message || error.error || `HTTP ${response.status}`;
      
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
