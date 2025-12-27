// src/components/BackendConnectionError.tsx
// Componente para exibir erros de conexão com o backend de forma amigável

import { useState, useEffect } from 'react';
import { checkBackendStatus, getFriendlyErrorMessage, type BackendStatus } from '../utils/backend-check';
import './BackendConnectionError.css';

interface BackendConnectionErrorProps {
  error: string;
  onRetry?: () => void;
  showDiagnostics?: boolean;
}

export default function BackendConnectionError({ 
  error, 
  onRetry,
  showDiagnostics = true 
}: BackendConnectionErrorProps) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (showDiagnostics && (error.includes('Failed to fetch') || error.includes('conectar'))) {
      checkBackend();
    }
  }, [error, showDiagnostics]);

  const checkBackend = async () => {
    setIsChecking(true);
    try {
      const status = await checkBackendStatus();
      setBackendStatus(status);
    } catch (err) {
      setBackendStatus({
        isOnline: false,
        url: import.meta.env.VITE_API_BASE_URL || 'não configurado',
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const friendlyMessage = getFriendlyErrorMessage(error, backendStatus || undefined);

  return (
    <div className="backend-connection-error">
      <div className="error-box">
        <div className="error-icon">⚠️</div>
        <h3>Erro de Conexão</h3>
        <p className="error-message">{friendlyMessage}</p>
        
        {showDiagnostics && backendStatus && (
          <div className="diagnostics">
            <h4>Diagnóstico:</h4>
            <div className="diagnostic-item">
              <span className="label">Status do Backend:</span>
              <span className={`value ${backendStatus.isOnline ? 'online' : 'offline'}`}>
                {backendStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
            <div className="diagnostic-item">
              <span className="label">URL Configurada:</span>
              <span className="value">{backendStatus.url}</span>
            </div>
            {backendStatus.responseTime && (
              <div className="diagnostic-item">
                <span className="label">Tempo de Resposta:</span>
                <span className="value">{backendStatus.responseTime}ms</span>
              </div>
            )}
            {backendStatus.error && (
              <div className="diagnostic-item">
                <span className="label">Erro:</span>
                <span className="value error-text">{backendStatus.error}</span>
              </div>
            )}
          </div>
        )}

        {showDiagnostics && isChecking && (
          <div className="checking-status">Verificando conexão com o backend...</div>
        )}

        <div className="actions">
          {onRetry && (
            <button onClick={onRetry} className="retry-button">
              🔄 Tentar novamente
            </button>
          )}
          {showDiagnostics && (
            <button onClick={checkBackend} className="check-button" disabled={isChecking}>
              {isChecking ? 'Verificando...' : '🔍 Verificar conexão'}
            </button>
          )}
        </div>

        <div className="help-section">
          <h4>Como resolver:</h4>
          <ol>
            <li>Verifique se o backend está rodando: <code>http://localhost:3000/health</code></li>
            <li>Confirme que a variável <code>VITE_API_BASE_URL</code> está correta no arquivo <code>.env</code></li>
            <li>Verifique se não há problemas de firewall ou proxy</li>
            <li>Se o backend estiver em outra porta, atualize o <code>.env</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
}















