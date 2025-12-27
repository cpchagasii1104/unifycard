// src/components/Register.tsx
// Tela de registro - READ-ONLY, apenas criação de conta

import { useState } from 'react';
import { register } from '../api/auth';
import { setAuthToken, setTenantId } from '../config/auth';
import './Register.css';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onBackToLogin: () => void;
}

export default function Register({ onRegisterSuccess, onBackToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantId, setTenantIdValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, tenantId);
      
      if (result.success && result.data.tokens.accessToken) {
        setAuthToken(result.data.tokens.accessToken);
        setTenantId(tenantId);
        // Disparar evento para SessionProvider re-bootstrap
        window.dispatchEvent(new CustomEvent('auth-changed'));
        onRegisterSuccess();
      } else {
        setError('Registro falhou');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h1>Unificard</h1>
        <p className="register-subtitle">Crie sua conta</p>
        
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="tenantId">Tenant ID</label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantIdValue(e.target.value)}
              required
              placeholder="UUID do tenant"
            />
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
              placeholder="Mínimo 6 caracteres"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Senha</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Digite a senha novamente"
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isLoading} className="register-button">
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <button
            type="button"
            onClick={onBackToLogin}
            className="back-to-login-button"
          >
            Voltar para login
          </button>
        </form>
      </div>
    </div>
  );
}

