// src/core/utils/structured-logger.ts
// Logger estruturado para observabilidade
// 🔴 BLINDAGEM: Logs são apenas observabilidade, não decisão

interface LogContext {
  tenantId?: string;
  actorId?: string;
  userId?: string;
  effectType?: string;
  postId?: string;
  availabilityId?: string;
  bookingId?: string;
  [key: string]: any;
}

/**
 * Logger estruturado para observabilidade
 * 🔴 BLINDAGEM: Logs incluem contexto mínimo necessário
 */
class StructuredLogger {
  /**
   * Log estruturado de emissão de effect
   */
  logEffectEmission(
    level: 'info' | 'warn' | 'error',
    message: string,
    context: LogContext & { effectType: string }
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      event: 'effect_emission',
      tenantId: context.tenantId,
      actorId: context.actorId,
      userId: context.userId,
      effectType: context.effectType,
      ...Object.fromEntries(
        Object.entries(context).filter(([key]) => 
          !['tenantId', 'actorId', 'userId', 'effectType'].includes(key)
        )
      ),
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log estruturado de projeção de inbox
   */
  logInboxProjection(
    level: 'info' | 'warn' | 'error',
    message: string,
    context: LogContext & { effectType: string }
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      event: 'inbox_projection',
      tenantId: context.tenantId,
      actorId: context.actorId,
      effectType: context.effectType,
      ...Object.fromEntries(
        Object.entries(context).filter(([key]) => 
          !['tenantId', 'actorId', 'effectType'].includes(key)
        )
      ),
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log estruturado de render-batch do feed
   */
  logFeedRenderBatch(
    level: 'info' | 'warn' | 'error',
    message: string,
    context: LogContext & { postCount?: number; cachedCount?: number }
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      event: 'feed_render_batch',
      tenantId: context.tenantId,
      actorId: context.actorId,
      postCount: context.postCount,
      cachedCount: context.cachedCount,
      ...Object.fromEntries(
        Object.entries(context).filter(([key]) => 
          !['tenantId', 'actorId', 'postCount', 'cachedCount'].includes(key)
        )
      ),
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}

export const structuredLogger = new StructuredLogger();

