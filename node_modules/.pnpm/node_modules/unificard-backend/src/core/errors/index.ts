// src/core/errors/index.ts
import { HttpError } from './http-error';

export { HttpError };

// Re-export para compatibilidade com imports antigos
export const BadRequestError = (msg: string) => {
  return HttpError.badRequest(msg);
};

export const UnauthorizedError = (msg: string) => {
  return HttpError.unauthorized(msg);
};

export const NotFoundError = (msg: string) => {
  return HttpError.notFound(msg);
};

export const ConflictError = (msg: string) => {
  return HttpError.conflict(msg);
};
