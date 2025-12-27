// src/plugins/error-handler.plugin.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyError } from 'fastify';

/**
 * Error Handler Plugin
 *
 * Responsabilidade:
 *  - Logar erros
 *  - Padronizar resposta de erro
 *  - Não vazar stack trace em produção
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    fastify.log.error({
      err: error,
      url: request.url,
      method: request.method,
    });

    const statusCode = error.statusCode ?? 500;
    const isProduction = process.env.NODE_ENV === 'production';

    // Padronizar resposta de erro
    const errorResponse: any = {
      ok: false,
      message: statusCode >= 500 && isProduction ? 'Internal server error' : error.message,
    };

    // Incluir código de erro se disponível (útil para tratamento no frontend)
    // CORREÇÃO: Garantir que MISSING_TENANT seja sempre identificado corretamente
    if (error.statusCode === 400) {
      // Para erros 400, verificar se é tenant missing
      const messageLower = error.message.toLowerCase();
      if (messageLower.includes('tenant') || messageLower.includes('x-tenant-id')) {
        errorResponse.code = 'MISSING_TENANT';
        errorResponse.message = 'Tenant ID é obrigatório';
      } else if (error.code) {
        errorResponse.code = error.code;
      } else {
        errorResponse.code = 'BAD_REQUEST';
      }
    } else if (error.code) {
      errorResponse.code = error.code;
    } else if (statusCode >= 500) {
      errorResponse.code = 'INTERNAL_ERROR';
    }

    // Em desenvolvimento, incluir stack trace
    if (!isProduction && error.stack) {
      errorResponse.stack = error.stack;
    }

    reply.status(statusCode).send(errorResponse);
  });
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler-plugin',
});
