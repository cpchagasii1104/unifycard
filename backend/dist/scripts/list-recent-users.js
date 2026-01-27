#!/usr/bin/env ts-node
"use strict";
/**
 * Script auxiliar para listar usuários recentes e facilitar a execução do teste
 *
 * Uso:
 *   ts-node backend/src/scripts/list-recent-users.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../core/database/pool");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function listRecentUsers() {
    console.log('='.repeat(80));
    console.log('📋 Listando usuários recentes (últimos 10)');
    console.log('='.repeat(80));
    console.log('');
    const client = await pool_1.pool.connect();
    try {
        const result = await client.query(`
      SELECT 
        u.tenant_id,
        u.user_id,
        u.email,
        u.created_at,
        t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.tenant_id
      ORDER BY u.created_at DESC
      LIMIT 10
      `);
        if (result.rows.length === 0) {
            console.log('⚠️  Nenhum usuário encontrado no banco');
            return;
        }
        console.log(`Encontrados ${result.rows.length} usuário(s) recente(s):\n`);
        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. Email: ${row.email}`);
            console.log(`   Tenant: ${row.tenant_name || '(sem nome)'} (${row.tenant_id})`);
            console.log(`   User ID: ${row.user_id}`);
            console.log(`   Criado em: ${row.created_at}`);
            console.log('');
        });
        console.log('='.repeat(80));
        console.log('💡 Para verificar os registros de profile de um usuário, execute:');
        console.log('');
        if (result.rows.length > 0) {
            const firstUser = result.rows[0];
            console.log(`   ts-node backend/src/scripts/check-profile-records.ts "${firstUser.tenant_id}" "${firstUser.user_id}"`);
        }
        console.log('');
    }
    catch (error) {
        console.error('❌ Erro ao executar query:', error);
        if (error instanceof Error) {
            console.error('Mensagem:', error.message);
            console.error('Stack:', error.stack);
        }
        process.exit(1);
    }
    finally {
        client.release();
        await pool_1.pool.end();
    }
}
listRecentUsers().catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
