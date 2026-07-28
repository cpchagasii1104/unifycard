// backend/src/scripts/grant-admin-role-to-real-account.ts
//
// Concede a role 'admin' (RBAC V2, tabela user_roles) a um user_id REAL de um tenant já
// existente — o MESMO passo 4 de `bootstrap-dev-canonical.ts` ("role admin ao DEV: EXCLUSIVO
// do bootstrap; idempotente"), mas apontado a uma conta que já existe (não cria tenant/PF
// sintéticos). Usa o writer governado `rbacService.assignRoleByName`
// (backend/src/core/rbac/rbac.service.ts) — o MESMO usado por
// `validate-pipeline-e2e-economic-policy-authority.ts` (`mkHuman(..., 'admin')`) — nunca um
// INSERT ad-hoc.
//
// Por que este script existe (em vez de rodar bootstrap-dev-canonical.ts): aquele script
// cria SEMPRE um tenant/PF sintéticos próprios (`DEV_TENANT_ID`/`dev@unificard.local`) — não
// serve para dar a role a uma conta real já registrada em outro tenant. Este script reusa o
// MESMO passo 4 (writer canônico), sem re-executar os passos 1–3.
//
// Execução: npx tsx src/scripts/grant-admin-role-to-real-account.ts <tenant_id> <user_id>
//
// PROIBIDO: INSERT direto em user_roles/roles. Só o writer canônico do serviço.

import 'tsconfig-paths/register';
import { pool, runQueryWithTenant } from '../core/database/pool'; // import de pool → loadBackendEnv()
import { rbacService } from '../core/rbac/rbac.service';

const EXPECTED_DATABASE_NAME = 'unificard_dev';
const ROLE_NAME = 'admin';

function assertDevOnly(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ABORT: script dev-only (NODE_ENV=production detectado).');
  }
}

async function assertTargetDatabase(): Promise<void> {
  const r = await pool.query<{ current_database: string }>('SELECT current_database()');
  const db = r.rows[0]?.current_database;
  if (db !== EXPECTED_DATABASE_NAME) {
    throw new Error(`ABORT: banco-alvo é "${db}", esperado "${EXPECTED_DATABASE_NAME}".`);
  }
  console.log(`🔒 Banco-alvo confirmado: ${db}`);
}

async function main(): Promise<void> {
  const [tenantId, userId] = process.argv.slice(2);
  if (!tenantId || !userId) {
    throw new Error('Uso: tsx src/scripts/grant-admin-role-to-real-account.ts <tenant_id> <user_id>');
  }

  assertDevOnly();
  await assertTargetDatabase();

  const user = await runQueryWithTenant<{ id: string; email: string; tenant_id: string }>(
    tenantId,
    'SELECT id, email, tenant_id FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [userId, tenantId]
  );
  if (!user) {
    throw new Error(`ABORT: user ${userId} não encontrado no tenant ${tenantId}.`);
  }
  console.log(`👤 Usuário alvo confirmado: ${user.email} (${user.id}) — tenant ${user.tenant_id}`);

  const existingRole = await runQueryWithTenant<{ name: string }>(
    tenantId,
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
     WHERE ur.tenant_id = $1 AND ur.user_id = $2 AND r.name = $3 LIMIT 1`,
    [tenantId, userId, ROLE_NAME]
  );
  if (existingRole) {
    console.log(`✅ Role '${ROLE_NAME}' já atribuída — idempotente, nada a fazer.`);
  } else {
    const userRole = await rbacService.assignRoleByName(tenantId, userId, ROLE_NAME);
    console.log(`✅ Role '${ROLE_NAME}' atribuída via rbacService.assignRoleByName (userRoleId=${userRole.userRoleId})`);
  }

  const roles = await rbacService.getUserRoles(tenantId, userId);
  console.log('📋 Roles atuais do usuário:', roles.map((r) => r.name).join(', '));
}

main()
  .then(() => {
    console.log('\n✨ Concluído.');
  })
  .catch((error) => {
    console.error('\n💥 Erro:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
