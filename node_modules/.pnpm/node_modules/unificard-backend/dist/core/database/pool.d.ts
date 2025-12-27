import { Pool, PoolClient } from 'pg';
/**
 * Loga informações de conexão do banco (sem senha)
 */
export declare function logDatabaseConnectionInfo(): void;
export declare const pool: Pool;
export declare function checkDatabaseHealth(): Promise<boolean>;
/**
 * Obtém informações do banco atual (host, porta, database, schema)
 * Útil para diagnóstico de problemas de ambiente
 */
export declare function getDatabaseInfo(): Promise<{
    host: string;
    port: number;
    database: string;
    currentSchema: string;
    currentUser: string;
    connectionCount: number;
} | null>;
export declare function getClientWithTenant(tenantId: string): Promise<PoolClient>;
export declare function runQueryWithTenant<T>(tenantId: string, query: string | {
    text: string;
    values?: any[];
}, params?: any[]): Promise<T | undefined>;
/**
 * Executa query que retorna MÚLTIPLAS ROWS com tenant context
 * Use esta função quando esperar array de resultados
 */
export declare function runQueriesWithTenant<T>(tenantId: string, query: string | {
    text: string;
    values?: any[];
}, params?: any[]): Promise<T[]>;
export declare function closePool(): Promise<void>;
//# sourceMappingURL=pool.d.ts.map