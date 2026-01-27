// Script para conceder permissão groups:create ao usuário (DEV)
// Executa: npx tsx scripts/grant-groups-create-permission.ts [tenant_id] [user_id]
// Se não fornecer parâmetros, usa o primeiro tenant e primeiro usuário encontrados

import { pool } from '../src/core/database/pool';
import { getClientWithTenant } from '../src/core/database/pool';
import 'dotenv/config';

async function grantGroupsCreatePermission(tenantId?: string, userId?: string) {
  console.log('🔐 Concedendo permissão groups:create ao usuário...\n');

  try {
    // 1. Resolver tenant_id
    let finalTenantId: string;
    if (tenantId) {
      finalTenantId = tenantId;
      console.log(`📋 Usando tenant fornecido: ${finalTenantId}`);
    } else {
      // Buscar primeiro tenant disponível
      const tenantResult = await pool.query<{ tenant_id: string; name: string }>(
        `SELECT tenant_id, name FROM tenants ORDER BY created_at ASC LIMIT 1`
      );
      
      if (!tenantResult.rows[0]) {
        throw new Error('Nenhum tenant encontrado. Crie um tenant primeiro.');
      }
      
      finalTenantId = tenantResult.rows[0].tenant_id;
      console.log(`📋 Usando primeiro tenant encontrado: ${tenantResult.rows[0].name} (${finalTenantId})`);
    }

    // 2. Resolver user_id
    let finalUserId: string;
    if (userId) {
      finalUserId = userId;
      console.log(`👤 Usando usuário fornecido: ${finalUserId}`);
    } else {
      // Buscar primeiro usuário do tenant
      const userResult = await pool.query<{ user_id: string; email: string }>(
        `SELECT user_id, email FROM users WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [finalTenantId]
      );
      
      if (!userResult.rows[0]) {
        throw new Error(`Nenhum usuário encontrado no tenant ${finalTenantId}. Crie um usuário primeiro.`);
      }
      
      finalUserId = userResult.rows[0].user_id;
      console.log(`👤 Usando primeiro usuário encontrado: ${userResult.rows[0].email} (${finalUserId})`);
    }

    const client = await getClientWithTenant(finalTenantId);

    try {
      // 3. Criar ou buscar permissão groups:create
      console.log('\n1️⃣ Criando/buscando permissão groups:create...');
      const permissionResult = await client.query<{ permission_id: string; resource: string; action: string }>(
        `
        INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
        VALUES ($1, 'groups', 'create', 'Permite criar grupos', true)
        ON CONFLICT (tenant_id, resource, action) DO UPDATE SET
          description = EXCLUDED.description,
          updated_at = now()
        RETURNING permission_id, resource, action
        `,
        [finalTenantId]
      );

      const permissionId = permissionResult.rows[0].permission_id;
      console.log(`   ✅ Permissão criada/encontrada: ${permissionResult.rows[0].resource}:${permissionResult.rows[0].action} (${permissionId.substring(0, 8)}...)`);

      // 4. Buscar ou criar role "user" (role padrão)
      console.log('\n2️⃣ Buscando role "user"...');
      let roleResult = await client.query<{ role_id: string; name: string }>(
        `SELECT role_id, name FROM roles WHERE name = 'user' LIMIT 1`
      );

      let roleId: string;
      if (!roleResult.rows[0]) {
        // Se não existir, criar role "user"
        console.log('   ⚠️  Role "user" não encontrada. Criando...');
        roleResult = await client.query<{ role_id: string; name: string }>(
          `
          INSERT INTO roles (tenant_id, name, description, is_system_role)
          VALUES ($1, 'user', 'Usuário padrão', true)
          ON CONFLICT (tenant_id, name) DO UPDATE SET
            description = EXCLUDED.description,
            updated_at = now()
          RETURNING role_id, name
          `,
          [finalTenantId]
        );
        console.log(`   ✅ Role "user" criada: ${roleResult.rows[0].role_id.substring(0, 8)}...`);
      } else {
        console.log(`   ✅ Role "user" encontrada: ${roleResult.rows[0].role_id.substring(0, 8)}...`);
      }

      roleId = roleResult.rows[0].role_id;

      // 5. Atribuir permissão ao role
      console.log('\n3️⃣ Atribuindo permissão ao role "user"...');
      await client.query(
        `
        INSERT INTO role_permissions (tenant_id, role_id, permission_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
        `,
        [finalTenantId, roleId, permissionId]
      );
      console.log('   ✅ Permissão atribuída ao role');

      // 6. Atribuir role ao usuário
      console.log('\n4️⃣ Atribuindo role "user" ao usuário...');
      await client.query(
        `
        INSERT INTO user_roles (tenant_id, user_id, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE SET
          assigned_at = now()
        `,
        [finalTenantId, finalUserId, roleId]
      );
      console.log('   ✅ Role atribuída ao usuário');

      // 7. Validar que a permissão foi concedida
      console.log('\n5️⃣ Validando permissão...');
      const validationResult = await client.query<{ has_permission: boolean }>(
        `SELECT user_has_permission($1, $2, 'groups', 'create') as has_permission`,
        [finalTenantId, finalUserId]
      );

      if (validationResult.rows[0]?.has_permission) {
        console.log('   ✅ Permissão validada com sucesso!');
      } else {
        console.log('   ⚠️  Permissão não foi validada. Verifique manualmente.');
      }

      // 8. Listar permissões do usuário
      console.log('\n📋 Permissões do usuário:');
      const userPermissions = await client.query<{ resource: string; action: string }>(
        `SELECT resource, action FROM get_user_permissions($1, $2) ORDER BY resource, action`,
        [finalTenantId, finalUserId]
      );

      if (userPermissions.rows.length === 0) {
        console.log('   ⚠️  Nenhuma permissão encontrada');
      } else {
        for (const perm of userPermissions.rows) {
          console.log(`   - ${perm.resource}:${perm.action}`);
        }
      }

      console.log('\n✅ Processo concluído com sucesso!');
      console.log(`\n💡 Agora você pode criar grupos com o usuário ${finalUserId} no tenant ${finalTenantId}`);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Erro ao conceder permissão:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ler argumentos da linha de comando
const args = process.argv.slice(2);
const tenantId = args[0];
const userId = args[1];

grantGroupsCreatePermission(tenantId, userId)
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });






