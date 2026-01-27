"use strict";
// src/scripts/run-single-migration.ts
// Script para executar uma migration específica diretamente
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const promises_1 = require("fs/promises");
const path_1 = require("path");
const pg_1 = require("pg");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
async function runMigration(filename) {
    const migrationPath = (0, path_1.join)(process.cwd(), 'migrations', filename);
    console.log(`📦 Executando migração: ${filename}`);
    const sql = await (0, promises_1.readFile)(migrationPath, 'utf-8');
    const client = await pool.connect();
    try {
        await client.query(sql);
        console.log(`✅ Migração concluída: ${filename}`);
    }
    catch (error) {
        console.error(`❌ Erro ao executar migração ${filename}:`);
        console.error(error);
        throw error;
    }
    finally {
        client.release();
    }
}
async function main() {
    const migrationFile = process.argv[2];
    if (!migrationFile) {
        console.error('❌ Uso: ts-node run-single-migration.ts <nome-do-arquivo.sql>');
        console.error('   Exemplo: ts-node run-single-migration.ts 073_company_status_and_documents.sql');
        process.exit(1);
    }
    try {
        await runMigration(migrationFile);
        console.log('✨ Migração aplicada com sucesso!');
    }
    catch (error) {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
main();
