#!/usr/bin/env ts-node
"use strict";
/**
 * Script para verificar registros duplicados na tabela profiles
 *
 * Uso:
 *   ts-node backend/src/scripts/check-profile-records.ts <tenant_id> <user_id>
 *
 * Exemplo:
 *   ts-node backend/src/scripts/check-profile-records.ts "123e4567-e89b-12d3-a456-426614174000" "789e4567-e89b-12d3-a456-426614174001"
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../core/database/pool");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function checkProfileRecords(tenantId, userId) {
    console.log('='.repeat(80));
    console.log('🔬 TESTE OBRIGATÓRIO: Verificar registros em profiles');
    console.log('='.repeat(80));
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`User ID: ${userId}`);
    console.log('');
    const client = await pool_1.pool.connect();
    try {
        // Query exata solicitada
        const result = await client.query(`
      SELECT
        profile_id,
        tenant_id,
        user_id,
        created_at,
        updated_at
      FROM profiles
      WHERE tenant_id = $1
        AND user_id = $2
      ORDER BY updated_at DESC
      `, [tenantId, userId]);
        console.log(`📊 RESULTADO: ${result.rows.length} registro(s) encontrado(s)`);
        console.log('');
        if (result.rows.length === 0) {
            console.log('⚠️  NENHUM registro encontrado para este tenant_id + user_id');
            console.log('');
            console.log('Isso pode indicar:');
            console.log('  - O perfil nunca foi criado');
            console.log('  - Os IDs estão incorretos');
            console.log('  - Problema de isolamento multi-tenant (RLS bloqueando)');
        }
        else if (result.rows.length === 1) {
            console.log('✅ APENAS UM registro encontrado (CORRETO)');
            console.log('');
            const row = result.rows[0];
            console.log('Dados do registro:');
            console.log(`  Profile ID: ${row.profile_id}`);
            console.log(`  Tenant ID: ${row.tenant_id}`);
            console.log(`  User ID: ${row.user_id}`);
            console.log(`  Created At: ${row.created_at}`);
            console.log(`  Updated At: ${row.updated_at}`);
        }
        else {
            console.log('❌ MÚLTIPLOS registros encontrados (PROBLEMA CRÍTICO!)');
            console.log('');
            console.log(`Total: ${result.rows.length} registros`);
            console.log('');
            console.log('Detalhes de cada registro:');
            result.rows.forEach((row, index) => {
                console.log(`\n  Registro #${index + 1}:`);
                console.log(`    Profile ID: ${row.profile_id}`);
                console.log(`    Tenant ID: ${row.tenant_id}`);
                console.log(`    User ID: ${row.user_id}`);
                console.log(`    Created At: ${row.created_at}`);
                console.log(`    Updated At: ${row.updated_at}`);
            });
            console.log('');
            console.log('🔴 PROBLEMA IDENTIFICADO:');
            console.log('  - Existem múltiplos registros para o mesmo tenant_id + user_id');
            console.log('  - Isso viola a constraint UNIQUE(tenant_id, user_id)');
            console.log('  - O GET pode retornar qualquer um deles (comportamento não determinístico)');
            console.log('  - O UPDATE pode atualizar o registro errado');
            console.log('');
            console.log('💡 SOLUÇÃO:');
            console.log('  - Manter apenas o registro mais recente (updated_at DESC)');
            console.log('  - Deletar os registros antigos');
            console.log('  - Verificar por que múltiplos registros foram criados');
        }
        // Verificar também metadata para ver se há diferenças
        if (result.rows.length > 1) {
            console.log('');
            console.log('📋 Verificando metadata de cada registro:');
            const metadataResults = await client.query(`
        SELECT profile_id, metadata, full_name, phone
        FROM profiles
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        `, [tenantId, userId]);
            metadataResults.rows.forEach((row, index) => {
                console.log(`\n  Registro #${index + 1} (${row.profile_id}):`);
                console.log(`    Full Name: ${row.full_name || '(null)'}`);
                console.log(`    Phone: ${row.phone || '(null)'}`);
                console.log(`    Metadata keys: ${Object.keys(row.metadata || {}).join(', ') || '(vazio)'}`);
                if (row.metadata?.address) {
                    console.log(`    Address: ${JSON.stringify(row.metadata.address)}`);
                }
            });
        }
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
// Obter argumentos da linha de comando
const tenantId = process.argv[2];
const userId = process.argv[3];
if (!tenantId || !userId) {
    console.error('❌ Uso incorreto!');
    console.error('');
    console.error('Uso:');
    console.error('  ts-node backend/src/scripts/check-profile-records.ts <tenant_id> <user_id>');
    console.error('');
    console.error('Exemplo:');
    console.error('  ts-node backend/src/scripts/check-profile-records.ts "123e4567-e89b-12d3-a456-426614174000" "789e4567-e89b-12d3-a456-426614174001"');
    process.exit(1);
}
checkProfileRecords(tenantId, userId).catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=check-profile-records.js.map