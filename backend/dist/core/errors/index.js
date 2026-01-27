"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.NotFoundError = exports.UnauthorizedError = exports.BadRequestError = exports.HttpError = void 0;
// src/core/errors/index.ts
const http_error_1 = require("./http-error");
Object.defineProperty(exports, "HttpError", { enumerable: true, get: function () { return http_error_1.HttpError; } });
// Re-export para compatibilidade com imports antigos
const BadRequestError = (msg) => {
    return http_error_1.HttpError.badRequest(msg);
};
exports.BadRequestError = BadRequestError;
const UnauthorizedError = (msg) => {
    return http_error_1.HttpError.unauthorized(msg);
};
exports.UnauthorizedError = UnauthorizedError;
const NotFoundError = (msg) => {
    return http_error_1.HttpError.notFound(msg);
};
exports.NotFoundError = NotFoundError;
const ConflictError = (msg) => {
    return http_error_1.HttpError.conflict(msg);
};
exports.ConflictError = ConflictError;
