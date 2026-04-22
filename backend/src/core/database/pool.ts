// backend/src/core/database/pool.ts

import { Pool, PoolClient } from 'pg';
import { loadBackendEnv } from '../db/load-backend-env';

loadBackendEnv();

/**
 * Extrai informações da DATABASE_URL sem expor senha
 */
function parseDatabaseUrl(url: string | undefined): { host: string; port: number; database: string; user: string; masked: string } | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '5432', 10),
      database: urlObj.pathname.substring(1), // Remove leading /
      user: urlObj.username,
      masked: `${urlObj.protocol}//${urlObj.username}:***@${urlObj.hostname}:${urlObj.port || '5432'}${urlObj.pathname}`,
    };
  } catch {
    return null;
  }
}

/**
 * Loga informações de conexão do banco (sem senha)
 */
export function logDatabaseConnectionInfo(): void {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL não está definida no ambiente!');
    return;
  }
  
  const parsed = parseDatabaseUrl(dbUrl);
  
  if (parsed) {
    console.log('🔍 INFORMAÇÕES DE CONEXÃO DO BANCO:');
    console.log(`   Host: ${parsed.host}`);
    console.log(`   Porta: ${parsed.port}`);
    console.log(`   Database: ${parsed.database}`);
    console.log(`   User: ${parsed.user}`);
    console.log(`   URL (mascarada): ${parsed.masked}`);
  } else {
    console.warn('⚠️ DATABASE_URL não pôde ser parseada. URL completa:', dbUrl.replace(/:[^:@]+@/, ':****@'));
  }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: Number(process.env.DATABASE_POOL_MIN || 2),
  max: Number(process.env.DATABASE_POOL_MAX || 10),
});

// 🔴 Configurar encoding UTF-8 e search_path para todas as conexões
pool.on('connect', async (client) => {
  try {
    // Garantir que o client está usando UTF-8
    await client.query("SET client_encoding = 'UTF8'");
    // 🔴 ADR: Garantir que search_path está configurado para public (schema padrão)
    await client.query("SET search_path = 'public'");
  } catch (err) {
    console.warn('⚠️ Erro ao configurar encoding UTF-8 ou search_path:', err);
  }
});

// Logar informações de conexão ao carregar o módulo
logDatabaseConnectionInfo();

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém informações do banco atual (host, porta, database, schema)
 * Útil para diagnóstico de problemas de ambiente
 */
export async function getDatabaseInfo(): Promise<{
  host: string;
  port: number;
  database: string;
  currentSchema: string;
  currentUser: string;
  connectionCount: number;
} | null> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query<{
        current_database: string;
        current_user: string;
        current_schema: string;
        inet_server_addr: string | null;
        inet_server_port: number | null;
      }>(`
        SELECT 
          current_database() as current_database,
          current_user as current_user,
          current_schema() as current_schema,
          inet_server_addr() as inet_server_addr,
          inet_server_port() as inet_server_port
      `);
      
      const row = result.rows[0];
      const poolInfo = pool.totalCount;
      
      return {
        host: row.inet_server_addr || 'localhost',
        port: row.inet_server_port || 5432,
        database: row.current_database,
        currentSchema: row.current_schema,
        currentUser: row.current_user,
        connectionCount: poolInfo,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao obter informações do banco:', error);
    return null;
  }
}

// Secure tenant injection
export async function getClientWithTenant(tenantId: string): Promise<PoolClient> {
  const client = await pool.connect();
  try {
    // PostgreSQL não aceita bind parameters em SET, usar set_config
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

/**
 * Executa query que retorna UMA ÚNICA ROW com tenant context
 * Retorna undefined se não encontrar nada
 */
/**
 * Sanitiza valores undefined em arrays de parâmetros SQL
 * Converte undefined para null (que é aceito pelo PostgreSQL)
 * 
 * REGRA DE GOVERNANÇA:
 * - sanitizeParams(undefined->null) é seguro para PostgreSQL
 * - NO ENTANTO: novas queries com filtros opcionais precisam tratar NULL corretamente no SQL
 * - Exemplo: WHERE x = $1 precisa ser WHERE ($1 IS NULL OR x = $1) se $1 pode ser NULL
 * - Sempre revisar impacto semântico em WHERE, intervalos, filtros condicionais
 * - Evitar "dado zerado" silenciosamente (NULL pode alterar resultado da query)
 */
function sanitizeParams(params: any[]): any[] {
  return params.map((param) => (param === undefined ? null : param));
}

export async function runQueryWithTenant<T>(
  tenantId: string,
  query: string | { text: string; values?: any[] },
  params?: any[]
): Promise<T | undefined> {
  const client = await pool.connect();
  try {
    // PostgreSQL não aceita bind parameters em SET, usar set_config
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);

    const text = typeof query === 'string' ? query : query.text;
    const values = typeof query === 'string' ? (params || []) : (query.values || []);

    // Garantir que values é sempre um array
    if (!Array.isArray(values)) {
      throw new Error(`Query values must be an array, got: ${typeof values}`);
    }

    // Sanitizar valores undefined para null
    const sanitizedValues = sanitizeParams(values);

    const result = await client.query(text, sanitizedValues);
    return result.rows[0] as T | undefined;
  } catch (err) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const logData: any = {
      tenantId,
      query: typeof query === 'string' ? query : query.text,
      error: err instanceof Error ? err.message : String(err),
    };
    
    // Em produção, não logar values (podem conter dados sensíveis)
    if (isDevelopment) {
      logData.values = typeof query === 'string' ? params : query.values;
    } else {
      logData.values = '[REDACTED - production mode]';
    }
    
    console.error('❌ Database query error:', logData);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Executa query que retorna MÚLTIPLAS ROWS com tenant context
 * Use esta função quando esperar array de resultados
 */
export async function runQueriesWithTenant<T>(
  tenantId: string,
  query: string | { text: string; values?: any[] },
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    // PostgreSQL não aceita bind parameters em SET, usar set_config
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);

    const text = typeof query === 'string' ? query : query.text;
    const values = typeof query === 'string' ? (params || []) : (query.values || []);

    // Garantir que values é sempre um array
    if (!Array.isArray(values)) {
      throw new Error(`Query values must be an array, got: ${typeof values}`);
    }

    // Sanitizar valores undefined para null
    const sanitizedValues = sanitizeParams(values);

    const result = await client.query(text, sanitizedValues);
    return result.rows as T[];
  } catch (err) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const logData: any = {
      tenantId,
      query: typeof query === 'string' ? query : query.text,
      error: err instanceof Error ? err.message : String(err),
    };
    
    // Em produção, não logar values (podem conter dados sensíveis)
    if (isDevelopment) {
      logData.values = typeof query === 'string' ? params : query.values;
    } else {
      logData.values = '[REDACTED - production mode]';
    }
    
    console.error('❌ Database query error (multiple rows):', logData);
    throw err;
  } finally {
    client.release();
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  console.log('🛑 Closing DB pool...');
  await pool.end();
  console.log('✔ DB pool closed.');
}