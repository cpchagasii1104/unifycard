/**
 * E2E — F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149 materializada; fecha o
 * remanescente do achado B3 do auditoria.md). NÃO MOVE DINHEIRO — exercita SÓ discovery/claim/
 * idempotência (o braço econômico executeSplit/executeFunding NÃO é chamado).
 *
 *   A. RLS real: as 6 tabelas do Grupo B isoladas por tenant sob SET ROLE unificard_app
 *   B. tenant-loop funcional (funções REAIS re-keyadas):
 *      B1 listTenantIdsForWorkerLoop() enxerga os tenants (fonte não-RLS)
 *      B2 claimNextPendingFundingRequests(A) claima SÓ de A; pendência de B fica intacta
 *      B3 listPendingActions(A) lista SÓ de A
 *      B4 claimNextPendingDistributions(clientA, A) claima SÓ de A
 *      B5 claimNextSettlementsPendingSplit(clientA, A) claima SÓ settlement de A
 *      B6 hasExecutionForSettlement(tenantId, settlementId) — idempotência tenant-scoped
 *   C. Δbank=0 · guard estrutural verde
 *
 * 🔒 DB EFÊMERA. NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool, getClientWithTenant } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/group.*b|tenant.*loop|rls|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkActor(tenantId: string, name: string): Promise<string> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  return (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
}

interface TenantCtx {
  tenantId: string;
  treasuryId: string;
  fundingId: string;
  actionId: string;
  distributionId: string;
  settlementId: string;
  splitConfigId: string;
  splitExecutionId: string;
}

async function seedTenant(name: string): Promise<TenantCtx> {
  const tenantId = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [tenantId, `Group B RLS E2E ${name}`, `group-b-rls-${name.toLowerCase()}-${tenantId.slice(0, 8)}`]);
  const actorId = await mkActor(tenantId, `GB-${name}`);
  const bankAccountId = (await pool.query<{ id: string }>(`INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2::uuid,'credit') RETURNING id::text AS id`, [tenantId, actorId])).rows[0].id;
  const treasuryId = (await pool.query<{ id: string }>(`INSERT INTO treasury_accounts (tenant_id, treasury_type, account_id) VALUES ($1::uuid,'regional_fund',$2::uuid) RETURNING id::text AS id`, [tenantId, bankAccountId])).rows[0].id;
  const proposalId = (await pool.query<{ id: string }>(`INSERT INTO governance_proposals (tenant_id, proposal_type, status, voting_deadline) VALUES ($1::uuid,'funding','open',NOW() + interval '7 days') RETURNING id::text AS id`, [tenantId])).rows[0].id;
  const fundingId = (await pool.query<{ id: string }>(`INSERT INTO governance_funding (tenant_id, proposal_id, treasury_account_id, amount_cents, currency, status) VALUES ($1::uuid,$2::uuid,$3::uuid,1000,'BRL','pending') RETURNING id::text AS id`, [tenantId, proposalId, treasuryId])).rows[0].id;
  const actionId = (await pool.query<{ id: string }>(`INSERT INTO governance_financial_actions (tenant_id, proposal_id, action_type, payload, status) VALUES ($1::uuid,$2::uuid,'treasury_distribution','{}'::jsonb,'pending') RETURNING id::text AS id`, [tenantId, proposalId])).rows[0].id;
  const distributionId = (await pool.query<{ id: string }>(`INSERT INTO treasury_distributions (tenant_id, treasury_account_id, proposal_id, amount_cents, distribution_type, status) VALUES ($1::uuid,$2::uuid,$3::uuid,500,'regional','pending') RETURNING id::text AS id`, [tenantId, treasuryId, proposalId])).rows[0].id;
  const settlementId = (await pool.query<{ id: string }>(`INSERT INTO bank_settlements (tenant_id, payout_id, amount_cents, currency, status) VALUES ($1::uuid,$2::uuid,700,'BRL','sent') RETURNING id::text AS id`, [tenantId, randomUUID()])).rows[0].id;
  const splitConfigId = (await pool.query<{ id: string }>(`INSERT INTO treasury_split_config (tenant_id, slug, pct_regional, pct_community, pct_system_reserve, pct_governance, pct_seller) VALUES ($1::uuid,'default',5.0,3.0,2.0,0.0,90.0) RETURNING id::text AS id`, [tenantId])).rows[0].id;
  const splitExecutionId = (await pool.query<{ id: string }>(`INSERT INTO treasury_split_executions (tenant_id, settlement_id, split_result) VALUES ($1::uuid,$2::uuid,'{}'::jsonb) RETURNING id::text AS id`, [tenantId, randomUUID()])).rows[0].id;
  return { tenantId, treasuryId, fundingId, actionId, distributionId, settlementId, splitConfigId, splitExecutionId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const A = await seedTenant('A');
  const B = await seedTenant('B');

  // ── PARTE A: RLS real sob SET ROLE unificard_app ──
  console.log('\n— PARTE A: isolamento RLS real das 6 tabelas (SET ROLE unificard_app) —');
  const rlsChecks: Array<{ table: string; pk: string; idA: string; idB: string }> = [
    { table: 'governance_funding', pk: 'id', idA: A.fundingId, idB: B.fundingId },
    { table: 'governance_financial_actions', pk: 'id', idA: A.actionId, idB: B.actionId },
    { table: 'treasury_distributions', pk: 'id', idA: A.distributionId, idB: B.distributionId },
    { table: 'treasury_split_config', pk: 'id', idA: A.splitConfigId, idB: B.splitConfigId },
    { table: 'treasury_split_executions', pk: 'id', idA: A.splitExecutionId, idB: B.splitExecutionId },
    { table: 'treasury_accounts', pk: 'id', idA: A.treasuryId, idB: B.treasuryId },
  ];
  const client = await pool.connect();
  try {
    await client.query('SET ROLE unificard_app');
    for (const c of rlsChecks) {
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [A.tenantId]);
      const seen = (await client.query<{ id: string }>(`SELECT ${c.pk}::text AS id FROM ${c.table}`)).rows.map((r) => r.id);
      record(`${c.table}: tenant=A vê só a própria linha`, seen.includes(c.idA) && !seen.includes(c.idB), `seen=${seen.length}`);
    }
    await client.query('RESET ROLE');
  } finally {
    client.release();
  }

  // ── PARTE B: tenant-loop funcional com as funções REAIS re-keyadas ──
  console.log('\n— PARTE B: tenant-loop funcional (funções reais) —');
  const { listTenantIdsForWorkerLoop } = await import('../core/database/tenant-loop');
  const tenantIds = await listTenantIdsForWorkerLoop();
  record('B1 listTenantIdsForWorkerLoop enxerga A e B (fonte não-RLS)', tenantIds.includes(A.tenantId) && tenantIds.includes(B.tenantId), `count=${tenantIds.length}`);

  const { claimNextPendingFundingRequests } = await import('../modules/governance-funding/governance-funding.repository');
  const claimedA = await claimNextPendingFundingRequests(A.tenantId, 50);
  const fundingBStatus = (await pool.query<{ status: string }>(`SELECT status FROM governance_funding WHERE id = $1::uuid`, [B.fundingId])).rows[0].status;
  record('B2 claim de funding de A claima SÓ de A (1 item, status processing)', claimedA.length === 1 && claimedA[0].id === A.fundingId && claimedA[0].status === 'processing', `claimed=${claimedA.length}`);
  record('B2 pendência de B fica intacta (pending)', fundingBStatus === 'pending', `statusB=${fundingBStatus}`);

  const { listPendingActions } = await import('../modules/governance/governance-financial-action-repository');
  const actionsA = await listPendingActions(A.tenantId, 50);
  record('B3 listPendingActions(A) lista SÓ de A', actionsA.length === 1 && actionsA[0].id === A.actionId, `count=${actionsA.length}`);

  const { claimNextPendingDistributions } = await import('../modules/treasury/treasury-distribution-repository');
  const distClient = await getClientWithTenant(A.tenantId);
  try {
    await distClient.query('BEGIN');
    const dists = await claimNextPendingDistributions(distClient, A.tenantId, 50);
    record('B4 claim de distributions de A claima SÓ de A', dists.length === 1 && dists[0].id === A.distributionId, `count=${dists.length}`);
    await distClient.query('COMMIT');
  } finally {
    distClient.release();
  }

  const { claimNextSettlementsPendingSplit, hasExecutionForSettlement } = await import('../modules/treasury-split/treasury-split-config.repository');
  const splitClient = await getClientWithTenant(A.tenantId);
  try {
    await splitClient.query('BEGIN');
    const settlements = await claimNextSettlementsPendingSplit(splitClient, A.tenantId, 50);
    record('B5 claim de settlements de A claima SÓ de A', settlements.length === 1 && settlements[0].settlementId === A.settlementId, `count=${settlements.length}`);
    await splitClient.query('COMMIT');
  } finally {
    splitClient.release();
  }

  await pool.query(`INSERT INTO treasury_split_executions (tenant_id, settlement_id, split_result) VALUES ($1::uuid,$2::uuid,'{}'::jsonb)`, [A.tenantId, A.settlementId]);
  const hasA = await hasExecutionForSettlement(A.tenantId, A.settlementId);
  const hasB = await hasExecutionForSettlement(B.tenantId, B.settlementId);
  record('B6 idempotência tenant-scoped: execução de A detectada, B (sem execução p/ seu settlement) não', hasA === true && hasB === false, `hasA=${hasA} hasB=${hasB}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('C Δbank=0 (braço econômico NÃO exercitado)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0;
  try { execSync('node scripts/audit-group-b-financial-workers-tenant-loop-rls.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { g = 1; }
  record('C guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ 6 tabelas do Grupo B sob RLS real; 4 workers em tenant-loop (DECISION-0149) com claims/idempotência tenant-scoped provados pelas funções reais; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
