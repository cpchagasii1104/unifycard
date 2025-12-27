"use strict";
// src/core/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.UnprocessableEntityError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
/**
 * Base class para erros da aplicação.
 * Carrega status HTTP, código interno opcional
 * e mantém uma stack trace limpa no Node.
 */
class AppError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        // Ajusta o nome do erro para o nome da classe
        this.name = this.constructor.name;
        // Mantém stack trace correta no Node
        const anyError = Error;
        if (typeof anyError.captureStackTrace === "function") {
            anyError.captureStackTrace(this, this.constructor);
        }
    }
}
exports.AppError = AppError;
/**
 * 400 – Requisição inválida
 */
class BadRequestError extends AppError {
    constructor(message = "Bad request", code = "BAD_REQUEST") {
        super(400, message, code);
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
    constructor(message = "Forbidden", code = "FORBIDDEN") {
        super(403, message, code);
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * 404 – Recurso não encontrado
 */
class NotFoundError extends AppError {
    constructor(message = "Not found", code = "NOT_FOUND") {
        super(404, message, code);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 409 – Conflito de estado
 */
class ConflictError extends AppError {
    constructor(message = "Conflict", code = "CONFLICT") {
        super(409, message, code);
    }
}
exports.ConflictError = ConflictError;
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
//# sourceMappingURL=errors.js.map