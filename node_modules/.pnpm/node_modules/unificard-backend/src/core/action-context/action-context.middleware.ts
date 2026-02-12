// backend/src/core/action-context/action-context.middleware.ts
// ACTIONCONTEXT V2 MIDDLEWARE
// Conforme: ACTIONCONTEXT_CONTRACT.md, ACTIONCONTEXT_MIDDLEWARE_SPEC.md

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * ActionContext V2 - Contrato mínimo obrigatório
 * Conforme ACTIONCONTEXT_CONTRACT.md Seção 3
 */
export interface ActionContext {
  actorId: string;
  intent: string;
  source: string;
  scope: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    actionContext: ActionContext;
  }
}

/**
 * Middleware que valida e propaga ActionContext
 * 
 * PRINCÍPIO: Middleware propaga contexto. Middleware NÃO infere autoridade.
 * 
 * Conforme ACTIONCONTEXT_MIDDLEWARE_SPEC.md:
 * - Recebe ActionContext de headers/body/query
 * - Valida que todos os campos obrigatórios estão presentes
 * - Falha explicitamente se ActionContext estiver incompleto
 * - NÃO infere actorId de req.user
 * - NÃO cria fallback
 * - NÃO completa contexto faltante
 */
export async function actionContextMiddleware(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Aplicar a TODAS as rotas de negócio (não apenas mutáveis)
  // Conforme ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 7

  if (!req.tenant || !req.tenant.id) {
    return reply.status(400).send({ error: 'Tenant not found' });
  }

  const tenantId = req.tenant.id;

  // Receber ActionContext de inputs permitidos
  // Conforme ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 3
  let actionContext: Partial<ActionContext> | undefined;

  // 1. Tentar header x-action-context (JSON serializado)
  const headerContext = req.headers['x-action-context'] as string;
  if (headerContext) {
    try {
      actionContext = JSON.parse(headerContext) as Partial<ActionContext>;
    } catch (e) {
      return reply.status(400).send({ 
        error: 'Invalid ActionContext format in header',
        details: 'x-action-context must be valid JSON'
      });
    }
  }

  // 2. Tentar body actionContext
  if (!actionContext && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const body = req.body as any;
    if (body.actionContext) {
      actionContext = body.actionContext as Partial<ActionContext>;
    }
  }

  // 3. Tentar query actionContext
  if (!actionContext && req.query && typeof req.query === 'object') {
    const query = req.query as any;
    if (query.actionContext) {
      try {
        actionContext = typeof query.actionContext === 'string' 
          ? JSON.parse(query.actionContext) as Partial<ActionContext>
          : query.actionContext as Partial<ActionContext>;
      } catch (e) {
        return reply.status(400).send({ 
          error: 'Invalid ActionContext format in query',
          details: 'actionContext must be valid JSON'
        });
      }
    }
  }

  // 4. Tentar campos diretos no body (para compatibilidade transitória)
  if (!actionContext && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const body = req.body as any;
    if (body.actorId || body.intent || body.source || body.scope) {
      actionContext = {
        actorId: body.actorId,
        intent: body.intent,
        source: body.source,
        scope: body.scope,
      };
    }
  }

  // VALIDAÇÃO OBRIGATÓRIA: ActionContext deve estar completo
  // Conforme ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 8
  if (!actionContext) {
    return reply.status(400).send({ 
      error: 'ActionContext is required',
      details: 'ActionContext must be provided via header (x-action-context), body (actionContext), or query (actionContext)'
    });
  }

  // Validar campos obrigatórios
  // Conforme ACTIONCONTEXT_CONTRACT.md Seção 3
  if (!actionContext.actorId || typeof actionContext.actorId !== 'string' || actionContext.actorId.trim() === '') {
    return reply.status(400).send({ 
      error: 'ActionContext.actorId is required and must be non-empty string',
      details: 'actorId cannot be inferred and must be explicitly provided'
    });
  }

  if (!actionContext.intent || typeof actionContext.intent !== 'string' || actionContext.intent.trim() === '') {
    return reply.status(400).send({ 
      error: 'ActionContext.intent is required and must be non-empty string'
    });
  }

  if (!actionContext.source || typeof actionContext.source !== 'string' || actionContext.source.trim() === '') {
    return reply.status(400).send({ 
      error: 'ActionContext.source is required and must be non-empty string'
    });
  }

  if (!actionContext.scope || typeof actionContext.scope !== 'string' || actionContext.scope.trim() === '') {
    return reply.status(400).send({ 
      error: 'ActionContext.scope is required and must be non-empty string'
    });
  }

  // Validar que scope contém tenantId (coerência básica)
  // O scope deve conter o tenantId para garantir coerência
  if (!actionContext.scope.includes(tenantId)) {
    return reply.status(400).send({ 
      error: 'ActionContext.scope must include tenantId',
      details: {
        providedScope: actionContext.scope,
        expectedTenantId: tenantId
      }
    });
  }

  // Construir ActionContext válido
  const validActionContext: ActionContext = {
    actorId: actionContext.actorId.trim(),
    intent: actionContext.intent.trim(),
    source: actionContext.source.trim(),
    scope: actionContext.scope.trim(),
  };

  // Anexar ActionContext ao request
  // Conforme ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 4.1
  req.actionContext = validActionContext;
}





