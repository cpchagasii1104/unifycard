// backend/src/core/errors/error-codes.ts
// Códigos de Erro Padronizados
// 🔴 BLINDAGEM: Sem vazamento de stack em produção

/**
 * Códigos de erro canônicos
 */
export enum ErrorCode {
  // 400 - Bad Request
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_TENANT = 'MISSING_TENANT',
  MISSING_ACTOR = 'MISSING_ACTOR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // 401 - Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // 403 - Forbidden
  FORBIDDEN = 'FORBIDDEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  
  // 404 - Not Found
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // 409 - Conflict
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // 429 - Too Many Requests
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // 500 - Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Domínio específico
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_ALREADY_DECIDED = 'BOOKING_ALREADY_DECIDED',
  RFQ_NOT_FOUND = 'RFQ_NOT_FOUND',
  RFQ_CLOSED = 'RFQ_CLOSED',
  SERVICE_ORDER_NOT_FOUND = 'SERVICE_ORDER_NOT_FOUND',
  SERVICE_ORDER_INVALID_STATUS = 'SERVICE_ORDER_INVALID_STATUS',
  FINANCIAL_TERMS_ALREADY_CONFIRMED = 'FINANCIAL_TERMS_ALREADY_CONFIRMED',
  EVENT_REQUIRES_ASSISTED_PRODUCTION = 'EVENT_REQUIRES_ASSISTED_PRODUCTION',
}

/**
 * Mensagens de erro padronizadas
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // 400
  BAD_REQUEST: 'Requisição inválida',
  VALIDATION_ERROR: 'Erro de validação',
  MISSING_TENANT: 'Tenant ID é obrigatório',
  MISSING_ACTOR: 'Actor ID é obrigatório',
  INVALID_INPUT: 'Dados de entrada inválidos',
  
  // 401
  UNAUTHORIZED: 'Não autorizado',
  INVALID_TOKEN: 'Token inválido',
  TOKEN_EXPIRED: 'Token expirado',
  
  // 403
  FORBIDDEN: 'Acesso negado',
  PERMISSION_DENIED: 'Você não tem permissão para executar esta ação',
  INSUFFICIENT_ROLE: 'Role insuficiente para executar esta ação',
  
  // 404
  NOT_FOUND: 'Recurso não encontrado',
  RESOURCE_NOT_FOUND: 'Recurso não encontrado',
  
  // 409
  CONFLICT: 'Conflito',
  DUPLICATE_RESOURCE: 'Recurso duplicado',
  ALREADY_EXISTS: 'Recurso já existe',
  
  // 429
  RATE_LIMIT_EXCEEDED: 'Limite de requisições excedido',
  
  // 500
  INTERNAL_ERROR: 'Erro interno do servidor',
  DATABASE_ERROR: 'Erro no banco de dados',
  EXTERNAL_SERVICE_ERROR: 'Erro em serviço externo',
  
  // Domínio
  BOOKING_NOT_FOUND: 'Booking não encontrado',
  BOOKING_ALREADY_DECIDED: 'Booking já possui decisão',
  RFQ_NOT_FOUND: 'RFQ não encontrado',
  RFQ_CLOSED: 'RFQ está fechado',
  SERVICE_ORDER_NOT_FOUND: 'Ordem de serviço não encontrada',
  SERVICE_ORDER_INVALID_STATUS: 'Status inválido para esta operação',
  FINANCIAL_TERMS_ALREADY_CONFIRMED: 'Termos financeiros já foram confirmados',
  EVENT_REQUIRES_ASSISTED_PRODUCTION: 'Este evento exige produção assistida. Não é possível realizar booking direto.',
};

