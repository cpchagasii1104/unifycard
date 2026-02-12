// backend/src/core/pagination/pagination.types.ts
// SPRINT 52: Tipos padronizados para paginação

/**
 * Opções de paginação (cursor-based ou offset-based)
 */
export interface PaginationOptions {
  /**
   * Limite de itens por página (padrão: 20, máximo: 100)
   */
  limit?: number;

  /**
   * Cursor para paginação cursor-based (opcional)
   * Se fornecido, retorna itens após este cursor
   */
  cursor?: string;

  /**
   * Offset para paginação offset-based (opcional)
   * Se fornecido, pula N itens
   */
  offset?: number;
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
  /**
   * Itens da página atual
   */
  items: T[];

  /**
   * Cursor para próxima página (se houver)
   */
  nextCursor?: string;

  /**
   * Indica se há mais páginas
   */
  hasMore: boolean;

  /**
   * Total de itens (se disponível, pode ser null para cursor-based)
   */
  totalCents: number;
}

/**
 * Normaliza opções de paginação
 */
export function normalizePaginationOptions(options?: PaginationOptions): {
  limit: number;
  cursor?: string;
  offset?: number;
} {
  const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
  return {
    limit,
    cursor: options?.cursor,
    offset: options?.offset,
  };
}








