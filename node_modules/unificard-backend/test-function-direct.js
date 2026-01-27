// Testar a função SQL diretamente após a correção
const { Pool } = require('pg');
require('dotenv').config();

const TENANT_ID = '66aa49d4-a44e-4b40-b64c-927877183d6a';
const USER_ID = '7b16ab1f-6ed3-43fa-ae83-1cb7a1477992';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testFunction() {
  console.log('='.repeat(80));
  console.log('TESTE DIRETO DA FUNÇÃO SQL user_has_permission APÓS CORREÇÃO');
  console.log('='.repeat(80));
  
  const client = await pool.connect();
  
  try {
    // Testar a função diretamente (sem runQueryWithTenant)
    const testPermissions = [
      { resource: 'rides', action: 'service-types:read' },
      { resource: 'work', action: 'job:read' },
      { resource: 'reputation', action: 'read' },
    ];
    
    console.log('\n🧪 Testando função SQL diretamente (sem tenant context externo):');
    console.log('─'.repeat(80));
    
    for (const perm of testPermissions) {
      const result = await client.query(
        `SELECT user_has_permission($1::uuid, $2::uuid, $3, $4) as has_permission`,
        [TENANT_ID, USER_ID, perm.resource, perm.action]
      );
      
      const hasPerm = result.rows[0].has_permission;
      console.log(`  ${perm.resource}:${perm.action} = ${hasPerm ? '✅ SIM' : '❌ NÃO'}`);
    }
    
    // Agora testar simulando o que runQueryWithTenant faz
    console.log('\n🧪 Testando função SQL com tenant context (simulando runQueryWithTenant):');
    console.log('─'.repeat(80));
    
    await client.query('BEGIN');
    const safeTenantId = TENANT_ID.replace(/[^a-zA-Z0-9_-]/g, '');
    await client.query(`SET LOCAL app.current_tenant = '${safeTenantId}'`);
    
    for (const perm of testPermissions) {
      const result = await client.query(
        `SELECT user_has_permission($1::uuid, $2::uuid, $3, $4) as has_permission`,
        [TENANT_ID, USER_ID, perm.resource, perm.action]
      );
      
      const hasPerm = result.rows[0].has_permission;
      console.log(`  ${perm.resource}:${perm.action} = ${hasPerm ? '✅ SIM' : '❌ NÃO'}`);
    }
    
    await client.query('COMMIT');
    
    // Verificar a definição da função
    console.log('\n📋 Verificando definição da função:');
    console.log('─'.repeat(80));
    const funcDef = await client.query(`
      SELECT 
        proname as function_name,
        prosecdef as is_security_definer,
        pg_get_functiondef(oid) as function_definition
      FROM pg_proc
      WHERE proname = 'user_has_permission'
      LIMIT 1
    `);
    
    if (funcDef.rows.length > 0) {
      console.log(`  Function Name: ${funcDef.rows[0].function_name}`);
      console.log(`  Security Definier: ${funcDef.rows[0].is_security_definer ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`  Definition:`);
      console.log(funcDef.rows[0].function_definition);
    }
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testFunction()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ ERRO FATAL:', error);
    await pool.end();
    process.exit(1);
  });

