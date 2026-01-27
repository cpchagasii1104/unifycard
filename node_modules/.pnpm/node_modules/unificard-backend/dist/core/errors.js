"use strict";
// src/core/errors.ts
// 🔴 BLINDAGEM: Sem vazamento de stack em produção
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.UnprocessableEntityError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
const error_codes_1 = require("./errors/error-codes");
/**
 * Base class para erros da aplicação.
 * Carrega status HTTP, código interno opcional
 * e mantém uma stack trace limpa no Node.
 */
class AppError extends Error {
    statusCode;
    code;
    isProduction;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code || error_codes_1.ErrorCode.INTERNAL_ERROR;
        this.isProduction = process.env.NODE_ENV === 'production';
        // Ajusta o nome do erro para o nome da classe
        this.name = this.constructor.name;
        // Mantém stack trace correta no Node
        const anyError = Error;
        if (typeof anyError.captureStackTrace === "function") {
            anyError.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Retorna mensagem segura para produção
     */
    getSafeMessage() {
        if (this.isProduction && this.statusCode >= 500) {
            return error_codes_1.ERROR_MESSAGES[error_codes_1.ErrorCode.INTERNAL_ERROR];
        }
        return this.message;
    }
}
exports.AppError = AppError;
/**
 * 400 – Requisição inválida
 */
class BadRequestError extends AppError {
    constructor(message, code = error_codes_1.ErrorCode.BAD_REQUEST) {
        super(400, message || error_codes_1.ERROR_MESSAGES[code], code);
    }
}
exports.BadRequestError = BadRequestError;
/**
 * 401 – Falha de autenticação
 */
class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
        super(401, message, code);
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * 403 – Usuário autenticado mas sem permissão
 */
class ForbiddenError extends AppError {
    constructor(message, code = error_codes_1.ErrorCode.FORBIDDEN) {
        super(403, message || error_codes_1.ERROR_MESSAGES[code], code);
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * 404 – Recurso não encontrado
 */
class NotFoundError extends AppError {
    constructor(message, code = error_codes_1.ErrorCode.NOT_FOUND) {
        super(404, message || error_codes_1.ERROR_MESSAGES[code], code);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 409 – Conflito de estado
 */
class ConflictError extends AppError {
    constructor(message, code = error_codes_1.ErrorCode.CONFLICT) {
        super(409, message || error_codes_1.ERROR_MESSAGES[code], code);
    }
}
exports.ConflictError = ConflictError;
/**
 * 429 – Limite de requisições excedido
 */
class RateLimitError extends AppError {
    resetAt;
    remaining;
    constructor(message, resetAt, remaining, code = error_codes_1.ErrorCode.RATE_LIMIT_EXCEEDED) {
        super(429, message || error_codes_1.ERROR_MESSAGES[code], code);
        this.resetAt = resetAt;
        this.remaining = remaining;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * 422 – Entidade não processável (validou formato, mas lógica inválida)
 */
class UnprocessableEntityError extends AppError {
    constructor(message = "Unprocessable entity", code = "UNPROCESSABLE_ENTITY") {
        super(422, message, code);
    }
}
exports.UnprocessableEntityError = UnprocessableEntityError;
/**
 * 500 – Erro interno inesperado
 */
class InternalServerError extends AppError {
    constructor(message = "Internal server error", code = "INTERNAL_ERROR") {
        super(500, message, code);
    }
}
exports.InternalServerError = InternalServerError;
