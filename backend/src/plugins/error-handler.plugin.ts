// src/plugins/error-handler.plugin.ts
// §9.5 NOMENCLATURA_CANONICA — envelope { error, meta }
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';
import { FastifyPluginAsync, FastifyError, FastifyRequest } from 'fastify';
import { AppError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import {
  IdempotencyMismatchError,
  IDEMPOTENCY_MISMATCH_HTTP_MESSAGE,
} from '@core/events/idempotency-tracker';
import { buildCanonicalHttpErrorPayload } from '@core/http/canonical-http-error';

/**
 * Error Handler Plugin
 *
 * Responsabilidade:
 *  - Logar erros com requestId
 *  - Resposta §9.5: { error: { code, message, details?, help? }, meta: { requestId, timestamp } }
 *  - Não vazar stack trace em produção
 *  - 404 de rota inexistente: setNotFoundHandler → mesmo envelope (não usa o basic404 do Fastify)
 */
const errorHandlerPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.setNotFoundHandler((request: FastifyRequest, reply) => {
    const ridRaw = (request as any).requestId ?? request.id;
    const requestId =
      typeof ridRaw === 'string' && ridRaw.trim() !== '' ? ridRaw : randomUUID();
    const message = `Route ${request.method} ${request.url} not found`;
    request.log.info(
      { url: request.url, method: request.method, requestId },
      message
    );
    return reply.status(404).send(
      buildCanonicalHttpErrorPayload(ErrorCode.ROUTE_NOT_FOUND, message, requestId)
    );
  });

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const ridRaw = (request as any).requestId ?? request.id;
    const requestId =
      typeof ridRaw === 'string' && ridRaw.trim() !== '' ? ridRaw : randomUUID();
    const correlationId = (request.headers['x-correlation-id'] as string) || requestId;

    if (error instanceof IdempotencyMismatchError) {
      fastify.log.warn(
        {
          err: error,
          url: request.url,
          method: request.method,
          requestId,
          correlationId,
          tenantId: (request as any).tenant?.id,
          userId: (request as any).user?.id,
        },
        'Idempotency mismatch (409)'
      );
      return reply
        .status(409)
        .send(
          buildCanonicalHttpErrorPayload(
            error.code,
            IDEMPOTENCY_MISMATCH_HTTP_MESSAGE,
            requestId
          )
        );
    }

    fastify.log.error({
      err: error,
      url: request.url,
      method: request.method,
      requestId,
      correlationId,
      tenantId: (request as any).tenant?.id,
      userId: (request as any).user?.id,
    });

    const statusCode = error.statusCode ?? 500;
    const isProduction = process.env.NODE_ENV === 'production';

    const errorCode =
      error instanceof AppError
        ? error.code
        : (error as any).code || ErrorCode.INTERNAL_ERROR;

    const safeMessage =
      error instanceof AppError
        ? error.getSafeMessage()
        : statusCode >= 500 && isProduction
          ? 'Internal server error'
          : error.message;

    const details: Record<string, unknown> = {};

    if (error instanceof AppError && error.details) {
      Object.assign(details, error.details);
    }

    if (error instanceof AppError && error.statusCode === 429) {
      const rateLimitError = error as any;
      if (rateLimitError.resetAt) {
        details.resetAt = rateLimitError.resetAt.toISOString();
      }
      if (rateLimitError.remaining !== undefined) {
        details.remaining = rateLimitError.remaining;
      }
    }

    if (!isProduction) {
      if (error.stack) {
        details.stack = error.stack;
      }
      if ((error as any).details) {
        details.domain = (error as any).details;
      }
    }

    const payload = buildCanonicalHttpErrorPayload(
      errorCode,
      safeMessage,
      requestId,
      Object.keys(details).length > 0 ? { details } : undefined
    );

    reply.status(statusCode).send(payload);
  });
};

export const errorHandlerPlugin = fp(errorHandlerPluginImpl, {
  name: 'error-handler-plugin',
});
