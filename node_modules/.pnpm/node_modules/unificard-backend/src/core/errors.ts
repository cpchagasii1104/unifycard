// src/core/errors.ts

/**
 * Base class para erros da aplicação.
 * Carrega status HTTP, código interno opcional
 * e mantém uma stack trace limpa no Node.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;

    // Ajusta o nome do erro para o nome da classe
    this.name = this.constructor.name;

    // Mantém stack trace correta no Node
    const anyError = Error as any;
    if (typeof anyError.captureStackTrace === "function") {
      anyError.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 – Requisição inválida
 */
export class BadRequestError extends AppError {
  constructor(message = "Bad request", code = "BAD_REQUEST") {
    super(400, message, code);
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
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(403, message, code);
  }
}

/**
 * 404 – Recurso não encontrado
 */
export class NotFoundError extends AppError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(404, message, code);
  }
}

/**
 * 409 – Conflito de estado
 */
export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(409, message, code);
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
