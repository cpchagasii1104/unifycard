// Script de teste: Validar persistência de birthdate
// Execute: npx tsx backend/test-birthdate-persistence.ts

import { pool } from './src/core/database/pool.js';

async function testBirthdatePersistence() {
  console.log('\n🧪 TESTE: Persistência de Birthdate\n');

  try {
    // 1. Verificar múltiplos global_users
    console.log('1️⃣ Verificando múltiplos global_users por usuário...');
    const multipleCheck = await pool.query(`
      SELECT
        u.email,
        COUNT(DISTINCT uil.global_user_id) as qtd
      FROM users u
      JOIN user_identity_links uil ON u.user_id = uil.user_id
      GROUP BY u.email
      HAVING COUNT(DISTINCT uil.global_user_id) > 1
      LIMIT 5
    `);

    if (multipleCheck.rows.length === 0) {
      console.log('   ✅ Nenhum usuário com múltiplos global_users\n');
    } else {
      console.log('   ❌ PROBLEMA: Usuários com múltiplos global_users:');
      multipleCheck.rows.forEach(row => {
        console.log(`      ${row.email}: ${row.qtd} global_users diferentes`);
      });
      console.log();
    }

    // 2. Verificar dessincronização
    console.log('2️⃣ Verificando dessincronização users vs links...');
    const desyncCheck = await pool.query(`
      SELECT
        u.email,
        u.global_user_id as id_users,
        uil.global_user_id as id_links
      FROM users u
      LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id AND u.tenant_id = uil.tenant_id
      WHERE u.global_user_id IS DISTINCT FROM uil.global_user_id
      LIMIT 5
    `);

    if (desyncCheck.rows.length === 0) {
      console.log('   ✅ Nenhuma dessincronização detectada\n');
    } else {
      console.log('   ❌ PROBLEMA: Dessincronização detectada:');
      desyncCheck.rows.forEach(row => {
        console.log(`      ${row.email}:`);
        console.log(`         users.global_user_id: ${row.id_users || 'NULL'}`);
        console.log(`         links.global_user_id: ${row.id_links || 'NULL'}`);
      });
      console.log();
    }

    // 3. Verificar global_users órfãos
    console.log('3️⃣ Verificando global_users órfãos (sem links)...');
    const orphansCheck = await pool.query(`
      SELECT
        gu.global_user_id,
        gu.full_name,
        gu.birthdate,
        (SELECT COUNT(*) FROM users WHERE global_user_id = gu.global_user_id) as qtd_users
      FROM global_users gu
      WHERE NOT EXISTS (
        SELECT 1 FROM user_identity_links uil
        WHERE uil.global_user_id = gu.global_user_id
      )
      LIMIT 5
    `);

    if (orphansCheck.rows.length === 0) {
      console.log('   ✅ Nenhum global_user órfão\n');
    } else {
      console.log(`   ⚠️ ${orphansCheck.rows.length} global_users órfãos encontrados:`);
      orphansCheck.rows.forEach(row => {
        console.log(`      ID: ${row.global_user_id.substring(0, 8)}...`);
        console.log(`         Nome: ${row.full_name || 'NULL'}`);
        console.log(`         Birthdate: ${row.birthdate || 'NULL'}`);
        console.log(`         Referenciado em users: ${row.qtd_users}`);
      });
      console.log();
    }

    // 4. Verificar registros recentes com birthdate
    console.log('4️⃣ Verificando últimos registros com birthdate...');
    const recentWithBirthdate = await pool.query(`
      SELECT
        gu.global_user_id,
        gu.full_name,
        gu.birthdate,
        gu.updated_at,
        (SELECT COUNT(*) FROM user_identity_links WHERE global_user_id = gu.global_user_id) as qtd_links
      FROM global_users gu
      WHERE gu.birthdate IS NOT NULL
      ORDER BY gu.updated_at DESC
      LIMIT 5
    `);

    if (recentWithBirthdate.rows.length === 0) {
      console.log('   ⚠️ Nenhum registro com birthdate encontrado\n');
    } else {
      console.log(`   ✅ ${recentWithBirthdate.rows.length} registros recentes com birthdate:`);
      recentWithBirthdate.rows.forEach(row => {
        console.log(`      Nome: ${row.full_name}`);
        console.log(`         Birthdate: ${row.birthdate}`);
        console.log(`         Links: ${row.qtd_links}`);
        console.log(`         Atualizado: ${row.updated_at}`);
        console.log();
      });
    }

    // 5. Resumo final
    console.log('━'.repeat(60));
    console.log('📊 RESUMO DO DIAGNÓSTICO\n');

    const hasMultiple = multipleCheck.rows.length > 0;
    const hasDesync = desyncCheck.rows.length > 0;
    const hasOrphans = orphansCheck.rows.length > 0;

    if (!hasMultiple && !hasDesync && !hasOrphans) {
      console.log('✅ SISTEMA OK: Nenhum problema detectado');
      console.log('   - Sem múltiplos global_users');
      console.log('   - Sem dessincronização');
      console.log('   - Sem órfãos críticos\n');
    } else {
      console.log('⚠️ PROBLEMAS DETECTADOS:\n');
      if (hasMultiple) console.log('   ❌ Usuários com múltiplos global_users');
      if (hasDesync) console.log('   ❌ Dessincronização entre users e links');
      if (hasOrphans) console.log('   ⚠️ Global_users órfãos (pode ser normal de testes)\n');
      console.log('   → Execute DIAGNOSTICO_BIRTHDATE.sql para mais detalhes');
      console.log('   → Verifique logs do backend durante operações\n');
    }

    console.log('━'.repeat(60));
    console.log('📝 PRÓXIMOS PASSOS:\n');
    console.log('1. Iniciar backend: npm run dev');
    console.log('2. Abrir frontend: http://localhost:5173/perfil');
    console.log('3. Preencher Nome, Data de Nascimento, Sexo');
    console.log('4. Clicar em "Salvar"');
    console.log('5. Pressionar F5 para recarregar');
    console.log('6. ✅ Verificar que dados permanecem preenchidos\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao executar teste:', error);
    await pool.end();
    process.exit(1);
  }
}

testBirthdatePersistence();
