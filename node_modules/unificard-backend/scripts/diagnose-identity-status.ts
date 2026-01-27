// Script para diagnosticar identity_status do usuário
// Executa: npx tsx scripts/diagnose-identity-status.ts [tenant_id] [user_id]

import { pool } from '../src/core/database/pool';
import { getClientWithTenant } from '../src/core/database/pool';
import { identityService } from '../src/core/identity/identity.service';
import 'dotenv/config';

async function diagnoseIdentityStatus(tenantId?: string, userId?: string) {
  console.log('🔍 Diagnosticando identity_status do usuário...\n');

  try {
    // 1. Resolver tenant_id
    let finalTenantId: string;
    if (tenantId) {
      finalTenantId = tenantId;
      console.log(`📋 Usando tenant fornecido: ${finalTenantId}`);
    } else {
      const tenantResult = await pool.query<{ tenant_id: string; name: string }>(
        `SELECT tenant_id, name FROM tenants ORDER BY created_at ASC LIMIT 1`
      );
      
      if (!tenantResult.rows[0]) {
        throw new Error('Nenhum tenant encontrado.');
      }
      
      finalTenantId = tenantResult.rows[0].tenant_id;
      console.log(`📋 Usando primeiro tenant: ${tenantResult.rows[0].name} (${finalTenantId})`);
    }

    // 2. Resolver user_id
    let finalUserId: string;
    if (userId) {
      finalUserId = userId;
      console.log(`👤 Usando usuário fornecido: ${finalUserId}`);
    } else {
      const userResult = await pool.query<{ user_id: string; email: string }>(
        `SELECT user_id, email FROM users WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [finalTenantId]
      );
      
      if (!userResult.rows[0]) {
        throw new Error(`Nenhum usuário encontrado no tenant ${finalTenantId}.`);
      }
      
      finalUserId = userResult.rows[0].user_id;
      console.log(`👤 Usando primeiro usuário: ${userResult.rows[0].email} (${finalUserId})`);
    }

    const client = await getClientWithTenant(finalTenantId);

    try {
      // 3. Verificar perfil pessoal (profiles)
      console.log('\n1️⃣ Verificando perfil pessoal (profiles)...');
      const profileResult = await client.query<{
        full_name: string | null;
        phone: string | null;
        metadata: any;
      }>(
        `SELECT full_name, phone, metadata FROM profiles WHERE user_id = $1 LIMIT 1`,
        [finalUserId]
      );

      const profile = profileResult.rows[0];
      if (profile) {
        console.log(`   ✅ Perfil encontrado:`);
        console.log(`      - full_name: ${profile.full_name || '(null)'}`);
        console.log(`      - phone: ${profile.phone || '(null)'}`);
        console.log(`      - metadata: ${JSON.stringify(profile.metadata || {}, null, 8)}`);
        
        const hasFullName = !!(profile.full_name && profile.full_name.trim().length > 0);
        console.log(`      - hasFullName: ${hasFullName}`);
      } else {
        console.log(`   ⚠️  Perfil não encontrado em profiles`);
      }

      // 4. Verificar CPF (user_profiles)
      console.log('\n2️⃣ Verificando CPF (user_profiles)...');
      const cpfResult = await client.query<{ cpf: string | null }>(
        `SELECT cpf FROM user_profiles WHERE user_id = $1 LIMIT 1`,
        [finalUserId]
      );

      const cpf = cpfResult.rows[0]?.cpf;
      console.log(`   - CPF: ${cpf ? cpf.substring(0, 3) + '***' : '(null)'}`);
      const hasCpf = !!(cpf && cpf.trim().length > 0);
      console.log(`   - hasCpf: ${hasCpf}`);

      // 5. Verificar birthdate (global_users via identity)
      console.log('\n3️⃣ Verificando birthdate (global_users)...');
      try {
        const identityData = await identityService.getIdentityProfile(finalUserId, finalTenantId);
        const birthdate = identityData?.global?.birthdate;
        console.log(`   - birthdate: ${birthdate ? (birthdate instanceof Date ? birthdate.toISOString() : birthdate) : '(null)'}`);
        const hasBirthdate = !!birthdate;
        console.log(`   - hasBirthdate: ${hasBirthdate}`);
      } catch (err) {
        console.log(`   ⚠️  Erro ao buscar birthdate: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 6. Verificar gender (metadata)
      console.log('\n4️⃣ Verificando gender (metadata)...');
      const gender = profile?.metadata?.gender;
      console.log(`   - gender: ${gender || '(null)'}`);
      const hasGender = !!(gender && (gender === 'male' || gender === 'female'));
      console.log(`   - hasGender: ${hasGender}`);

      // 7. Calcular identity_status
      console.log('\n5️⃣ Cálculo de identity_status:');
      const hasFullNameCalc = !!(profile?.full_name && profile.full_name.trim().length > 0);
      const hasCpfCalc = !!(cpf && cpf.trim().length > 0);
      
      let hasBirthdateCalc = false;
      try {
        const identityDataCalc = await identityService.getIdentityProfile(finalUserId, finalTenantId);
        hasBirthdateCalc = !!(identityDataCalc?.global?.birthdate);
      } catch (err) {
        // Ignorar erro
      }
      
      const genderCalc = profile?.metadata?.gender;
      const hasGenderCalc = !!(genderCalc && (genderCalc === 'male' || genderCalc === 'female'));

      const identityStatus = (hasFullNameCalc && hasCpfCalc && hasBirthdateCalc && hasGenderCalc) 
        ? 'COMPLETE' 
        : 'INCOMPLETE';

      console.log(`   - hasFullName: ${hasFullNameCalc}`);
      console.log(`   - hasCpf: ${hasCpfCalc}`);
      console.log(`   - hasBirthdate: ${hasBirthdateCalc}`);
      console.log(`   - hasGender: ${hasGenderCalc}`);
      console.log(`   - identity_status: ${identityStatus}`);

      // 8. Verificar via CoreService
      console.log('\n6️⃣ Verificando via CoreService.getCompleteProfile...');
      const { coreService } = await import('../src/core/core.service');
      const completeProfile = await coreService.getCompleteProfile(finalTenantId, finalUserId);
      console.log(`   - identity_status (CoreService): ${completeProfile.identity_status}`);
      console.log(`   - fullName: ${completeProfile.personal_profile?.fullName || '(null)'}`);
      console.log(`   - cpf: ${completeProfile.personal_profile?.cpf ? completeProfile.personal_profile.cpf.substring(0, 3) + '***' : '(null)'}`);
      console.log(`   - metadata.gender: ${completeProfile.personal_profile?.metadata?.gender || '(null)'}`);

      // 9. Recomendações
      console.log('\n💡 Recomendações:');
      if (!hasFullNameCalc) {
        console.log('   ⚠️  Preencher full_name em profiles');
      }
      if (!hasCpfCalc) {
        console.log('   ⚠️  Preencher cpf em user_profiles');
      }
      if (!hasBirthdateCalc) {
        console.log('   ⚠️  Preencher birthdate em global_users (via identity)');
      }
      if (!hasGenderCalc) {
        console.log('   ⚠️  Preencher metadata.gender em profiles (deve ser "male" ou "female")');
      }

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Erro ao diagnosticar:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ler argumentos da linha de comando
const args = process.argv.slice(2);
const tenantId = args[0];
const userId = args[1];

diagnoseIdentityStatus(tenantId, userId)
  .then(() => {
    console.log('\n✅ Diagnóstico concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

