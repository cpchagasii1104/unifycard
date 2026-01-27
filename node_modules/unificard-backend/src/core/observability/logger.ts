// backend/src/core/observability/logger.ts
// SPRINT 52: Logger estruturado para observabilidade

/**
 * Níveis de log
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Contexto do log
 */
export interface LogContext {
  tenantId?: string;
  userId?: string;
  actorId?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * Logger estruturado
 * 
 * SPRINT 52: Logs estruturados para observabilidade
 * - Formato JSON para fácil parsing
 * - Contexto rico (tenant, user, actor)
 * - Métricas simples (tempo de execução)
 */
class StructuredLogger {
  /**
   * Log genérico
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const logEntry: any = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Em produção, usar JSON.stringify para logs estruturados
    // Em desenvolvimento, pode usar console.log formatado
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, context || '', error || '');
    }
  }

  /**
   * Log de debug
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  /**
   * Log de info
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  /**
   * Log de warning
   */
  warn(message: string, context?: LogContext, error?: Error) {
    this.log('warn', message, context, error);
  }

  /**
   * Log de erro
   */
  error(message: string, context?: LogContext, error?: Error) {
    this.log('error', message, context, error);
  }

  /**
   * Mede tempo de execução de uma função
   */
  async measureTime<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`${operation} completed`, {
        ...context,
        durationMs: duration,
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`${operation} failed`, {
        ...context,
        durationMs: duration,
      }, error as Error);
      throw error;
    }
  }
}

export const logger = new StructuredLogger();







