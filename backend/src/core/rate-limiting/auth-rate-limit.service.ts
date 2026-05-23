// backend/src/core/rate-limiting/auth-rate-limit.service.ts
// Rate Limiting Específico para Endpoints de Autenticação
// Proteção contra brute force, spam e scraping

import { pool } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import type { FastifyRequest } from 'fastify';

export interface AuthRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  windowMs: number;
  reason?: string; // 'ip', 'tenant', 'user', 'email'
}

export type AuthRateLimitAction =
  | 'auth.login'
  | 'auth.register'
  | 'auth.check-cpf'
  | 'auth.webauthn.challenge'
  | 'auth.webauthn.verify'
  | 'auth.refresh';

/**
 * Limites configuráveis por ambiente
 * Valores padrão são conservadores para produção
 */
const RATE_LIMITS: Record<AuthRateLimitAction, { 
  max: number; 
  windowMs: number;
  description: string;
}> = {
  'auth.login': {
    max: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN || '5', 10), // 5 tentativas/minuto
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN_WINDOW_MS || '60000', 10), // 1 minuto
    description: 'Login attempts',
  },
  'auth.register': {
    max: parseInt(process.env.RATE_LIMIT_AUTH_REGISTER || '3', 10), // 3 registros/minuto
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_REGISTER_WINDOW_MS || '60000', 10), // 1 minuto
    description: 'Registration attempts',
  },
  'auth.check-cpf': {
    max: parseInt(process.env.RATE_LIMIT_AUTH_CHECK_CPF || '10', 10), // 10 verificações/minuto
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_CHECK_CPF_WINDOW_MS || '60000', 10), // 1 minuto
    description: 'CPF check attempts',
  },
  'auth.webauthn.challenge': {
    max: parseInt(process.env.RATE_LIMIT_AUTH_WEBAUTHN_CHALLENGE || '10', 10), // 10 challenges/minuto
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WEBAUTHN_CHALLENGE_WINDOW_MS || '60000', 10), // 1 minuto
    description: 'WebAuthn challenge requests',
  },
  'auth.webauthn.verify': {
    max: parseInt(process.env.RATE_LIMIT_AUTH_WEBAUTHN_VERIFY || '5', 10), // 5 verificações/minuto
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WEBAUTHN_VERIFY_WINDOW_MS || '60000', 10), // 1 minuto
    description: 'WebAuthn verify attempts',
  },
  'auth.refresh': {
    max: parseInt(process.env.RATE_LIMIT_AUTH_REFRESH || '20', 10), // 20 refreshes/minuto
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_REFRESH_WINDOW_MS || '60000', 10), // 1 minuto
    description: 'Token refresh attempts',
  },
};

class AuthRateLimitService {
  /**
   * Extrai IP do cliente do request
   * Considera proxies e load balancers (x-forwarded-for)
   */
  extractClientIp(req: FastifyRequest): string {
    // 1. Tentar req.ip (Fastify pode ter configurado)
    if (req.ip) {
      return req.ip;
    }

    // 2. Tentar x-forwarded-for (primeiro IP da lista)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips: string[] = typeof forwardedFor === 'string'
        ? forwardedFor.split(',').map((ip: string) => ip.trim())
        : Array.isArray(forwardedFor) ? forwardedFor.map((x: string) => String(x)) : [String(forwardedFor)];
      const first = ips[0];
      if (first) return first;
    }

    // 3. Tentar x-real-ip
    const realIp = req.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    // 4. Fallback: socket remoteAddress
    const socket = (req as any).socket;
    if (socket?.remoteAddress) {
      return socket.remoteAddress;
    }

    // 5. Último fallback: 'unknown'
    return 'unknown';
  }

  /**
   * Verifica rate limit para endpoint de autenticação
   * 
   * Estratégia multi-camada:
   * 1. Limite por IP (sempre aplicado)
   * 2. Limite por tenantId (se disponível)
   * 3. Limite por userId (se disponível)
   * 4. Limite por email (para login/register)
   * 
   * @param action - Ação de autenticação
   * @param req - Request do Fastify (para extrair IP)
   * @param tenantId - ID do tenant (opcional)
   * @param userId - ID do usuário (opcional)
   * @param email - Email do usuário (opcional, para login/register)
   * @returns Resultado da verificação
   */
  async checkRateLimit(
    action: AuthRateLimitAction,
    req: FastifyRequest,
    tenantId?: string,
    userId?: string,
    email?: string
  ): Promise<AuthRateLimitResult> {
    const limit = RATE_LIMITS[action];
    const now = new Date();
    const windowStart = new Date(now.getTime() - limit.windowMs);

    try {
      const ip = this.extractClientIp(req);
      
      // ============================================================
      // 1. Verificar limite por IP (sempre aplicado)
      // ============================================================
      const ipCount = await this.countByKey('ip', action, ip, windowStart);
      
      if (ipCount >= limit.max) {
        // 🔴 LOG CANÔNICO: Abuso detectado por IP
        canonicalLogger.abuse(req, 'Limite excedido por IP', {
          action,
          ip,
          count: ipCount,
          limit: limit.max,
          windowMs: limit.windowMs,
          timestamp: new Date().toISOString(),
        });

        const resetAt = new Date(now.getTime() + limit.windowMs);
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          limit: limit.max,
          windowMs: limit.windowMs,
          reason: 'ip',
        };
      }

      // ============================================================
      // 2. Verificar limite por tenantId (se disponível)
      // ============================================================
      if (tenantId) {
        const tenantCount = await this.countByKey('tenant', action, tenantId, windowStart);
        
        if (tenantCount >= limit.max) {
          // 🔴 LOG CANÔNICO: Abuso detectado por tenant
          canonicalLogger.abuse(req, 'Limite excedido por tenant', {
            action,
            tenantId,
            ip,
            count: tenantCount,
            limit: limit.max,
            windowMs: limit.windowMs,
            timestamp: new Date().toISOString(),
          });

          const resetAt = new Date(now.getTime() + limit.windowMs);
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            limit: limit.max,
            windowMs: limit.windowMs,
            reason: 'tenant',
          };
        }
      }

      // ============================================================
      // 3. Verificar limite por userId (se disponível)
      // ============================================================
      if (userId && tenantId) {
        const userCount = await this.countByKey('user', action, `${tenantId}:${userId}`, windowStart);
        
        if (userCount >= limit.max) {
          // 🔴 LOG CANÔNICO: Abuso detectado por usuário
          canonicalLogger.abuse(req, 'Limite excedido por usuário', {
            action,
            tenantId,
            userId,
            ip,
            count: userCount,
            limit: limit.max,
            windowMs: limit.windowMs,
            timestamp: new Date().toISOString(),
          });

          const resetAt = new Date(now.getTime() + limit.windowMs);
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            limit: limit.max,
            windowMs: limit.windowMs,
            reason: 'user',
          };
        }
      }

      // ============================================================
      // 4. Verificar limite por email (para login/register)
      // ============================================================
      if (email && (action === 'auth.login' || action === 'auth.register')) {
        const normalizedEmail = email.toLowerCase().trim();
        const emailCount = await this.countByKey('email', action, normalizedEmail, windowStart);
        
        if (emailCount >= limit.max) {
          // 🔴 LOG CANÔNICO: Abuso detectado por email
          canonicalLogger.abuse(req, 'Limite excedido por email', {
            action,
            email: normalizedEmail.substring(0, 3) + '***', // Log parcial para privacidade
            ip,
            count: emailCount,
            limit: limit.max,
            windowMs: limit.windowMs,
            timestamp: new Date().toISOString(),
          });

          const resetAt = new Date(now.getTime() + limit.windowMs);
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            limit: limit.max,
            windowMs: limit.windowMs,
            reason: 'email',
          };
        }
      }

      // ============================================================
      // 5. Registrar tentativa (para tracking)
      // ============================================================
      await this.recordAttempt(action, req, tenantId, userId, email);

      // Calcular remaining (mínimo entre todas as camadas verificadas)
      const tenantCount = tenantId ? await this.countByKey('tenant', action, tenantId, windowStart) : 0;
      const userCount = userId && tenantId ? await this.countByKey('user', action, `${tenantId}:${userId}`, windowStart) : 0;
      const emailCount = email && (action === 'auth.login' || action === 'auth.register')
        ? await this.countByKey('email', action, email.toLowerCase().trim(), windowStart)
        : 0;

      const remaining = Math.min(
        limit.max - ipCount,
        tenantId ? limit.max - tenantCount : limit.max,
        userId && tenantId ? limit.max - userCount : limit.max,
        email && (action === 'auth.login' || action === 'auth.register') 
          ? limit.max - emailCount
          : limit.max
      );

      return {
        allowed: true,
        remaining: Math.max(0, remaining),
        resetAt: new Date(now.getTime() + limit.windowMs),
        limit: limit.max,
        windowMs: limit.windowMs,
      };
    } catch (error) {
      // 🔴 FAIL-OPEN: Em caso de erro, permitir (não quebrar fluxo de autenticação)
      // Mas logar erro para diagnóstico
      const ip = this.extractClientIp(req);
      canonicalLogger.error(req, 'Erro ao verificar rate limit (fail-open)', {
        action,
        ip,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      return {
        allowed: true, // Fail-open: permitir se houver erro
        remaining: limit.max,
        resetAt: new Date(now.getTime() + limit.windowMs),
        limit: limit.max,
        windowMs: limit.windowMs,
      };
    }
  }

  /**
   * Conta tentativas por chave (IP, tenant, user, email)
   */
  private async countByKey(
    keyType: 'ip' | 'tenant' | 'user' | 'email',
    action: AuthRateLimitAction,
    key: string,
    windowStart: Date
  ): Promise<number> {
    try {
      // Usar tabela dedicada ou fallback para query simples
      // Por enquanto, usar query direta (pode ser otimizado com tabela dedicada)
      const result = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text as count
        FROM auth_rate_limit_logs
        WHERE key_type = $1
          AND action = $2
          AND key_value = $3
          AND attemptedAt >= $4
        `,
        [keyType, action, key, windowStart]
      );

      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      // Se tabela não existir, retornar 0 (fail-open)
      return 0;
    }
  }

  /**
   * Registra tentativa de autenticação
   */
  private async recordAttempt(
    action: AuthRateLimitAction,
    req: FastifyRequest | null,
    tenantId?: string,
    userId?: string,
    email?: string
  ): Promise<void> {
    try {
      const ip = req ? this.extractClientIp(req) : 'unknown';
      const now = new Date();

      // Registrar por IP (sempre)
      await pool.query(
        `
        INSERT INTO auth_rate_limit_logs (key_type, action, key_value, attemptedAt, metadata)
        VALUES ('ip', $1, $2, $3, $4)
        ON CONFLICT DO NOTHING
        `,
        [action, ip, now, JSON.stringify({ tenantId, userId, email: email ? email.substring(0, 3) + '***' : null })]
      );

      // Registrar por tenant (se disponível)
      if (tenantId) {
        await pool.query(
          `
          INSERT INTO auth_rate_limit_logs (key_type, action, key_value, attemptedAt, metadata)
          VALUES ('tenant', $1, $2, $3, $4)
          ON CONFLICT DO NOTHING
          `,
          [action, tenantId, now, JSON.stringify({ ip, userId, email: email ? email.substring(0, 3) + '***' : null })]
        );
      }

      // Registrar por user (se disponível)
      if (userId && tenantId) {
        await pool.query(
          `
          INSERT INTO auth_rate_limit_logs (key_type, action, key_value, attemptedAt, metadata)
          VALUES ('user', $1, $2, $3, $4)
          ON CONFLICT DO NOTHING
          `,
          [action, `${tenantId}:${userId}`, now, JSON.stringify({ ip, email: email ? email.substring(0, 3) + '***' : null })]
        );
      }

      // Registrar por email (se disponível e aplicável)
      if (email && (action === 'auth.login' || action === 'auth.register')) {
        const normalizedEmail = email.toLowerCase().trim();
        await pool.query(
          `
          INSERT INTO auth_rate_limit_logs (key_type, action, key_value, attemptedAt, metadata)
          VALUES ('email', $1, $2, $3, $4)
          ON CONFLICT DO NOTHING
          `,
          [action, normalizedEmail, now, JSON.stringify({ ip, tenantId, userId })]
        );
      }
    } catch (error) {
      // Fail-open: não quebrar fluxo se logging falhar
      canonicalLogger.warn(req, 'Erro ao registrar tentativa (não bloqueante)', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Limpa logs antigos (manutenção)
   * Deve ser chamado periodicamente
   */
  async cleanupOldLogs(retentionDays: number = 7): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await pool.query(
        `
        DELETE FROM auth_rate_limit_logs
        WHERE attemptedAt < $1
        `,
        [cutoffDate]
      );

      canonicalLogger.info(null, 'Logs antigos limpos', {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      canonicalLogger.error(null, 'Erro ao limpar logs antigos', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const authRateLimitService = new AuthRateLimitService();


