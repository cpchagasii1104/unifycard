// src/core/database/schema-validator.ts
//
// Validação de schema do banco de dados usando information_schema
// NÃO depende de histórico de migrations - valida apenas o schema real

import { pool } from './pool';

/**
 * Cache para validações de colunas (evita múltiplas consultas)
 */
const columnCache = new Map<string, boolean>();

/**
 * Verifica se uma coluna existe em uma tabela usando information_schema
 * 
 * @param tableName Nome da tabela
 * @param columnName Nome da coluna
 * @param schema Schema do banco (padrão: 'public')
 * @returns true se a coluna existe, false caso contrário
 */
export async function columnExists(
  tableName: string,
  columnName: string,
  schema: string = 'public'
): Promise<boolean> {
  const cacheKey = `${schema}.${tableName}.${columnName}`;
  
  // Verificar cache
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey)!;
  }

  try {
    const result = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = $1 
          AND table_name = $2 
          AND column_name = $3
      ) as exists
      `,
      [schema, tableName, columnName]
    );

    const exists = result.rows[0]?.exists || false;
    
    // Cachear resultado
    columnCache.set(cacheKey, exists);
    
    return exists;
  } catch (error) {
    // 🔴 Antes: return false — ou seja, "a coluna nao existe". Falso: o que houve foi NAO
    // CONSEGUIR OLHAR. Um probe de schema que responde "nao existe" quando falha faz o chamador
    // desligar funcionalidade por engano, e como o erro nem entra no cache, some a cada chamada.
    console.error(`Erro ao verificar coluna ${schema}.${tableName}.${columnName}:`, error);
    throw error;
  }
}

/**
 * Valida se a coluna users.token_version existe
 * Usado para verificar se o schema está atualizado para suportar invalidação de tokens
 * 
 * @returns true se a coluna existe, false caso contrário
 */
export async function hasTokenVersionColumn(): Promise<boolean> {
  return columnExists('users', 'token_version');
}

/**
 * Limpa o cache de validações de colunas
 * Útil após migrations ou alterações de schema
 */
export function clearColumnCache(): void {
  columnCache.clear();
}















