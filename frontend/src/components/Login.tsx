// src/components/Login.tsx
// Tela de login mínima - READ-ONLY, apenas autenticação

import { useState } from 'react';
import { login } from '../api/auth';
import { decodeJwtPayload } from '../utils/jwt';
import { setAuthToken, setTenantId, getTenantId } from '../config/auth';
import './Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
  onGoToRegister?: () => void;
  onBackToHome?: () => void;
}

export default function Login({ onLoginSuccess, onGoToRegister, onBackToHome }: LoginProps) {
  const [email, setEmail] = useState('dev@unificard.local');
  const [password, setPassword] = useState('dev12345');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'timeout'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Proteção contra múltiplos submits simultâneos
    if (isSubmitting || isLoading) {
      console.warn('[Login] Submit já em andamento, ignorando...');
      return;
    }
    
    setIsSubmitting(true);
    setIsLoading(true);
    setError(null);
    setConnectionStatus('connecting');

    try {
      // 🔴 REGRA: Login NÃO depende de tenant pré-existente
      // tenantId do header é opcional - o login busca usuário apenas por email
      // NÃO ler tenantId durante submit - será obtido do JWT após login
      const result = await login(email, password, undefined);
      
      if (result.success && result.data.tokens.accessToken) {
        // CRÍTICO: Salvar token ANTES de qualquer outra coisa
        setAuthToken(result.data.tokens.accessToken);
        
        // 🔴 GARANTIA CANÔNICA: TenantId DEVE vir SEMPRE do JWT (fonte única de verdade)
        // Se falhar extração, é erro fatal - não seguir silenciosamente
        let tenantIdToSave: string | null = null;
        try {
          const tokenPayload = decodeJwtPayload(result.data.tokens.accessToken);
          tenantIdToSave = tokenPayload.tenantId;
          
          // 🔴 VALIDAÇÃO EXPLÍCITA: tenantId deve ser string não vazia
          if (!tenantIdToSave || typeof tenantIdToSave !== 'string' || tenantIdToSave.trim() === '') {
            throw new Error('tenantId ausente ou inválido no JWT');
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Falha ao extrair tenantId do JWT';
          console.error('[Login] ❌ ERRO CRÍTICO:', errorMessage, e);
          
          // 🔴 FALHA EXPLÍCITA: Não seguir silenciosamente
          setError('Erro crítico: não foi possível obter tenantId do token. Por favor, tente novamente.');
          setConnectionStatus('idle');
          setIsLoading(false);
          setIsSubmitting(false);
          return; // Interromper fluxo - não continuar sem tenantId
        }
        
        // 🔴 GARANTIA: tenantId válido - salvar imediatamente
        setTenantId(tenantIdToSave);
        // Novo login: não reutilizar actor de sessão anterior (evita misturar identidades)
        localStorage.removeItem('unificard_active_actor_id');
        console.log('[Login] ✅ TenantId extraído do JWT e salvo:', tenantIdToSave);
        
        // 🔴 PARTE 2 - ONBOARDING: Verificar se precisa de onboarding
        const requiresOnboarding = result.data.requiresOnboarding === true;
        
        // Aguardar um tick para garantir que localStorage foi atualizado
        // Isso previne race condition onde bootstrapSession roda antes dos valores estarem salvos
        await new Promise(resolve => setTimeout(resolve, 0));
        
        setConnectionStatus('idle');
        // Disparar evento para SessionProvider re-bootstrap
        // Agora token e tenantId já estão salvos
        window.dispatchEvent(new CustomEvent('auth-changed'));
        
        // 🔴 ONBOARDING: Redirecionar para perfil se precisa de onboarding (SEM sessionStorage)
        if (requiresOnboarding) {
          // Redirecionar para perfil - Profile.tsx verificará diretamente do backend
          window.location.href = '/perfil';
        } else {
          onLoginSuccess();
        }
      } else {
        setError('Login falhou');
        setConnectionStatus('idle');
      }
    } catch (err: any) {
      // Tratar erros de conexão
      if (err?.code === 'BACKEND_OFFLINE' || err?.isRetryable) {
        setConnectionStatus('timeout');
        // Mostrar mensagem discreta mas informativa
        setError(err.message || 'Servidor não disponível. Verifique se o backend está rodando.');
      } else if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
        // Tratar erro de rate limit especificamente
        setError(err.message || 'Muitas tentativas de login. Aguarde alguns segundos antes de tentar novamente.');
        setConnectionStatus('idle');
      } else {
        // Mostrar apenas erros reais de autenticação
        setError(err instanceof Error ? err.message : 'Erro ao fazer login');
        setConnectionStatus('idle');
      }
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Unificard</h1>
        <p className="login-subtitle">Acesse sua conta</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
              {connectionStatus === 'timeout' && (
                <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#666' }}>
                  💡 Dica: Execute <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>npm run dev</code> na pasta <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>backend</code>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? 'Conectando...' : 'Entrar'}
          </button>

          {onGoToRegister && (
            <button
              type="button"
              onClick={onGoToRegister}
              className="register-link-button"
            >
              Não tem conta? Criar conta
            </button>
          )}

          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="register-link-button"
            >
              ← Voltar para início
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

