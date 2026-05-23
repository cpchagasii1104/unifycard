// src/core/errors.ts
// 🔴 BLINDAGEM: Sem vazamento de stack em produção

import { ErrorCode, ERROR_MESSAGES } from './errors/error-codes';

/**
 * Base class para erros da aplicação.
 * Carrega status HTTP, código interno opcional
 * e mantém uma stack trace limpa no Node.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isProduction: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code || ErrorCode.INTERNAL_ERROR;
    this.details = details;
    this.isProduction = process.env.NODE_ENV === 'production';

    // Ajusta o nome do erro para o nome da classe
    this.name = this.constructor.name;

    // Mantém stack trace correta no Node
    const anyError = Error as any;
    if (typeof anyError.captureStackTrace === "function") {
      anyError.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Retorna mensagem segura para produção
   */
  getSafeMessage(): string {
    if (this.isProduction && this.statusCode >= 500) {
      return ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];
    }
    return this.message;
  }
}

/**
 * 400 – Requisição inválida
 */
export class BadRequestError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.BAD_REQUEST) {
    super(400, message || ERROR_MESSAGES[code], code);
  }
}

/**
 * 401 – Falha de autenticação
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(401, message, code);
  }
}

/**
 * 403 – Usuário autenticado mas sem permissão
 */
export class ForbiddenError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.FORBIDDEN) {
    super(403, message || ERROR_MESSAGES[code], code);
  }
}

/**
 * 404 – Recurso não encontrado
 */
export class NotFoundError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.NOT_FOUND) {
    super(404, message || ERROR_MESSAGES[code], code);
  }
}

/**
 * 409 – Conflito de estado
 */
export class ConflictError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.CONFLICT) {
    super(409, message || ERROR_MESSAGES[code], code);
  }
}

/**
 * 429 – Limite de requisições excedido
 */
export class RateLimitError extends AppError {
  public readonly resetAt?: Date;
  public readonly remaining?: number;

  constructor(
    message?: string,
    resetAt?: Date,
    remaining?: number,
    code: ErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED
  ) {
    super(429, message || ERROR_MESSAGES[code], code);
    this.resetAt = resetAt;
    this.remaining = remaining;
  }
}

/**
 * 422 – Entidade não processável (validou formato, mas lógica inválida)
 */
export class UnprocessableEntityError extends AppError {
  constructor(
    message = "Unprocessable entity",
    code = "UNPROCESSABLE_ENTITY"
  ) {
    super(422, message, code);
  }
}

/**
 * 500 – Erro interno inesperado
 */
export class InternalServerError extends AppError {
  constructor(message = "Internal server error", code = "INTERNAL_ERROR") {
    super(500, message, code);
  }
}
