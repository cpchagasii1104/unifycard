// Script de diagnóstico rápido para verificar se os dados estão sendo salvos
// Execute: npx tsx backend/scripts/debug-profile-save.ts

import { pool } from '../src/core/database/pool';

async function debugProfileSave() {
  try {
    console.log('🔍 Buscando todos os global_users ordenados por updated_at DESC...\n');
    
    const result = await pool.query(`
      SELECT 
        global_user_id,
        full_name,
        birthdate,
        updated_at,
        created_at
      FROM global_users
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    console.log('📋 Últimos 5 registros atualizados:');
    result.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. global_user_id: ${row.global_user_id}`);
      console.log(`   full_name: ${row.full_name || '(null)'}`);
      console.log(`   birthdate: ${row.birthdate || '(null)'}`);
      console.log(`   updated_at: ${row.updated_at}`);
      console.log(`   created_at: ${row.created_at}`);
    });
    
    console.log('\n\n🔍 Buscando links entre users e global_users...\n');
    
    const linksResult = await pool.query(`
      SELECT 
        u.user_id,
        u.email,
        u.global_user_id as users_global_user_id,
        uil.global_user_id as links_global_user_id,
        gu.full_name,
        gu.birthdate,
        gu.updated_at
      FROM users u
      LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id
      LEFT JOIN global_users gu ON COALESCE(u.global_user_id, uil.global_user_id) = gu.global_user_id
      ORDER BY gu.updated_at DESC NULLS LAST
      LIMIT 5
    `);
    
    console.log('📋 Últimos 5 usuários com seus global_users:');
    linksResult.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. user_id: ${row.user_id}`);
      console.log(`   email: ${row.email}`);
      console.log(`   users.global_user_id: ${row.users_global_user_id || '(null)'}`);
      console.log(`   links.global_user_id: ${row.links_global_user_id || '(null)'}`);
      console.log(`   global_user.full_name: ${row.full_name || '(null)'}`);
      console.log(`   global_user.birthdate: ${row.birthdate || '(null)'}`);
      console.log(`   global_user.updated_at: ${row.updated_at || '(null)'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

debugProfileSave();













