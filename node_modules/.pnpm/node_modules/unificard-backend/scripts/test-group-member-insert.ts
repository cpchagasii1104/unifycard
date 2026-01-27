// Script para testar INSERT em group_members com tenant_id
import { pool } from '../src/core/database/pool';
import { getClientWithTenant } from '../src/core/database/pool';
import 'dotenv/config';

async function testGroupMemberInsert() {
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
      console.log('🧪 Testando INSERT em group_members...\n');

      // Criar um grupo de teste
      const groupResult = await client.query<{ group_id: string }>(`
        INSERT INTO groups (tenant_id, name, owner_user_id)
        VALUES ($1, $2, $3)
        RETURNING group_id
      `, [tenantId, 'Grupo Teste Member', userId]);

      const groupId = groupResult.rows[0].group_id;
      console.log(`✅ Grupo criado: ${groupId}`);

      // Teste: INSERT com tenant_id
      console.log('\nTeste: INSERT em group_members COM tenant_id');
      try {
        const memberResult = await client.query(`
          INSERT INTO group_members (tenant_id, group_id, user_id, role)
          VALUES ($1, $2, $3, $4)
          RETURNING group_id, user_id, role, joined_at
        `, [tenantId, groupId, userId, 'owner']);

        console.log('   ✅ Sucesso!');
        console.log(`   - group_id: ${memberResult.rows[0].group_id}`);
        console.log(`   - user_id: ${memberResult.rows[0].user_id}`);
        console.log(`   - role: ${memberResult.rows[0].role}`);
      } catch (err) {
        console.log('   ❌ Erro:', err instanceof Error ? err.message : String(err));
      }

      // Limpar
      await client.query('DELETE FROM groups WHERE group_id = $1', [groupId]);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

testGroupMemberInsert();






