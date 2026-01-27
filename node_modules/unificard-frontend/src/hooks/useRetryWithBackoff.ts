// src/hooks/useRetryWithBackoff.ts
// Hook para retry com backoff exponencial

import { useState, useCallback } from 'react';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export interface RetryState {
  retryCount: number;
  isRetrying: boolean;
  lastError: Error | null;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1s
  maxDelay: 5000, // 5s
  backoffMultiplier: 2,
};

/**
 * Hook para executar função com retry e backoff exponencial
 */
export function useRetryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): [() => Promise<T | null>, RetryState] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    isRetrying: false,
    lastError: null,
  });

  const executeWithRetry = useCallback(async (): Promise<T | null> => {
    let attempt = 0;
    
    while (attempt <= opts.maxRetries) {
      try {
        setRetryState({
          retryCount: attempt,
          isRetrying: attempt > 0,
          lastError: null,
        });
        
        const result = await fn();
        
        // Sucesso - resetar estado
        setRetryState({
          retryCount: 0,
          isRetrying: false,
          lastError: null,
        });
        
        return result;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        // Verificar se é erro retryable (backend offline)
        const isRetryable = err.code === 'BACKEND_OFFLINE' || err.isRetryable;
        
        if (!isRetryable || attempt >= opts.maxRetries) {
          // Não retryable ou esgotou tentativas
          setRetryState({
            retryCount: attempt,
            isRetrying: false,
            lastError: error,
          });
          return null;
        }
        
        // Calcular delay com backoff exponencial
        const delay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelay
        );
        
        setRetryState({
          retryCount: attempt + 1,
          isRetrying: true,
          lastError: error,
        });
        
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, delay));
        
        attempt++;
      }
    }
    
    return null;
  }, [fn, opts]);

  return [executeWithRetry, retryState];
}





