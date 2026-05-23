#!/usr/bin/env ts-node
/**
 * Script para verificar registros duplicados na tabela profiles
 * 
 * Uso:
 *   ts-node backend/src/scripts/check-profile-records.ts <tenant_id> <user_id>
 * 
 * Exemplo:
 *   ts-node backend/src/scripts/check-profile-records.ts "123e4567-e89b-12d3-a456-426614174000" "789e4567-e89b-12d3-a456-426614174001"
 */

import { pool } from '../core/database/pool';
import dotenv from 'dotenv';

dotenv.config();

type ProfileRecordRow = {
  profile_id: string;
  tenant_id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
};

type ProfileMetadataRow = {
  profile_id: string;
  metadata: any;
  full_name: string | null;
  phone: string | null;
};

type ProfileRecord = {
  profileId: string;
  tenantId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProfileMetadataRecord = {
  profileId: string;
  metadata: any;
  fullName: string | null;
  phone: string | null;
};

// boundary: DB -> domain mapping
function mapProfileRecordRowToDomain(row: ProfileRecordRow): ProfileRecord {
  return {
    profileId: row.profile_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfileMetadataRowToDomain(row: ProfileMetadataRow): ProfileMetadataRecord {
  return {
    profileId: row.profile_id,
    metadata: row.metadata,
    fullName: row.full_name,
    phone: row.phone,
  };
}

async function checkProfileRecords(tenantId: string, userId: string) {
  console.log('='.repeat(80));
  console.log('🔬 TESTE OBRIGATÓRIO: Verificar registros em profiles');
  console.log('='.repeat(80));
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`User ID: ${userId}`);
  console.log('');

  const client = await pool.connect();
  
  try {
    // Query exata solicitada
    const result = await client.query<ProfileRecordRow>(
      `
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
      `,
      [tenantId, userId]
    );
    const records = result.rows.map(mapProfileRecordRowToDomain);

    console.log(`📊 RESULTADO: ${records.length} registro(s) encontrado(s)`);
    console.log('');

    if (records.length === 0) {
      console.log('⚠️  NENHUM registro encontrado para este tenant_id + user_id');
      console.log('');
      console.log('Isso pode indicar:');
      console.log('  - O perfil nunca foi criado');
      console.log('  - Os IDs estão incorretos');
      console.log('  - Problema de isolamento multi-tenant (RLS bloqueando)');
    } else if (records.length === 1) {
      console.log('✅ APENAS UM registro encontrado (CORRETO)');
      console.log('');
      const record = records[0];
      console.log('Dados do registro:');
      console.log(`  Profile ID: ${record.profileId}`);
      console.log(`  Tenant ID: ${record.tenantId}`);
      console.log(`  User ID: ${record.userId}`);
      console.log(`  Created At: ${record.createdAt}`);
      console.log(`  Updated At: ${record.updatedAt}`);
    } else {
      console.log('❌ MÚLTIPLOS registros encontrados (PROBLEMA CRÍTICO!)');
      console.log('');
      console.log(`Total: ${records.length} registros`);
      console.log('');
      console.log('Detalhes de cada registro:');
      records.forEach((record, index) => {
        console.log(`\n  Registro #${index + 1}:`);
        console.log(`    Profile ID: ${record.profileId}`);
        console.log(`    Tenant ID: ${record.tenantId}`);
        console.log(`    User ID: ${record.userId}`);
        console.log(`    Created At: ${record.createdAt}`);
        console.log(`    Updated At: ${record.updatedAt}`);
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
    if (records.length > 1) {
      console.log('');
      console.log('📋 Verificando metadata de cada registro:');
      const metadataResults = await client.query<ProfileMetadataRow>(
        `
        SELECT profile_id, metadata, full_name, phone
        FROM profiles
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        `,
        [tenantId, userId]
      );
      const metadataRecords = metadataResults.rows.map(mapProfileMetadataRowToDomain);

      metadataRecords.forEach((record, index) => {
        console.log(`\n  Registro #${index + 1} (${record.profileId}):`);
        console.log(`    Full Name: ${record.fullName || '(null)'}`);
        console.log(`    Phone: ${record.phone || '(null)'}`);
        console.log(`    Metadata keys: ${Object.keys(record.metadata || {}).join(', ') || '(vazio)'}`);
        if (record.metadata?.address) {
          console.log(`    Address: ${JSON.stringify(record.metadata.address)}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Erro ao executar query:', error);
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
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

























