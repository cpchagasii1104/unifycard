// src/core/events/event-rate-limit.service.ts
// Rate limiting específico para eventos
// FASE 8: HARDENING

import { runQueryWithTenant } from '@core/database/pool';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

class EventRateLimitService {
  // Limites por tipo de ação
  private readonly LIMITS = {
    create: { max: 10, windowMs: 60 * 1000 }, // 10 eventos por minuto
    publish: { max: 5, windowMs: 60 * 1000 }, // 5 publicações por minuto
    checkout: { max: 20, windowMs: 60 * 1000 }, // 20 checkouts por minuto
  };

  /**
   * Verifica rate limit para criação de eventos
   */
  async checkCreateRateLimit(
    tenantId: string,
    actorId: string
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(tenantId, actorId, 'create');
  }

  /**
   * Verifica rate limit para publicação de eventos
   */
  async checkPublishRateLimit(
    tenantId: string,
    actorId: string
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(tenantId, actorId, 'publish');
  }

  /**
   * Verifica rate limit para checkout
   */
  async checkCheckoutRateLimit(
    tenantId: string,
    actorId: string
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(tenantId, actorId, 'checkout');
  }

  /**
   * Verifica rate limit genérico
   */
  private async checkRateLimit(
    tenantId: string,
    actorId: string,
    action: 'create' | 'publish' | 'checkout'
  ): Promise<RateLimitResult> {
    const limit = this.LIMITS[action];
    const now = new Date();
    const windowStart = new Date(now.getTime() - limit.windowMs);

    try {
      // Contar ações no último minuto
      let query = '';
      let params: any[] = [];

      if (action === 'create') {
        query = `
          SELECT COUNT(*)::text as count
          FROM events
          WHERE tenant_id = $1 AND actor_id = $2 AND created_at >= $3
        `;
        params = [tenantId, actorId, windowStart];
      } else if (action === 'publish') {
        query = `
          SELECT COUNT(*)::text as count
          FROM events
          WHERE tenant_id = $1 AND actor_id = $2 
            AND status = 'published' 
            AND updated_at >= $3
        `;
        params = [tenantId, actorId, windowStart];
      } else if (action === 'checkout') {
        query = `
          SELECT COUNT(*)::text as count
          FROM event_attendees
          WHERE tenant_id = $1 AND actor_id = $2 AND created_at >= $3
        `;
        params = [tenantId, actorId, windowStart];
      }

      const result = await runQueryWithTenant<{ count: string }>(
        tenantId,
        query,
        params
      );

      const count = parseInt(result?.count || '0', 10);

      if (count >= limit.max) {
        const resetAt = new Date(now.getTime() + limit.windowMs);
        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      return {
        allowed: true,
        remaining: limit.max - count,
        resetAt: new Date(now.getTime() + limit.windowMs),
      };
    } catch (error) {
      // Em caso de erro, permitir (fail-open)
      console.error('[EventRateLimit] Erro ao verificar rate limit:', error);
      return {
        allowed: true,
        remaining: limit.max,
        resetAt: new Date(now.getTime() + limit.windowMs),
      };
    }
  }
}

export const eventRateLimitService = new EventRateLimitService();














