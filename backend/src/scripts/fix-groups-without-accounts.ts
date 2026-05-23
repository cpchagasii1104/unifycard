// Script para criar contas para grupos que não têm
// Executar: npx ts-node -r tsconfig-paths/register src/scripts/fix-groups-without-accounts.ts

import { pool } from '../core/database/pool';
import { groupAccountService } from '../core/economy/group-account.service';

interface GroupRow {
  group_id: string;
  tenant_id: string;
  name: string;
}

interface GroupRecord {
  groupId: string;
  tenantId: string;
  name: string;
}

// boundary: DB -> domain mapping
function mapGroupRowToDomain(row: GroupRow): GroupRecord {
  return {
    groupId: row.group_id,
    tenantId: row.tenant_id,
    name: row.name,
  };
}

// TODO: migrate to domain mapping (controlled rollout)
// mapper exists but is not applied in this critical maintenance flow to avoid semantic drift.

async function fixGroupsWithoutAccounts() {
  console.log('🔍 Buscando grupos sem conta...');
  
  const result = await pool.query<GroupRow>(`
    SELECT g.group_id, g.tenant_id, g.name
    FROM groups g
    LEFT JOIN group_accounts ga ON ga.group_id = g.group_id
    WHERE ga.group_id IS NULL
      AND g.is_active = true
  `);
  
  console.log(`📊 Encontrados ${result.rows.length} grupos sem conta`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const group of result.rows) {
    try {
      const accountId = await groupAccountService.createOrGetGroupAccount(
        group.tenant_id,
        group.group_id
      );
      console.log(`✅ Conta criada para grupo "${group.name}": ${accountId}`);
      console.log('[fix-groups-without-accounts] group.account.fixed', {
        groupId: group.group_id,
        groupName: group.name,
        accountId,
        tenantId: group.tenant_id,
      });
      successCount++;
    } catch (err) {
      console.error(`❌ Erro ao criar conta para grupo "${group.name}":`, err);
      console.error('[fix-groups-without-accounts] group.account.fix_failed', {
        groupId: group.group_id,
        groupName: group.name,
        tenantId: group.tenant_id,
        error: err instanceof Error ? err.message : String(err),
      });
      errorCount++;
    }
  }
  
  console.log(`\n🏁 Concluído:`);
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log(`   📊 Total: ${result.rows.length}`);
}

fixGroupsWithoutAccounts()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro fatal:', err);
    pool.end();
    process.exit(1);
  });












