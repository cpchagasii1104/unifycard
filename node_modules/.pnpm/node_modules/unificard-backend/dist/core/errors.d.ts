/**
 * Base class para erros da aplicação.
 * Carrega status HTTP, código interno opcional
 * e mantém uma stack trace limpa no Node.
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code?: string;
    constructor(statusCode: number, message: string, code?: string);
}
/**
 * 400 – Requisição inválida
 */
export declare class BadRequestError extends AppError {
    constructor(message?: string, code?: string);
}
/**
 * 401 – Falha de autenticação
 */
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, code?: string);
}
/**
 * 403 – Usuário autenticado mas sem permissão
 */
export declare class ForbiddenError extends AppError {
    constructor(message?: string, code?: string);
}
/**
 * 404 – Recurso não encontrado
 */
export declare class NotFoundError extends AppError {
    constructor(message?: string, code?: string);
}
/**
 * 409 – Conflito de estado
 */
export declare class ConflictError extends AppError {
    constructor(message?: string, code?: string);
}
/**
 * 422 – Entidade não processável (validou formato, mas lógica inválida)
 */
export declare class UnprocessableEntityError extends AppError {
    constructor(message?: string, code?: string);
}
/**
 * 500 – Erro interno inesperado
 */
export declare class InternalServerError extends AppError {
    constructor(message?: string, code?: string);
}
//# sourceMappingURL=errors.d.ts.map