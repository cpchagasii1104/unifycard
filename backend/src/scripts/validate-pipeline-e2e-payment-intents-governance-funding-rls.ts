/**
 * E2E — F-PAYMENT-INTENTS-GOVERNANCE-FUNDING-RLS (achado B3 do auditoria.md).
 * NÃO MOVE DINHEIRO. `SET ROLE unificard_app` explícito + `set_config` manual (nível SQL cru) —
 * a única forma de provar isolamento real, já que o `DATABASE_URL` de teste conecta como
 * superuser (postgres), que SEMPRE bypassa RLS.
 *
 *   A. unificard_app + tenant=A → vê payment_intents de A, NÃO de B
 *   B. unificard_app + tenant=B → vê payment_intents de B, NÃO de A
 *   C. mesmo para governance_funding_commitments (A vê só A, B vê só B)
 *   D. UPDATE cross-tenant sob unificard_app é bloqueado pela policy (WITH CHECK)
 *   E. superuser (conexão normal da app, sem SET ROLE) continua vendo tudo — não regride
 *      nenhum caminho existente que dependa de superuser/migração
 *   F. Δbank=0
 *
 * 🔒 DB EFÊMERA. NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
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
  if (!/payment.*intent|rls|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkActor(tenantId: string, name: string): Promise<{ actorId: string }> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'RLS PI E2E A',$2)`, [TENANT_A, `rls-pi-e2e-a-${TENANT_A.slice(0, 8)}`]);
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'RLS PI E2E B',$2)`, [TENANT_B, `rls-pi-e2e-b-${TENANT_B.slice(0, 8)}`]);

  const actorA = (await mkActor(TENANT_A, 'ActorA')).actorId;
  const actorB = (await mkActor(TENANT_B, 'ActorB')).actorId;

  const piA = (await pool.query<{ id: string }>(
    `INSERT INTO payment_intents (tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency)
     VALUES ($1::uuid,$2::uuid,1000,'test',$3,'test-gateway','BRL') RETURNING id::text AS id`,
    [TENANT_A, actorA, `ref-a-${randomUUID()}`]
  )).rows[0].id;
  const piB = (await pool.query<{ id: string }>(
    `INSERT INTO payment_intents (tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency)
     VALUES ($1::uuid,$2::uuid,2000,'test',$3,'test-gateway','BRL') RETURNING id::text AS id`,
    [TENANT_B, actorB, `ref-b-${randomUUID()}`]
  )).rows[0].id;

  const bankAccountA = (await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2::uuid,'credit') RETURNING id::text AS id`,
    [TENANT_A, actorA]
  )).rows[0].id;
  const bankAccountB = (await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2::uuid,'credit') RETURNING id::text AS id`,
    [TENANT_B, actorB]
  )).rows[0].id;
  const treasuryA = (await pool.query<{ id: string }>(`INSERT INTO treasury_accounts (tenant_id, treasury_type, account_id) VALUES ($1::uuid,'regional',$2::uuid) RETURNING id::text AS id`, [TENANT_A, bankAccountA])).rows[0].id;
  const treasuryB = (await pool.query<{ id: string }>(`INSERT INTO treasury_accounts (tenant_id, treasury_type, account_id) VALUES ($1::uuid,'regional',$2::uuid) RETURNING id::text AS id`, [TENANT_B, bankAccountB])).rows[0].id;

  const gfcA = (await pool.query<{ id: string }>(
    `INSERT INTO governance_funding_commitments (tenant_id, proposal_id, treasury_account_id, amount_cents, status) VALUES ($1::uuid,$2::uuid,$3::uuid,500,'pending') RETURNING id::text AS id`,
    [TENANT_A, randomUUID(), treasuryA]
  )).rows[0].id;
  const gfcB = (await pool.query<{ id: string }>(
    `INSERT INTO governance_funding_commitments (tenant_id, proposal_id, treasury_account_id, amount_cents, status) VALUES ($1::uuid,$2::uuid,$3::uuid,700,'pending') RETURNING id::text AS id`,
    [TENANT_B, randomUUID(), treasuryB]
  )).rows[0].id;

  const client = await pool.connect();
  try {
    console.log('\n— A/B: payment_intents isolado sob unificard_app real —');
    await client.query('SET ROLE unificard_app');

    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_A]);
    const seenAsA = (await client.query<{ id: string }>(`SELECT id::text AS id FROM payment_intents`)).rows.map(r => r.id);
    record('A tenant=A vê payment_intents de A', seenAsA.includes(piA), `piA=${piA} visto=${seenAsA.includes(piA)}`);
    record('A tenant=A NÃO vê payment_intents de B', !seenAsA.includes(piB), `piB=${piB} visto=${seenAsA.includes(piB)}`);

    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_B]);
    const seenAsB = (await client.query<{ id: string }>(`SELECT id::text AS id FROM payment_intents`)).rows.map(r => r.id);
    record('B tenant=B vê payment_intents de B', seenAsB.includes(piB), `piB=${piB} visto=${seenAsB.includes(piB)}`);
    record('B tenant=B NÃO vê payment_intents de A', !seenAsB.includes(piA), `piA=${piA} visto=${seenAsB.includes(piA)}`);

    console.log('\n— C: governance_funding_commitments isolado sob unificard_app real —');
    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_A]);
    const gfcSeenAsA = (await client.query<{ id: string }>(`SELECT id::text AS id FROM governance_funding_commitments`)).rows.map(r => r.id);
    record('C tenant=A vê governance_funding_commitments de A, NÃO de B', gfcSeenAsA.includes(gfcA) && !gfcSeenAsA.includes(gfcB), `seen=${gfcSeenAsA.length}`);

    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_B]);
    const gfcSeenAsB = (await client.query<{ id: string }>(`SELECT id::text AS id FROM governance_funding_commitments`)).rows.map(r => r.id);
    record('C tenant=B vê governance_funding_commitments de B, NÃO de A', gfcSeenAsB.includes(gfcB) && !gfcSeenAsB.includes(gfcA), `seen=${gfcSeenAsB.length}`);

    console.log('\n— D: UPDATE cross-tenant bloqueado pela policy (WITH CHECK) —');
    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_A]);
    let updateBlocked = false;
    const updateResult = await client.query(`UPDATE payment_intents SET payment_status = 'cancelled' WHERE id = $1::uuid`, [piB]);
    updateBlocked = updateResult.rowCount === 0;
    record('D UPDATE de tenant=A sobre payment_intent de B afeta 0 linhas (bloqueado)', updateBlocked, `rowCount=${updateResult.rowCount}`);

    await client.query('RESET ROLE');
  } finally {
    client.release();
  }

  console.log('\n— E: superuser (conexão normal) continua vendo tudo, sem regressão —');
  const allAsSuperuser = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM payment_intents WHERE id = ANY($1::uuid[])`, [[piA, piB]])).rows.map(r => r.id);
  record('E superuser vê ambos os payment_intents (A e B)', allAsSuperuser.length === 2, `count=${allAsSuperuser.length}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('F Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ payment_intents e governance_funding_commitments isolados por tenant sob unificard_app real; UPDATE cross-tenant bloqueado; superuser sem regressão; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
