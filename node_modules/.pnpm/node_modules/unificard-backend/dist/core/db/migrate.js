"use strict";
// src/core/db/migrate.ts
//
// Script de migração automático que aplica todos os arquivos SQL
// do diretório migrations/ em ordem alfabética.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const promises_1 = require("fs/promises");
const path_1 = require("path");
const pg_1 = require("pg");
// Carrega variáveis de ambiente ANTES de criar o pool
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
// Cria pool diretamente aqui para garantir que dotenv foi carregado
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    min: Number(process.env.DATABASE_POOL_MIN || 2),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
});
// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
    console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
    console.error('   Por favor, defina DATABASE_URL no arquivo .env na raiz do projeto');
    process.exit(1);
}
const MIGRATIONS_DIR = (0, path_1.join)(process.cwd(), 'migrations');
/**
 * Lê o diretório de migrações e retorna arquivos .sql ordenados
 */
async function getMigrationFiles() {
    const files = await (0, promises_1.readdir)(MIGRATIONS_DIR);
    const sqlFiles = files
        .filter((file) => file.endsWith('.sql'))
        .map((file) => ({
        filename: file,
        path: (0, path_1.join)(MIGRATIONS_DIR, file),
    }))
        .sort((a, b) => a.filename.localeCompare(b.filename));
    return sqlFiles;
}
/**
 * Executa um arquivo SQL de migração
 */
async function executeMigration(migration) {
    console.log(`📦 Executando migração: ${migration.filename}`);
    const sql = await (0, promises_1.readFile)(migration.path, 'utf-8');
    if (!sql.trim()) {
        console.log(`⚠️  Arquivo vazio, pulando: ${migration.filename}`);
        return;
    }
    const client = await pool.connect();
    try {
        // Executa o SQL completo
        await client.query(sql);
        console.log(`✅ Migração concluída: ${migration.filename}`);
    }
    catch (error) {
        console.error(`❌ Erro ao executar migração ${migration.filename}:`);
        console.error(error);
        throw new Error(`Falha na migração ${migration.filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        client.release();
    }
}
/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando processo de migração...\n');
    // Verificar modo observação
    if (process.env.OBSERVATION_MODE === 'true') {
        console.error('❌ OBSERVATION MODE ATIVO: Migrações automáticas estão bloqueadas.');
        console.error('   Nenhuma feature estrutural deve ser adicionada.');
        console.error('   Para executar migrações, desative OBSERVATION_MODE no .env');
        process.exit(1);
    }
    try {
        // Verifica conexão com o banco
        const testClient = await pool.connect();
        try {
            await testClient.query('SELECT 1');
            console.log('✔ Conexão com banco de dados estabelecida\n');
        }
        finally {
            testClient.release();
        }
        // Obtém lista de migrações
        const migrations = await getMigrationFiles();
        if (migrations.length === 0) {
            console.log('⚠️  Nenhum arquivo de migração encontrado em migrations/');
            process.exit(0);
        }
        console.log(`📋 Encontradas ${migrations.length} migração(ões) para executar:\n`);
        migrations.forEach((m, index) => {
            console.log(`  ${index + 1}. ${m.filename}`);
        });
        console.log('');
        // Executa cada migração em ordem
        for (let i = 0; i < migrations.length; i++) {
            const migration = migrations[i];
            console.log(`[${i + 1}/${migrations.length}]`);
            await executeMigration(migration);
            console.log('');
        }
        console.log('✨ Todas as migrações foram aplicadas com sucesso!');
        process.exit(0);
    }
    catch (error) {
        console.error('\n💥 Erro fatal durante a migração:');
        console.error(error);
        process.exit(1);
    }
    finally {
        // Fecha o pool de conexões
        await pool.end();
    }
}
// Executa o script
main().catch((error) => {
    console.error('Erro não tratado:', error);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map