// src/core/auth/auth.plugin.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { authService } from '@core/auth/auth.service';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw fastify.httpErrors.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();

    let payload;
    try {
      payload = await authService.verifyAccessToken(token);
    } catch {
      throw fastify.httpErrors.unauthorized('Invalid or expired token');
    }

    // 🔐 Validação CRÍTICA: o token deve corresponder ao tenant da requisição
    const reqAny = req as any;
    const headerTenantId = req.headers['x-tenant-id'] as string;
    
    // 🔴 DIAGNÓSTICO: Logs temporários para auditoria de tenant mismatch
    fastify.log.info({
      route: req.url,
      method: req.method,
      headerTenantId,
      jwtTenantId: payload.tenantId,
      jwtUserId: payload.userId ?? payload.sub,
      jwtGlobalUserId: (payload as any).globalUserId,
      reqTenantId: reqAny.tenant?.id,
      tenantMatch: headerTenantId === payload.tenantId,
    }, '🔍 [AUTH] Validação de tenant - JWT vs Header');
    
    // Validação 1: Tenant deve estar definido no request
    if (!reqAny.tenant) {
      // 400 Bad Request - tenant não foi definido (deveria ter sido definido pelo tenant plugin)
      fastify.log.error({
        route: req.url,
        headerTenantId,
        jwtTenantId: payload.tenantId,
      }, '❌ [AUTH] Tenant não encontrado no request');
      throw fastify.httpErrors.badRequest('Tenant not found in request');
    }
    
    // 🔴 VALIDAÇÃO CRÍTICA: Header x-tenant-id DEVE ser igual ao tenantId do JWT
    // Isso previne que o usuário faça login em um tenant e use token em outro tenant diferente
    if (payload.tenantId !== reqAny.tenant.id) {
      const errorMessage = `TENANT_MISMATCH: Token tenant (${payload.tenantId}) does not match request tenant (${reqAny.tenant.id})`;
      fastify.log.error({
        route: req.url,
        method: req.method,
        headerTenantId,
        jwtTenantId: payload.tenantId,
        jwtUserId: payload.userId ?? payload.sub,
        jwtEmail: payload.email,
        errorCode: 'TENANT_MISMATCH',
      }, `❌ [AUTH] ${errorMessage}`);
      
      // 403 Forbidden - token válido mas não tem permissão para este tenant
      const error = fastify.httpErrors.forbidden(errorMessage) as Error & { code?: string };
      error.code = 'TENANT_MISMATCH';
      throw error;
    }
    
    // Validação adicional: garantir que header x-tenant-id corresponde
    if (headerTenantId && headerTenantId !== payload.tenantId) {
      const errorMessage = `TENANT_MISMATCH: Header x-tenant-id (${headerTenantId}) does not match JWT tenant (${payload.tenantId})`;
      fastify.log.error({
        route: req.url,
        headerTenantId,
        jwtTenantId: payload.tenantId,
        jwtUserId: payload.userId ?? payload.sub,
        errorCode: 'TENANT_MISMATCH',
      }, `❌ [AUTH] ${errorMessage}`);
      
      const error = fastify.httpErrors.forbidden(errorMessage) as Error & { code?: string };
      error.code = 'TENANT_MISMATCH';
      throw error;
    }

    // 🚀 Preenche req.user SOMENTE com os campos existentes no tipo definido
    reqAny.user = {
      id: payload.userId ?? payload.sub,
      email: payload.email ?? undefined,
      globalUserId: (payload as any).globalUserId ?? undefined,
    };
    
    // 🔴 DIAGNÓSTICO: Log final de sucesso
    fastify.log.info({
      route: req.url,
      userId: reqAny.user.id,
      tenantId: reqAny.tenant.id,
      globalUserId: reqAny.user.globalUserId,
      email: reqAny.user.email,
    }, '✅ [AUTH] Autenticação validada com sucesso');
  });
};

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['tenant-plugin'],
});
