// backend/src/core/database/transaction.helper.ts
// Helper para transações atômicas
// 🔴 BLINDAGEM: Garantir atomicidade onde necessário

import { getClientWithTenant } from './pool';

/**
 * Executa função dentro de uma transação
 * 
 * @param tenantId - ID do tenant
 * @param fn - Função a executar dentro da transação
 * @returns Resultado da função
 */
export async function withTransaction<T>(
  tenantId: string,
  fn: (client: any) => Promise<T>
): Promise<T> {
  const client = await getClientWithTenant(tenantId);
  
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}




