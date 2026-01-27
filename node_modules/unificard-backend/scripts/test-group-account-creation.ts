// Script para testar criação de conta financeira para grupo
import { pool } from '../src/core/database/pool';
import { getClientWithTenant } from '../src/core/database/pool';
import { groupAccountService } from '../src/core/economy/group-account.service';
import 'dotenv/config';

async function testGroupAccountCreation() {
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
      console.log('🧪 Testando criação de conta financeira para grupo...\n');

      // Criar um grupo de teste
      const groupResult = await client.query<{ group_id: string }>(`
        INSERT INTO groups (tenant_id, name, owner_user_id)
        VALUES ($1, $2, $3)
        RETURNING group_id
      `, [tenantId, 'Grupo Teste Account', userId]);

      const groupId = groupResult.rows[0].group_id;
      console.log(`✅ Grupo criado: ${groupId}`);

      // Teste: Criar conta via groupAccountService
      console.log('\nTeste: Criar conta via groupAccountService.createOrGetGroupAccount');
      try {
        const accountId = await groupAccountService.createOrGetGroupAccount(tenantId, groupId);
        console.log('   ✅ Sucesso!');
        console.log(`   - account_id: ${accountId}`);

        // Verificar se conta foi criada
        const accountCheck = await client.query(`
          SELECT account_id, tenant_id, owner_id, owner_type, currency
          FROM accounts
          WHERE account_id = $1
        `, [accountId]);

        if (accountCheck.rows.length > 0) {
          console.log('   - Conta encontrada no banco:');
          console.log(`     * tenant_id: ${accountCheck.rows[0].tenant_id}`);
          console.log(`     * owner_id: ${accountCheck.rows[0].owner_id}`);
          console.log(`     * owner_type: ${accountCheck.rows[0].owner_type}`);
          console.log(`     * currency: ${accountCheck.rows[0].currency}`);
        }

        // Verificar se link foi criado
        const linkCheck = await client.query(`
          SELECT group_id, account_id, tenant_id
          FROM group_accounts
          WHERE group_id = $1
        `, [groupId]);

        if (linkCheck.rows.length > 0) {
          console.log('   - Link group_accounts encontrado:');
          console.log(`     * group_id: ${linkCheck.rows[0].group_id}`);
          console.log(`     * account_id: ${linkCheck.rows[0].account_id}`);
          console.log(`     * tenant_id: ${linkCheck.rows[0].tenant_id}`);
        } else {
          console.log('   ⚠️  Link group_accounts NÃO encontrado');
        }

      } catch (err) {
        console.log('   ❌ Erro:', err instanceof Error ? err.message : String(err));
        if (err instanceof Error && err.stack) {
          console.log('   Stack:', err.stack);
        }
      }

      // Limpar
      await client.query('DELETE FROM group_accounts WHERE group_id = $1', [groupId]);
      await client.query('DELETE FROM accounts WHERE owner_id = $1 AND owner_type = $2', [groupId, 'group']);
      await client.query('DELETE FROM groups WHERE group_id = $1', [groupId]);

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

testGroupAccountCreation();






