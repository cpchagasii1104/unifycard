"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerPlugin = void 0;
// src/plugins/error-handler.plugin.ts
// 🔴 BLINDAGEM: Sem vazamento de stack em produção
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const errors_1 = require("@core/errors");
const error_codes_1 = require("@core/errors/error-codes");
/**
 * Error Handler Plugin
 *
 * Responsabilidade:
 *  - Logar erros com requestId
 *  - Padronizar resposta de erro
 *  - Não vazar stack trace em produção
 */
const errorHandlerPluginImpl = async (fastify) => {
    fastify.setErrorHandler((error, request, reply) => {
        const requestId = request.requestId || request.id;
        const correlationId = request.headers['x-correlation-id'] || requestId;
        fastify.log.error({
            err: error,
            url: request.url,
            method: request.method,
            requestId,
            correlationId,
            tenantId: request.tenant?.id,
            userId: request.user?.id,
        });
        const statusCode = error.statusCode ?? 500;
        const isProduction = process.env.NODE_ENV === 'production';
        // Padronizar resposta de erro
        // 🔴 FORMATO PADRÃO: { code, message, requestId? }
        const errorCode = error instanceof errors_1.AppError
            ? error.code
            : error.code || error_codes_1.ErrorCode.INTERNAL_ERROR;
        const safeMessage = error instanceof errors_1.AppError
            ? error.getSafeMessage()
            : (statusCode >= 500 && isProduction
                ? 'Erro interno do servidor'
                : error.message);
        const errorResponse = {
            code: errorCode,
            message: safeMessage,
        };
        // Adicionar requestId para rastreabilidade
        if (requestId) {
            errorResponse.requestId = requestId;
        }
        // Adicionar informações específicas para rate limit
        if (error instanceof errors_1.AppError && error.statusCode === 429) {
            const rateLimitError = error;
            if (rateLimitError.resetAt) {
                errorResponse.resetAt = rateLimitError.resetAt.toISOString();
            }
            if (rateLimitError.remaining !== undefined) {
                errorResponse.remaining = rateLimitError.remaining;
            }
        }
        // Em desenvolvimento, incluir stack trace e detalhes
        if (!isProduction) {
            if (error.stack) {
                errorResponse.stack = error.stack;
            }
            if (error.details) {
                errorResponse.details = error.details;
            }
        }
        reply.status(statusCode).send(errorResponse);
    });
};
exports.errorHandlerPlugin = (0, fastify_plugin_1.default)(errorHandlerPluginImpl, {
    name: 'error-handler-plugin',
});
