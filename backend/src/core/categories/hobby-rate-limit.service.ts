// backend/src/core/categories/hobby-rate-limit.service.ts
// Rate Limit para adição de hobbies
// FASE 3: Hobby Gate

import { pool } from '@core/database/pool';

interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: Date;
}

class HobbyRateLimitService {
  // Limite: 10 tentativas por minuto por usuário
  private readonly MAX_ATTEMPTS = 10;
  private readonly WINDOW_MS = 60 * 1000; // 1 minuto

  /**
   * Verifica rate limit para adição de hobbies
   * 
   * @param userId - ID do usuário
   * @param tenantId - ID do tenant
   * @returns true se permitido, false se excedeu limite
   */
  async checkRateLimit(userId: string, tenantId: string): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.WINDOW_MS);

    try {
      // Contar tentativas no último minuto
      const result = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text as count
        FROM category_input_audit
        WHERE actor_id = $1
          AND context = 'hobby'
          AND created_at >= $2
        `,
        [userId, windowStart]
      );

      const count = parseInt(result.rows[0]?.count || '0', 10);

      if (count >= this.MAX_ATTEMPTS) {
        const resetAt = new Date(now.getTime() + this.WINDOW_MS);
        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      return {
        allowed: true,
        remaining: this.MAX_ATTEMPTS - count,
        resetAt: new Date(now.getTime() + this.WINDOW_MS),
      };
    } catch (error) {
      console.error('[HobbyRateLimit] Erro ao verificar rate limit:', error);
      // Em caso de erro, permitir (fail-open)
      return {
        allowed: true,
      };
    }
  }

  /**
   * Verifica limite de hobbies por usuário (máx 30)
   * 
   * @param globalUserId - Global user ID
   * @returns true se pode adicionar mais, false se atingiu limite
   */
  async checkHobbyLimit(globalUserId: string): Promise<{ allowed: boolean; currentCount: number; maxCount: number }> {
    const MAX_HOBBIES = 30;

    try {
      // Contar hobbies do usuário (via metadata ou tabela específica)
      // Por enquanto, vamos contar via category_input_audit com decision=ALLOW
      const result = await pool.query<{ count: string }>(
        `
        SELECT COUNT(DISTINCT normalized)::text as count
        FROM category_input_audit
        WHERE global_user_id = $1
          AND context = 'hobby'
          AND decision = 'ALLOW'
        `,
        [globalUserId]
      );

      const currentCount = parseInt(result.rows[0]?.count || '0', 10);

      return {
        allowed: currentCount < MAX_HOBBIES,
        currentCount,
        maxCount: MAX_HOBBIES,
      };
    } catch (error) {
      console.error('[HobbyRateLimit] Erro ao verificar limite de hobbies:', error);
      // Em caso de erro, permitir (fail-open)
      return {
        allowed: true,
        currentCount: 0,
        maxCount: MAX_HOBBIES,
      };
    }
  }
}

export const hobbyRateLimitService = new HobbyRateLimitService();
export type { RateLimitResult };





























