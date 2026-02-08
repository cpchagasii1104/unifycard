// backend/src/core/rate-limiting/business-rate-limit.service.ts
// Rate Limiting para Ações Críticas de Negócio
// 🔴 BLINDAGEM: Configurável por ambiente
// 🔴 BLINDAGEM: Fail-open (não quebra fluxo se falhar)

import { runQueryWithTenant } from '@core/database/pool';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  windowMs: number;
}

export type BusinessRateLimitAction =
  | 'rfq:create'
  | 'booking:create'
  | 'message:send'
  | 'notification:create'
  | 'quote:submit'
  | 'bundle:create'
  | 'service_order:create';

/**
 * Limites configuráveis por ambiente
 */
const RATE_LIMITS: Record<BusinessRateLimitAction, { max: number; windowMs: number }> = {
  'rfq:create': {
    max: parseInt(process.env.RATE_LIMIT_RFQ_CREATE || '10', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_RFQ_CREATE_WINDOW_MS || '60000', 10), // 1 minuto
  },
  'booking:create': {
    max: parseInt(process.env.RATE_LIMIT_BOOKING_CREATE || '20', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_BOOKING_CREATE_WINDOW_MS || '60000', 10), // 1 minuto
  },
  'message:send': {
    max: parseInt(process.env.RATE_LIMIT_MESSAGE_SEND || '30', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_MESSAGE_SEND_WINDOW_MS || '60000', 10), // 1 minuto
  },
  'notification:create': {
    max: parseInt(process.env.RATE_LIMIT_NOTIFICATION_CREATE || '50', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_NOTIFICATION_CREATE_WINDOW_MS || '60000', 10), // 1 minuto
  },
  'quote:submit': {
    max: parseInt(process.env.RATE_LIMIT_QUOTE_SUBMIT || '15', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_QUOTE_SUBMIT_WINDOW_MS || '60000', 10), // 1 minuto
  },
  'bundle:create': {
    max: parseInt(process.env.RATE_LIMIT_BUNDLE_CREATE || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_BUNDLE_CREATE_WINDOW_MS || '60000', 10), // 1 minuto
  },
  'service_order:create': {
    max: parseInt(process.env.RATE_LIMIT_SERVICE_ORDER_CREATE || '20', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_SERVICE_ORDER_CREATE_WINDOW_MS || '60000', 10), // 1 minuto
  },
};

class BusinessRateLimitService {
  /**
   * Verifica rate limit para uma ação
   * 
   * @param tenantId - ID do tenant
   * @param actorId - ID do actor (para rastreamento)
   * @param action - Ação a verificar
   * @param contextId - ID do contexto (opcional, para logs)
   * @returns Resultado da verificação
   */
  async checkRateLimit(
    tenantId: string,
    actorId: string,
    action: BusinessRateLimitAction,
    contextId?: string
  ): Promise<RateLimitResult> {
    const limit = RATE_LIMITS[action];
    const now = new Date();
    const windowStart = new Date(now.getTime() - limit.windowMs);

    try {
      // Contar ações no período (usando business_audit_logs)
      const countRow = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM business_audit_logs
        WHERE tenant_id = $1
          AND actor_id = $2
          AND action = $3
          AND createdAt >= $4
        `,
        [tenantId, actorId, this._mapActionToAuditAction(action), windowStart]
      );

      const count = parseInt(countRow?.count || '0', 10);

      if (count >= limit.max) {
        const resetAt = new Date(now.getTime() + limit.windowMs);
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          limit: limit.max,
          windowMs: limit.windowMs,
        };
      }

      return {
        allowed: true,
        remaining: limit.max - count,
        resetAt: new Date(now.getTime() + limit.windowMs),
        limit: limit.max,
        windowMs: limit.windowMs,
      };
    } catch (error) {
      // Fail-open: em caso de erro, permitir (não quebrar fluxo)
      console.error(`[BusinessRateLimit] Erro ao verificar rate limit para ${action}:`, error);
      return {
        allowed: true,
        remaining: limit.max,
        resetAt: new Date(now.getTime() + limit.windowMs),
        limit: limit.max,
        windowMs: limit.windowMs,
      };
    }
  }

  /**
   * Mapeia ação de rate limit para ação de auditoria
   */
  private _mapActionToAuditAction(action: BusinessRateLimitAction): string {
    const mapping: Record<BusinessRateLimitAction, string> = {
      'rfq:create': 'rfq_created',
      'booking:create': 'booking_requested',
      'message:send': 'message_received', // Aproximação
      'notification:create': 'permission_denied', // Aproximação - usar outro método se necessário
      'quote:submit': 'quote_submitted',
      'bundle:create': 'rfq_converted', // Aproximação
      'service_order:create': 'service_order_created',
    };
    return mapping[action] || action;
  }
}

export const businessRateLimitService = new BusinessRateLimitService();





