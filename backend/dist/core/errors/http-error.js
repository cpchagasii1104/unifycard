"use strict";
// src/core/errors/http-error.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
/**
 * Erro HTTP padronizado para toda a aplicação.
 * Usado para lançar erros com status code específico.
 */
class HttpError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
    static badRequest(message) {
        return new HttpError(message, 400);
    }
    static unauthorized(message) {
        return new HttpError(message, 401);
    }
    static forbidden(message) {
        return new HttpError(message, 403);
    }
    static notFound(message) {
        return new HttpError(message, 404);
    }
    static conflict(message) {
        return new HttpError(message, 409);
    }
    static internal(message) {
        return new HttpError(message, 500);
    }
}
exports.HttpError = HttpError;
