// backend/src/core/logging/structured-logger.ts
// Logger Estruturado para Observabilidade
// 🔴 BLINDAGEM: Logs estruturados com requestId/correlationId

interface LogContext {
  requestId?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  actorId?: string;
  [key: string]: any;
}

class StructuredLogger {
  /**
   * Log de informação
   */
  info(message: string, context?: LogContext): void {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  }

  /**
   * Log de warning
   */
  warn(message: string, context?: LogContext): void {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  }

  /**
   * Log de erro
   */
  error(message: string, error?: Error | any, context?: LogContext): void {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      } : undefined,
      ...context,
    }));
  }

  /**
   * Log de ação crítica
   */
  audit(action: string, context?: LogContext): void {
    console.log(JSON.stringify({
      level: 'audit',
      action,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  }
}

export const structuredLogger = new StructuredLogger();




