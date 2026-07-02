/**
 * E2E — F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX.
 * NÃO MOVE DINHEIRO. Prova que os helpers REAIS do projeto (runQueryWithTenant/
 * runQueriesWithTenant/getClientWithTenant/getClientWithPlatformAdmin) funcionam corretamente
 * sob RLS de verdade — ou seja, roda um processo-filho conectado como um role NOSUPERUSER/
 * NOBYPASSRLS de verdade (não superuser, que sempre bypassaria RLS e mascararia o bug).
 *
 * Achado: os 4 helpers setavam o GUC de tenant/admin com is_local=true (set_config(...,true)) SEM
 * BEGIN explícito — cada client.query() roda em transação implícita própria, então o GUC evaporava
 * ANTES da query real do caller rodar. Confirmado empiricamente ANTES do fix: current_setting()
 * retornava vazio na query seguinte. Sob unificard_app (RLS-live), isso faria QUALQUER tabela com
 * FORCE ROW LEVEL SECURITY retornar 0 linhas via esses helpers — fail-closed, mas quebrado (não é
 * vazamento; é funcionalidade legítima negada). Invisível em dev porque DATABASE_URL local conecta
 * como postgres (superuser, sempre bypassa RLS).
 *
 * 🔒 DB EFÊMERA. NUNCA toca unificard_dev. Cria e DROPA um role probe temporário (nome único,
 * senha aleatória, sem persistir fora deste processo).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID, randomBytes } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/guc|tenant.*context|transaction.*scope|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkActor(tenantId: string, name: string): Promise<string> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return actorId;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'GUC Fix E2E A',$2)`, [TENANT_A, `guc-fix-e2e-a-${TENANT_A.slice(0, 8)}`]);
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'GUC Fix E2E B',$2)`, [TENANT_B, `guc-fix-e2e-b-${TENANT_B.slice(0, 8)}`]);

  const actorA = await mkActor(TENANT_A, 'GUC-ActorA');
  const actorB = await mkActor(TENANT_B, 'GUC-ActorB');

  const PI_A = (await pool.query<{ id: string }>(
    `INSERT INTO payment_intents (tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency) VALUES ($1::uuid,$2::uuid,1000,'test',$3,'test-gateway','BRL') RETURNING id::text AS id`,
    [TENANT_A, actorA, `guc-ref-a-${randomUUID()}`]
  )).rows[0].id;
  const PI_B = (await pool.query<{ id: string }>(
    `INSERT INTO payment_intents (tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency) VALUES ($1::uuid,$2::uuid,2000,'test',$3,'test-gateway','BRL') RETURNING id::text AS id`,
    [TENANT_B, actorB, `guc-ref-b-${randomUUID()}`]
  )).rows[0].id;

  const gc = await pool.connect();
  let CS_A_ID: string;
  try {
    await gc.query('BEGIN');
    await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
    const concept = await gc.query<{ concept_id: string }>(`INSERT INTO concepts (domain, slug) VALUES ('servicos',$1) RETURNING concept_id`, [`guc-fix-e2e-${randomUUID().slice(0, 8)}`]);
    const cs = await gc.query<{ id: string }>(
      `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES ($1,'scoped',$2,'GUC Fix E2E Scoped A','guc-fix-e2e-scoped-a','active') RETURNING id`,
      [TENANT_A, concept.rows[0].concept_id]
    );
    CS_A_ID = cs.rows[0].id;
    await gc.query('COMMIT');
  } catch (e) {
    await gc.query('ROLLBACK');
    throw e;
  } finally {
    gc.release();
  }

  // ── Criar role probe: NOSUPERUSER/NOBYPASSRLS de verdade, membro de unificard_app (herda grants) ──
  const probeRole = `guc_fix_probe_${randomBytes(4).toString('hex')}`;
  const probePassword = randomBytes(16).toString('hex');
  await pool.query(`CREATE ROLE ${probeRole} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION LOGIN PASSWORD '${probePassword}' IN ROLE unificard_app`);
  record('(pré-condição) role probe criado NOSUPERUSER/NOBYPASSRLS, membro de unificard_app', true);

  try {
    const dbUrl = new URL(process.env.DATABASE_URL!);
    dbUrl.username = probeRole;
    dbUrl.password = probePassword;

    console.log('\n— Verificação via processo-filho conectado como role probe (RLS real, não superuser) —');
    const stdout = execSync('npx tsx src/scripts/_verify-guc-fix-as-probe-role.ts', {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: dbUrl.toString(),
        PROBE_TENANT_A: TENANT_A,
        PROBE_TENANT_B: TENANT_B,
        PROBE_PI_A: PI_A,
        PROBE_PI_B: PI_B,
        PROBE_CS_A_ID: CS_A_ID,
      },
    });

    const line = stdout.split('\n').find((l) => l.startsWith('PROBE_RESULT_JSON:'));
    if (!line) throw new Error('Processo-filho não retornou PROBE_RESULT_JSON. stdout: ' + stdout);
    const probe = JSON.parse(line.replace('PROBE_RESULT_JSON:', ''));

    record('probe role NÃO é superuser (teste é real, não vácuo)', probe.probeRole_isNotSuperuser === true);
    record('probe role NÃO tem bypassrls (teste é real, não vácuo)', probe.probeRole_isNotBypassRls === true);
    record('runQueryWithTenant: tenant A acha o próprio payment_intent (não vazio — ANTES do fix retornaria undefined)', probe.runQueryWithTenant_ownTenant_found === true);
    record('runQueryWithTenant: tenant A NÃO acha payment_intent de B (RLS bloqueia)', probe.runQueryWithTenant_crossTenant_blocked === true);
    record('runQueriesWithTenant: tenant B vê só o próprio payment_intent', probe.runQueriesWithTenant_tenantB_seesOnlyB === true);
    record('getClientWithTenant: tenant A acha o próprio payment_intent (client multi-query)', probe.getClientWithTenant_ownTenant_found === true);
    record('getClientWithTenant: tenant A NÃO acha payment_intent de B', probe.getClientWithTenant_crossTenant_blocked === true);
    record('getClientWithPlatformAdmin: vê canonical_service scoped de A (bypass admin funcionando)', probe.getClientWithPlatformAdmin_seesScoped === true);
  } finally {
    await pool.query(`DROP ROLE IF EXISTS ${probeRole}`);
    console.log(`🧹 role probe ${probeRole} removido.`);
  }

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0;
  try {
    execSync('node scripts/audit-guc-tenant-context-transaction-scope-fix.mjs', { cwd: process.cwd(), encoding: 'utf8' });
  } catch { g = 1; }
  record('guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ runQueryWithTenant/runQueriesWithTenant/getClientWithTenant/getClientWithPlatformAdmin corretos sob RLS real (role NOSUPERUSER/NOBYPASSRLS); Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
