// backend/src/core/auth/webauthn.routes.ts
// SPRINT 36.3: BANK SAFETY LAYER - WebAuthn Routes
// Endpoints para step-up authentication via WebAuthn/Passkeys

import { FastifyPluginAsync } from 'fastify';
import { webauthnService } from './webauthn.service';
import type { VerifyAssertionInput } from './webauthn.types';
import { authRateLimitService } from '@core/rate-limiting/auth-rate-limit.service';
import { RateLimitError } from '@core/errors';
import { z } from 'zod';

// Schemas de validação
const createChallengeSchema = z.object({
  userId: z.string().uuid(),
});

const verifyAssertionSchema = z.object({
  userId: z.string().uuid(),
  credentialId: z.string(),
  authenticatorData: z.string(),
  clientDataJSON: z.string(),
  signature: z.string(),
  userHandle: z.string().optional(),
});

type CreateChallengeBody = z.infer<typeof createChallengeSchema>;
type VerifyAssertionBody = z.infer<typeof verifyAssertionSchema>;

const webauthnRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/webauthn/challenge
   * Cria challenge para step-up authentication
   * 
   * ⚠️ SCAFFOLDING: Retorna erro WEBAUTHN_NOT_REGISTERED se não houver credencial.
   * Não cria falsa sensação de segurança.
   */
  fastify.post<{ Body: CreateChallengeBody }>(
    '/challenge',
    async (req, reply) => {
      // 🔴 GARANTIA CANÔNICA: webauthn está em /auth/* (escopo público)
      // NÃO pode depender de req.tenant (só existe no escopo protegido)
      // NÃO pode assumir tenantPlugin (não roda em /auth/*)
      // tenantId vem EXCLUSIVAMENTE de header x-tenant-id
      const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
      
      // 🔴 VALIDAÇÃO EXPLÍCITA: tenantId OBRIGATÓRIO - fail fast
      if (!tenantIdHeader || typeof tenantIdHeader !== 'string' || tenantIdHeader.trim() === '') {
        fastify.log.error({
          route: '/auth/webauthn/challenge',
          method: 'POST',
          hasHeader: !!tenantIdHeader,
          headerType: typeof tenantIdHeader,
        }, '❌ [WEBAUTHN] tenantId ausente ou inválido no header x-tenant-id');
        
        return reply.status(400).send({
          error: 'TENANT_ID_REQUIRED',
          message: 'Tenant ID é obrigatório no header x-tenant-id',
        });
      }
      
      const tenantId = tenantIdHeader.trim();

      // Validar payload
      const parsed = createChallengeSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      const { userId } = parsed.data;

      // 🔴 RATE LIMITING: Verificar limite antes de processar
      try {
        const rateLimitCheck = await authRateLimitService.checkRateLimit(
          'auth.webauthn.challenge',
          req,
          tenantId,
          userId
        );

        if (!rateLimitCheck.allowed) {
          // 🔴 LOG CANÔNICO: Abuso detectado
          fastify.log.warn({
            route: '/auth/webauthn/challenge',
            ip: authRateLimitService.extractClientIp(req),
            tenantId,
            userId,
            reason: rateLimitCheck.reason,
            limit: rateLimitCheck.limit,
            resetAt: rateLimitCheck.resetAt.toISOString(),
          }, '🚫 [WEBAUTHN] Rate limit excedido em /auth/webauthn/challenge');

          throw new RateLimitError(
            `Limite de tentativas de challenge excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
            rateLimitCheck.resetAt,
            rateLimitCheck.remaining
          );
        }
      } catch (error) {
        if (error instanceof RateLimitError) {
          return reply.status(429).send({
            success: false,
            error: error.message,
            resetAt: error.resetAt?.toISOString(),
            remaining: error.remaining,
          });
        }
        // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
        fastify.log.warn({ err: error }, '[WEBAUTHN] Erro ao verificar rate limit (fail-open)');
      }

      try {
        const result = await webauthnService.createChallenge(tenantId, {
          userId,
        });

        return reply.status(200).send({
          challenge: result.challenge,
          challengeId: result.challengeId,
          expiresAt: result.expiresAt.toISOString(),
          hasCredential: result.hasCredential,
        });
      } catch (error: any) {
        // Erro específico: credencial não registrada
        if (error.errorCode === 'WEBAUTHN_NOT_REGISTERED') {
          return reply.status(400).send({
            error: 'WebAuthn credential not registered',
            errorCode: 'WEBAUTHN_NOT_REGISTERED',
            message: 'Usuário não possui credencial WebAuthn registrada',
          });
        }

        fastify.log.error({ err: error }, 'Error creating WebAuthn challenge');
        return reply.status(500).send({
          error: 'Failed to create challenge',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /auth/webauthn/verify
   * Verifica assertion WebAuthn
   * 
   * ⚠️ HOTFIX: Verificação criptográfica REAL ainda não implementada.
   * NUNCA retorna verified=true enquanto verificação real não existir.
   * Retorna WEBAUTHN_VERIFY_NOT_IMPLEMENTED.
   */
  fastify.post<{ Body: VerifyAssertionBody }>('/verify', async (req, reply) => {
    // 🔴 GARANTIA CANÔNICA: webauthn está em /auth/* (escopo público)
    // NÃO pode depender de req.tenant (só existe no escopo protegido)
    // NÃO pode assumir tenantPlugin (não roda em /auth/*)
    // tenantId vem EXCLUSIVAMENTE de header x-tenant-id
    const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
    
    // 🔴 VALIDAÇÃO EXPLÍCITA: tenantId OBRIGATÓRIO - fail fast
    if (!tenantIdHeader || typeof tenantIdHeader !== 'string' || tenantIdHeader.trim() === '') {
      fastify.log.error({
        route: '/auth/webauthn/verify',
        method: 'POST',
        hasHeader: !!tenantIdHeader,
        headerType: typeof tenantIdHeader,
      }, '❌ [WEBAUTHN] tenantId ausente ou inválido no header x-tenant-id');
      
      return reply.status(400).send({
        error: 'TENANT_ID_REQUIRED',
        message: 'Tenant ID é obrigatório no header x-tenant-id',
      });
    }
    
    const tenantId = tenantIdHeader.trim();

    // Validar payload
    const parsed = verifyAssertionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { userId, credentialId, authenticatorData, clientDataJSON, signature, userHandle } = parsed.data;
    if (!userId || !credentialId || !authenticatorData || !clientDataJSON || !signature) {
      return reply.status(400).send({
        error: 'Invalid request body',
        message: 'Missing required fields for WebAuthn verification',
      });
    }

    const input: VerifyAssertionInput = {
      userId,
      credentialId,
      authenticatorData,
      clientDataJSON,
      signature,
      ...(userHandle !== undefined && { userHandle }),
    };

    // 🔴 RATE LIMITING: Verificar limite antes de processar
    try {
      const rateLimitCheck = await authRateLimitService.checkRateLimit(
        'auth.webauthn.verify',
        req,
        tenantId,
        userId
      );

      if (!rateLimitCheck.allowed) {
        // 🔴 LOG CANÔNICO: Abuso detectado
        fastify.log.warn({
          route: '/auth/webauthn/verify',
          ip: authRateLimitService.extractClientIp(req),
          tenantId,
          userId,
          reason: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        }, '🚫 [WEBAUTHN] Rate limit excedido em /auth/webauthn/verify');

        throw new RateLimitError(
          `Limite de tentativas de verificação excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
          rateLimitCheck.resetAt,
          rateLimitCheck.remaining
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          resetAt: error.resetAt?.toISOString(),
          remaining: error.remaining,
        });
      }
      // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
      fastify.log.warn({ err: error }, '[WEBAUTHN] Erro ao verificar rate limit (fail-open)');
    }

    try {
      const result = await webauthnService.verifyAssertion(tenantId, input);

      if (!result.isVerified) {
        return reply.status(400).send({
          isVerified: false,
          error: result.error,
          errorCode: result.errorCode,
        });
      }

      return reply.status(200).send({
        isVerified: true,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Error verifying WebAuthn assertion');
      return reply.status(500).send({
        isVerified: false,
        error: 'Failed to verify assertion',
        message: error.message,
      });
    }
  });

  /**
   * GET /auth/webauthn/status
   * Verifica se usuário tem credencial registrada
   */
  fastify.get<{ Params: { userId: string } }>(
    '/status/:userId',
    async (req, reply) => {
      // 🔴 GARANTIA CANÔNICA: webauthn está em /auth/* (escopo público)
      // NÃO pode depender de req.tenant (só existe no escopo protegido)
      // NÃO pode assumir tenantPlugin (não roda em /auth/*)
      // tenantId vem EXCLUSIVAMENTE de header x-tenant-id
      const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
      
      // 🔴 VALIDAÇÃO EXPLÍCITA: tenantId OBRIGATÓRIO - fail fast
      if (!tenantIdHeader || typeof tenantIdHeader !== 'string' || tenantIdHeader.trim() === '') {
        fastify.log.error({
          route: '/auth/webauthn/status/:userId',
          method: 'GET',
          hasHeader: !!tenantIdHeader,
          headerType: typeof tenantIdHeader,
        }, '❌ [WEBAUTHN] tenantId ausente ou inválido no header x-tenant-id');
        
        return reply.status(400).send({
          error: 'TENANT_ID_REQUIRED',
          message: 'Tenant ID é obrigatório no header x-tenant-id',
        });
      }
      
      const tenantId = tenantIdHeader.trim();
      const { userId } = req.params;

      try {
        const hasCredential = await webauthnService.hasCredential(
          tenantId,
          userId
        );

        return reply.status(200).send({
          hasCredential,
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Error checking WebAuthn status');
        return reply.status(500).send({
          error: 'Failed to check status',
          message: error.message,
        });
      }
    }
  );
};

export default webauthnRoutes;

