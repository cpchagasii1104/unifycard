import type { QueryResultRow } from 'pg';
export interface QueryConfig {
    text: string;
    values?: any[];
}
/**
 * Executa queries que NÃO dependem de tenant.
 * Envia direto para o banco sem SET LOCAL.
 *
 * Exemplos:
 *  - leitura de tenants
 *  - autenticação
 *  - consultas de sistema
 */
export declare function runSystemQuery<T extends QueryResultRow = any>(query: QueryConfig): Promise<T[]>;
/**
 * Executa queries protegidas por RLS, definindo o tenant no contexto.
 *
 * IMPORTANTE:
 *  - Só use isso para tabelas multi-tenant
 *  - Nunca chame em tabelas de sistema
 */
export declare function runQueryWithTenant<T extends QueryResultRow = any>(tenantId: string, query: QueryConfig): Promise<T | undefined>;
export declare function runQueriesWithTenant<T extends QueryResultRow = any>(tenantId: string, query: QueryConfig): Promise<T[]>;
/**
 * Inicia uma transação isolada COM suporte a multi-tenant.
 *
 * Exemplo de uso:
 *
 * const result = await runTenantTransaction(tenantId, async (trx) => {
 *    await trx.query({ text: "UPDATE accounts SET balance = balance - 10 WHERE id=$1", values: [accA] });
 *    await trx.query({ text: "UPDATE accounts SET balance = balance + 10 WHERE id=$1", values: [accB] });
 *    return true;
 * });
 */
export declare function runTenantTransaction<T = any>(tenantId: string, fn: (trx: {
    query: (q: QueryConfig) => Promise<any>;
}) => Promise<T>): Promise<T>;
/**
 * Transação de sistema — sem tenant.
 */
export declare function runSystemTransaction<T = any>(fn: (trx: {
    query: (q: QueryConfig) => Promise<any>;
}) => Promise<T>): Promise<T>;
declare const db: {
    runSystemQuery: typeof runSystemQuery;
    runQueryWithTenant: typeof runQueryWithTenant;
    runQueriesWithTenant: typeof runQueriesWithTenant;
    runTenantTransaction: typeof runTenantTransaction;
    runSystemTransaction: typeof runSystemTransaction;
};
export default db;
//# sourceMappingURL=db.d.ts.map