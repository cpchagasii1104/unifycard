#!/usr/bin/env ts-node
"use strict";
/**
 * Script para testar persistência de dados após simular logout/login
 * Verifica se os dados salvos em profiles persistem
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../core/database/pool");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function testProfilePersistence(tenantId, userId) {
    console.log('='.repeat(80));
    console.log('🧪 TESTE DE PERSISTÊNCIA: Verificando dados após "logout/login"');
    console.log('='.repeat(80));
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`User ID: ${userId}`);
    console.log('');
    const client = await pool_1.pool.connect();
    try {
        // Simular o que o GET /core/profile faz
        // 1. Buscar profile de profiles
        const profileResult = await client.query(`
      SELECT 
        profile_id,
        full_name,
        phone,
        metadata,
        updated_at
      FROM profiles
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `, [tenantId, userId]);
        if (profileResult.rows.length === 0) {
            console.log('❌ NENHUM registro encontrado em profiles');
            console.log('   Isso indica que o perfil não existe ou não foi criado.');
            return;
        }
        const profile = profileResult.rows[0];
        console.log('📊 DADOS ENCONTRADOS EM PROFILES:');
        console.log(`   Profile ID: ${profile.profile_id}`);
        console.log(`   Full Name: ${profile.full_name || '(null)'}`);
        console.log(`   Phone: ${profile.phone || '(null)'}`);
        console.log(`   Updated At: ${profile.updated_at}`);
        console.log(`   Metadata keys: ${Object.keys(profile.metadata || {}).join(', ') || '(vazio)'}`);
        if (profile.metadata?.address) {
            console.log(`   Address (metadata):`);
            console.log(`     CEP: ${profile.metadata.address.cep || '(null)'}`);
            console.log(`     Street/Address: ${profile.metadata.address.street || profile.metadata.address.address || '(null)'}`);
            console.log(`     Number: ${profile.metadata.address.number || profile.metadata.address.address_number || '(null)'}`);
            console.log(`     City: ${profile.metadata.address.city || '(null)'}`);
            console.log(`     State: ${profile.metadata.address.state || '(null)'}`);
        }
        console.log('');
        console.log('='.repeat(80));
        console.log('🔍 SIMULAÇÃO DO GET /core/profile:');
        console.log('='.repeat(80));
        // Simular o que coreService.getCompleteProfile faz
        const personalProfile = {
            fullName: profile.full_name ?? null,
            phone: profile.phone ?? null,
            metadata: profile.metadata || {},
        };
        console.log('Dados que seriam retornados em personal_profile:');
        console.log(`   fullName: ${personalProfile.fullName || '(null)'}`);
        console.log(`   phone: ${personalProfile.phone || '(null)'}`);
        console.log(`   metadata keys: ${Object.keys(personalProfile.metadata).join(', ') || '(vazio)'}`);
        console.log('');
        // Verificar se há dados válidos
        if (personalProfile.fullName) {
            console.log('✅ RESULTADO: DADOS APARECEM');
            console.log(`   fullName encontrado: "${personalProfile.fullName}"`);
            console.log('   O backend retornaria este valor em GET /core/profile');
        }
        else {
            console.log('❌ RESULTADO: DADOS NÃO APARECEM');
            console.log('   fullName é null ou vazio');
            console.log('   O backend retornaria null em GET /core/profile');
        }
        if (Object.keys(personalProfile.metadata).length > 0) {
            console.log(`✅ Metadata encontrado com ${Object.keys(personalProfile.metadata).length} chave(s)`);
        }
        else {
            console.log('⚠️  Metadata vazio');
        }
    }
    catch (error) {
        console.error('❌ Erro ao executar teste:', error);
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
    console.error('  ts-node backend/src/scripts/test-profile-persistence.ts <tenant_id> <user_id>');
    console.error('');
    console.error('Exemplo:');
    console.error('  ts-node backend/src/scripts/test-profile-persistence.ts "fbe13b78-4516-493d-905a-363796aea1d1" "fc0ca84c-6c2d-41c3-8204-cd39fc7f0bef"');
    process.exit(1);
}
testProfilePersistence(tenantId, userId).catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=test-profile-persistence.js.map