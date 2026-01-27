// backend/src/core/logging/canonical-logger.ts
// Logger Canônico para Observabilidade e Forensics
// 🔴 BLINDAGEM: Todos os logs canônicos incluem correlação completa

import type { FastifyRequest } from 'fastify';

export interface CanonicalLogContext {
  requestId?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  actorId?: string;
  [key: string]: any;
}

export type SecuritySignalType = 'AUTH' | 'RBAC' | 'TENANT' | 'ABUSE' | 'SESSION' | 'EVENT';

export interface SecuritySignalMetadata {
  securitySignal: boolean;
  signalType: SecuritySignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

/**
 * Extrai contexto de correlação do request
 */
function extractCorrelationContext(req?: FastifyRequest | null): CanonicalLogContext {
  if (!req) {
    return {};
  }

  const reqAny = req as any;
  return {
    requestId: reqAny.requestId || req.headers['x-request-id'] || undefined,
    correlationId: reqAny.correlationId || req.headers['x-correlation-id'] || undefined,
    tenantId: reqAny.tenant?.id || req.headers['x-tenant-id'] || undefined,
    userId: reqAny.user?.id || reqAny.user?.userId || undefined,
    actorId: reqAny.actionContext?.actingActorId || undefined,
  };
}

/**
 * Logger Canônico
 * 
 * Garante que todos os logs críticos incluem:
 * - requestId: ID único da requisição
 * - correlationId: ID para correlacionar requisições relacionadas
 * - tenantId: ID do tenant (quando disponível)
 * - userId: ID do usuário (quando disponível)
 * - actorId: ID do actor (quando disponível)
 * 
 * Uso:
 * ```typescript
 * import { canonicalLogger } from '@core/logging/canonical-logger';
 * 
 * // Com request (recomendado)
 * canonicalLogger.info(req, 'Operação realizada', { additionalData: 'value' });
 * 
 * // Sem request (fallback)
 * canonicalLogger.info(null, 'Operação realizada', { tenantId: 'xxx', userId: 'yyy' });
 * ```
 */
class CanonicalLogger {
  /**
   * Log de informação
   * Pode incluir securitySignal se contexto indicar evento de segurança
   */
  info(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    let fullContext = { ...correlation, ...context };
    
    // Se contexto indicar evento de segurança (ex: login success), adicionar metadata
    if (context?.securitySignal || message.toLowerCase().includes('login') || message.toLowerCase().includes('auth')) {
      const securityMetadata: SecuritySignalMetadata = {
        securitySignal: true,
        signalType: 'AUTH',
        severity: 'low',
        timestamp: new Date().toISOString(),
      };
      fullContext = { ...fullContext, ...securityMetadata };
    }
    
    console.log(`[CANONICAL] ${message}`, fullContext);
  }

  /**
   * Log de aviso
   * Pode incluir securitySignal se contexto indicar evento de segurança
   */
  warn(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    let fullContext = { ...correlation, ...context };
    
    // Se contexto indicar evento de segurança (ex: login failure, token invalidado), adicionar metadata
    if (context?.securitySignal || 
        message.toLowerCase().includes('login') || 
        message.toLowerCase().includes('token') || 
        message.toLowerCase().includes('auth') ||
        message.toLowerCase().includes('tenant')) {
      const securityMetadata: SecuritySignalMetadata = {
        securitySignal: true,
        signalType: message.toLowerCase().includes('tenant') ? 'TENANT' : 'AUTH',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      };
      fullContext = { ...fullContext, ...securityMetadata };
    }
    
    console.warn(`[CANONICAL] ⚠️ ${message}`, fullContext);
  }

  /**
   * Log de erro
   * Pode incluir securitySignal se contexto indicar evento de segurança
   */
  error(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    let fullContext = { ...correlation, ...context };
    
    // Se contexto indicar evento de segurança (ex: evento rejeitado, erro de auth), adicionar metadata
    if (context?.securitySignal || 
        message.toLowerCase().includes('event') || 
        message.toLowerCase().includes('auth') ||
        message.toLowerCase().includes('tenant')) {
      const securityMetadata: SecuritySignalMetadata = {
        securitySignal: true,
        signalType: message.toLowerCase().includes('event') ? 'EVENT' : 
                   message.toLowerCase().includes('tenant') ? 'TENANT' : 'AUTH',
        severity: 'high',
        timestamp: new Date().toISOString(),
      };
      fullContext = { ...fullContext, ...securityMetadata };
    }
    
    console.error(`[CANONICAL] ❌ ${message}`, fullContext);
  }

  /**
   * Log de debug
   */
  debug(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    const fullContext = { ...correlation, ...context };
    
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
      console.debug(`[CANONICAL] 🔍 ${message}`, fullContext);
    }
  }

  /**
   * Log de abuso/segurança
   * 🔴 SECURITY SIGNAL: Marcado como sinal de segurança para SIEM/SOC
   */
  abuse(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    // Determinar signalType baseado na mensagem
    const messageLower = message.toLowerCase();
    const signalType: SecuritySignalType = 
      messageLower.includes('cross-tenant') || messageLower.includes('tenant') ? 'TENANT' :
      messageLower.includes('replay') ? 'ABUSE' :
      'ABUSE';
    
    const securityMetadata: SecuritySignalMetadata = {
      securitySignal: true,
      signalType,
      severity: signalType === 'TENANT' ? 'critical' : 'critical',
      timestamp: new Date().toISOString(),
    };
    const fullContext = { ...correlation, ...context, ...securityMetadata };
    
    console.warn(`[CANONICAL] 🚫 ABUSO: ${message}`, fullContext);
  }

  /**
   * Log de invalidação
   * 🔴 SECURITY SIGNAL: Marcado como sinal de segurança para SIEM/SOC
   */
  invalidation(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    const securityMetadata: SecuritySignalMetadata = {
      securitySignal: true,
      signalType: 'SESSION',
      severity: 'medium',
      timestamp: new Date().toISOString(),
    };
    const fullContext = { ...correlation, ...context, ...securityMetadata };
    
    console.log(`[CANONICAL] 🔄 INVALIDAÇÃO: ${message}`, fullContext);
  }

  /**
   * Log de autorização (allow)
   * 🔴 SECURITY SIGNAL: Marcado como sinal de segurança para SIEM/SOC
   */
  authzAllow(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    const securityMetadata: SecuritySignalMetadata = {
      securitySignal: true,
      signalType: 'RBAC',
      severity: 'low',
      timestamp: new Date().toISOString(),
    };
    const fullContext = { ...correlation, ...context, ...securityMetadata };
    
    console.log(`[CANONICAL] ✅ AUTHZ ALLOW: ${message}`, fullContext);
  }

  /**
   * Log de autorização (deny)
   * 🔴 SECURITY SIGNAL: Marcado como sinal de segurança para SIEM/SOC
   */
  authzDeny(req: FastifyRequest | null, message: string, context?: CanonicalLogContext): void {
    const correlation = extractCorrelationContext(req);
    const securityMetadata: SecuritySignalMetadata = {
      securitySignal: true,
      signalType: 'RBAC',
      severity: 'medium',
      timestamp: new Date().toISOString(),
    };
    const fullContext = { ...correlation, ...context, ...securityMetadata };
    
    console.warn(`[CANONICAL] 🚫 AUTHZ DENY: ${message}`, fullContext);
  }
}

export const canonicalLogger = new CanonicalLogger();

