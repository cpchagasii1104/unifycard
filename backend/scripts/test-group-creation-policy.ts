// Script para testar GroupCreationPolicy
import { pool } from '../src/core/database/pool';
import { getClientWithTenant } from '../src/core/database/pool';
import { groupCreationPolicy } from '../src/modules/groups/policies/GroupCreationPolicy';
import { groupsRepository } from '../src/modules/groups/groups.repository';
import 'dotenv/config';

async function testGroupCreationPolicy() {
  try {
    const tenantResult = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenants ORDER BY created_at ASC LIMIT 1`
    );
    if (!tenantResult.rows[0]) {
      throw new Error('Nenhum tenant encontrado');
    }
    const tenantId = tenantResult.rows[0].tenant_id;

    const userResult = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM users WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (!userResult.rows[0]) {
      throw new Error('Nenhum usuário encontrado');
    }
    const userId = userResult.rows[0].user_id;

    const client = await getClientWithTenant(tenantId);

    try {
      console.log('🧪 Testando GroupCreationPolicy...\n');

      // Limpar grupos existentes do usuário para teste
      await client.query('DELETE FROM groups WHERE owner_user_id = $1', [userId]);
      console.log('✅ Grupos existentes removidos para teste limpo\n');

      // Teste 1: Usuário sem grupos pode criar
      console.log('Teste 1: Usuário sem grupos pode criar');
      try {
        await groupCreationPolicy.canCreateGroup(tenantId, userId);
        console.log('   ✅ Sucesso! Usuário pode criar grupo\n');
      } catch (err) {
        console.log('   ❌ Erro inesperado:', err instanceof Error ? err.message : String(err));
      }

      // Criar primeiro grupo
      const group1 = await client.query<{ group_id: string }>(`
        INSERT INTO groups (tenant_id, name, owner_user_id)
        VALUES ($1, $2, $3)
        RETURNING group_id
      `, [tenantId, 'Grupo Teste 1', userId]);
      console.log(`✅ Primeiro grupo criado: ${group1.rows[0].group_id}\n`);

      // Teste 2: Usuário com 1 grupo não pode criar segundo
      console.log('Teste 2: Usuário com 1 grupo não pode criar segundo');
      try {
        await groupCreationPolicy.canCreateGroup(tenantId, userId);
        console.log('   ❌ ERRO: Deveria ter bloqueado!');
      } catch (err: any) {
        if (err.code === 'GROUP_CREATION_LIMIT_REACHED' && err.statusCode === 403) {
          console.log('   ✅ Sucesso! Limite bloqueado corretamente');
          console.log(`   - Código: ${err.code}`);
          console.log(`   - Status: ${err.statusCode}`);
          console.log(`   - Mensagem: ${err.message}\n`);
        } else {
          console.log('   ❌ Erro inesperado:', err);
        }
      }

      // Teste 3: Verificar contagem
      console.log('Teste 3: Verificar contagem de grupos criados');
      const count = await groupsRepository.countGroupsCreatedByUser(tenantId, userId);
      console.log(`   ✅ Grupos criados: ${count} (esperado: 1)\n`);

      // Teste 4: Verificar slots restantes
      console.log('Teste 4: Verificar slots restantes');
      const remaining = await groupCreationPolicy.getRemainingSlots(tenantId, userId);
      console.log(`   ✅ Slots restantes: ${remaining} (esperado: 0)\n`);

      // Limpar
      await client.query('DELETE FROM groups WHERE owner_user_id = $1', [userId]);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

testGroupCreationPolicy();






