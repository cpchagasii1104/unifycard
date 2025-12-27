#!/usr/bin/env ts-node
/**
 * Script para verificar se endereço está salvo no metadata do profile
 * 
 * Uso:
 *   ts-node backend/src/scripts/check-profile-address.ts <tenant_id> <user_id>
 */

import { pool } from '../core/database/pool';
import dotenv from 'dotenv';

dotenv.config();

async function checkProfileAddress(tenantId: string, userId: string) {
  console.log('='.repeat(80));
  console.log('🔬 VERIFICANDO ENDEREÇO NO METADATA DO PROFILE');
  console.log('='.repeat(80));
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`User ID: ${userId}`);
  console.log('');

  const client = await pool.connect();
  
  try {
    // Buscar profile com metadata completo
    const result = await client.query<{
      profile_id: string;
      full_name: string | null;
      phone: string | null;
      metadata: any;
      updated_at: Date;
    }>(
      `
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
      `,
      [tenantId, userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ NENHUM profile encontrado para este tenant_id + user_id');
      return;
    }

    const profile = result.rows[0];
    
    console.log('📊 DADOS DO PROFILE:');
    console.log(`   Profile ID: ${profile.profile_id}`);
    console.log(`   Full Name: ${profile.full_name || '(null)'}`);
    console.log(`   Phone: ${profile.phone || '(null)'}`);
    console.log(`   Updated At: ${profile.updated_at}`);
    console.log('');
    
    console.log('📋 METADATA COMPLETO:');
    console.log(JSON.stringify(profile.metadata, null, 2));
    console.log('');
    
    // Verificar se há address no metadata
    const metadata = profile.metadata || {};
    const address = metadata.address;
    
    if (address) {
      console.log('✅ ENDEREÇO ENCONTRADO EM METADATA:');
      console.log(`   CEP: ${address.cep || '(null)'}`);
      console.log(`   Street/Address: ${address.street || address.address || '(null)'}`);
      console.log(`   Number: ${address.number || address.address_number || '(null)'}`);
      console.log(`   Complement: ${address.complement || '(null)'}`);
      console.log(`   Neighborhood: ${address.neighborhood || '(null)'}`);
      console.log(`   City: ${address.city || '(null)'}`);
      console.log(`   State: ${address.state || '(null)'}`);
      console.log('');
      console.log('🔍 ESTRUTURA COMPLETA DO ADDRESS:');
      console.log(JSON.stringify(address, null, 2));
      console.log('');
      
      // Verificar o que o core.service.ts retornaria
      const simulatedAddress = {
        address_id: 'metadata',
        cep: address.cep || null,
        address: address.address || address.street || null,
        address_number: address.address_number || address.number || null,
        complement: address.complement || null,
        neighborhood: address.neighborhood || null,
        city: address.city || null,
        state: address.state || null,
        country: address.country || 'BR',
        is_primary: true,
      };
      
      console.log('📦 O QUE SERIA RETORNADO POR GET /core/profile:');
      console.log(JSON.stringify(simulatedAddress, null, 2));
      console.log('');
      
      // Verificar se todos os campos essenciais estão preenchidos
      const hasEssentialFields = 
        (simulatedAddress.address || simulatedAddress.cep) &&
        simulatedAddress.city &&
        simulatedAddress.state;
      
      if (hasEssentialFields) {
        console.log('✅ ENDEREÇO VÁLIDO - Deveria aparecer em GET /core/profile');
      } else {
        console.log('⚠️  ENDEREÇO INCOMPLETO - Pode não aparecer corretamente');
      }
      
    } else {
      console.log('❌ NENHUM endereço encontrado em metadata.address');
      console.log('');
      console.log('📋 Chaves disponíveis no metadata:');
      console.log(Object.keys(metadata));
      console.log('');
      console.log('⚠️  Isso indica que:');
      console.log('   - O endereço não foi salvo no metadata');
      console.log('   - Ou está sendo salvo em outra estrutura');
      console.log('   - Ou foi perdido durante o merge');
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
  console.error('  ts-node backend/src/scripts/check-profile-address.ts <tenant_id> <user_id>');
  console.error('');
  console.error('Exemplo:');
  console.error('  ts-node backend/src/scripts/check-profile-address.ts "fbe13b78-4516-493d-905a-363796aea1d1" "fc0ca84c-6c2d-41c3-8204-cd39fc7f0bef"');
  process.exit(1);
}

checkProfileAddress(tenantId, userId).catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});












