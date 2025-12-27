// src/components/Login.tsx
// Tela de login mínima - READ-ONLY, apenas autenticação

import { useState, useEffect } from 'react';
import { login } from '../api/auth';
import { setAuthToken, setTenantId, getTenantId } from '../config/auth';
import './Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
  onGoToRegister?: () => void;
}

export default function Login({ onLoginSuccess, onGoToRegister }: LoginProps) {
  const [email, setEmail] = useState('dev@unificard.local');
  const [password, setPassword] = useState('dev12345');
  // 🔒 SEGURANÇA: Tentar ler tenantId do localStorage primeiro (se já tiver logado antes)
  // Se não existir, usar o valor padrão
  const [tenantId, setTenantIdValue] = useState(() => {
    const saved = getTenantId();
    return saved || 'fbe13b78-4516-493d-905a-363796aea1d1';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'timeout'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🔒 SEGURANÇA: Atualizar tenantId se mudar no localStorage (de outra aba, por exemplo)
  useEffect(() => {
    const saved = getTenantId();
    if (saved && saved !== tenantId) {
      setTenantIdValue(saved);
    }
  }, [tenantId]);

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
      const result = await login(email, password, tenantId);
      
      if (result.success && result.data.tokens.accessToken) {
        // CRÍTICO: Salvar token e tenantId ANTES de disparar evento
        // Isso garante que quando bootstrapSession rodar, ambos já estarão disponíveis
        setAuthToken(result.data.tokens.accessToken);
        setTenantId(tenantId);
        
        // Aguardar um tick para garantir que localStorage foi atualizado
        // Isso previne race condition onde bootstrapSession roda antes dos valores estarem salvos
        await new Promise(resolve => setTimeout(resolve, 0));
        
        setConnectionStatus('idle');
        // Disparar evento para SessionProvider re-bootstrap
        // Agora token e tenantId já estão salvos
        window.dispatchEvent(new CustomEvent('auth-changed'));
        onLoginSuccess();
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
            <label htmlFor="tenantId">
              Tenant ID
              {getTenantId() && (
                <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '8px' }}>
                  (atual: {getTenantId()?.substring(0, 8)}...)
                </span>
              )}
            </label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantIdValue(e.target.value)}
              required
              placeholder="UUID do tenant"
              title="⚠️ IMPORTANTE: O tenantId deve corresponder ao tenantId do token JWT. Alterar isso pode causar erro TENANT_MISMATCH se o token foi emitido para outro tenant."
            />
            {getTenantId() && getTenantId() !== tenantId && (
              <small style={{ color: '#d32f2f', display: 'block', marginTop: '4px' }}>
                ⚠️ Atenção: Este tenantId é diferente do último usado. Certifique-se de que o token JWT foi emitido para este tenant.
              </small>
            )}
          </div>

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
        </form>
      </div>
    </div>
  );
}

