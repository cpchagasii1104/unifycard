// src/core/errors/http-error.ts

/**
 * Erro HTTP padronizado para toda a aplicação.
 * Usado para lançar erros com status code específico.
 */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string): HttpError {
    return new HttpError(message, 400);
  }

  static unauthorized(message: string): HttpError {
    return new HttpError(message, 401);
  }

  static forbidden(message: string): HttpError {
    return new HttpError(message, 403);
  }

  static notFound(message: string): HttpError {
    return new HttpError(message, 404);
  }

  static conflict(message: string): HttpError {
    return new HttpError(message, 409);
  }

  static internal(message: string): HttpError {
    return new HttpError(message, 500);
  }
}
