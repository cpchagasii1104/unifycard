/**
 * Script-filho de F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX. Roda num processo SEPARADO com
 * DATABASE_URL apontando pro role probe (NOSUPERUSER/NOBYPASSRLS, membro de unificard_app) — só
 * assim os helpers REAIS (runQueryWithTenant/getClientWithTenant/getClientWithPlatformAdmin), que
 * usam o `pool` singleton do pool.ts fixado em import-time, ficam sujeitos a RLS de verdade.
 * Imprime um JSON de resultado em stdout; o pai (E2E principal) faz o parse.
 */
import 'tsconfig-paths/register';
import { pool, getClientWithTenant, getClientWithPlatformAdmin, runQueryWithTenant, runQueriesWithTenant } from '../core/database/pool';
import { recordFinancialAudit } from '../core/observability/financial-audit';

const TENANT_A = process.env.PROBE_TENANT_A!;
const TENANT_B = process.env.PROBE_TENANT_B!;
const PI_A = process.env.PROBE_PI_A!;
const PI_B = process.env.PROBE_PI_B!;
const CS_A_ID = process.env.PROBE_CS_A_ID!;

async function main() {
  const out: Record<string, unknown> = {};

  // 1. runQueryWithTenant real: busca o payment_intent de A usando tenant A -- deve achar (não vazio).
  const viaRunQuery = await runQueryWithTenant<{ id: string }>(
    TENANT_A,
    `SELECT id::text AS id FROM payment_intents WHERE id = $1::uuid`,
    [PI_A]
  );
  out.runQueryWithTenant_ownTenant_found = !!viaRunQuery;

  // 2. runQueryWithTenant real: tenant A tentando ler o payment_intent de B -- RLS deve filtrar (undefined).
  const viaRunQueryCross = await runQueryWithTenant<{ id: string }>(
    TENANT_A,
    `SELECT id::text AS id FROM payment_intents WHERE id = $1::uuid`,
    [PI_B]
  );
  out.runQueryWithTenant_crossTenant_blocked = viaRunQueryCross === undefined;

  // 3. runQueriesWithTenant real: lista todos os payment_intents visíveis sob tenant B -- só o de B.
  const viaRunQueries = await runQueriesWithTenant<{ id: string }>(
    TENANT_B,
    `SELECT id::text AS id FROM payment_intents`
  );
  const ids = viaRunQueries.map((r) => r.id);
  out.runQueriesWithTenant_tenantB_seesOnlyB = ids.includes(PI_B) && !ids.includes(PI_A);

  // 4. getClientWithTenant real (client bruto, multi-query): mesma prova, via client mantido aberto.
  const client = await getClientWithTenant(TENANT_A);
  try {
    const r1 = await client.query<{ id: string }>(`SELECT id::text AS id FROM payment_intents WHERE id = $1::uuid`, [PI_A]);
    const r2 = await client.query<{ id: string }>(`SELECT id::text AS id FROM payment_intents WHERE id = $1::uuid`, [PI_B]);
    out.getClientWithTenant_ownTenant_found = r1.rows.length === 1;
    out.getClientWithTenant_crossTenant_blocked = r2.rows.length === 0;
  } finally {
    client.release();
  }

  // 5. getClientWithPlatformAdmin real: vê canonical_services scoped de QUALQUER tenant (bypass admin).
  const adminClient = await getClientWithPlatformAdmin();
  try {
    const rAdmin = await adminClient.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services WHERE id = $1::uuid`, [CS_A_ID]);
    out.getClientWithPlatformAdmin_seesScoped = rAdmin.rows.length === 1;
  } finally {
    adminClient.release();
  }

  // 6. Confirma que o probe role de fato NÃO é superuser/bypassrls (senão o teste todo seria vácuo).
  const roleCheck = await pool.query<{ usesuper: boolean }>(`SELECT usesuper FROM pg_user WHERE usename = current_user`);
  out.probeRole_isNotSuperuser = roleCheck.rows[0]?.usesuper === false;
  const bypassCheck = await pool.query<{ rolbypassrls: boolean }>(`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`);
  out.probeRole_isNotBypassRls = bypassCheck.rows[0]?.rolbypassrls === false;

  // 7. (achado N1) recordFinancialAudit REAL sob RLS: financial_audit_trail tem RLS+FORCE; a função
  //    re-keyada (runQueryWithTenant) deve conseguir ESCREVER a trilha. ANTES do fix (pool cru) o
  //    WITH CHECK rejeitaria o INSERT sob o probe role → trilha de auditoria parava silenciosamente.
  try {
    await recordFinancialAudit({
      tenant_id: TENANT_A,
      event_type: 'round2_probe_audit_write',
      transaction_id: null,
      account_id: null,
      actor_id: null,
      amount_cents: 100,
      metadata: { probe: true },
    });
    const rows = await runQueriesWithTenant<{ n: string }>(
      TENANT_A,
      `SELECT count(*)::text AS n FROM financial_audit_trail WHERE tenant_id = $1::uuid AND event_type = 'round2_probe_audit_write'`,
      [TENANT_A]
    );
    out.recordFinancialAudit_writesUnderRls = Number(rows[0]?.n ?? '0') === 1;
  } catch (e) {
    out.recordFinancialAudit_writesUnderRls = false;
    out.recordFinancialAudit_error = (e as Error).message;
  }

  console.log('PROBE_RESULT_JSON:' + JSON.stringify(out));
  await pool.end();
  process.exit(0);
}
main().catch((e) => { console.error('PROBE_ERROR:', e); process.exit(1); });
