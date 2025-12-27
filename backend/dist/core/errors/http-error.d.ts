/**
 * Erro HTTP padronizado para toda a aplicação.
 * Usado para lançar erros com status code específico.
 */
export declare class HttpError extends Error {
    readonly statusCode: number;
    constructor(message: string, statusCode: number);
    static badRequest(message: string): HttpError;
    static unauthorized(message: string): HttpError;
    static forbidden(message: string): HttpError;
    static notFound(message: string): HttpError;
    static conflict(message: string): HttpError;
    static internal(message: string): HttpError;
}
//# sourceMappingURL=http-error.d.ts.map