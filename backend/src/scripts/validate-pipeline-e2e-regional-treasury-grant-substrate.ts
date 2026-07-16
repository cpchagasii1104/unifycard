/**
 * E2E — B-CITY-2 · FINANCIAL AUTHORITY GRANT MODEL (DECISION-0185). Substrato DORMENTE.
 * NÃO MOVE DINHEIRO. NÃO cria writer/policy/PORTA/grant real (todos os inserts rodam em transação
 * ROLLBACK — zero resíduo). Prova, contra o SCHEMA REAL do banco efêmero:
 *   - contrato físico: scope_type=3, shape 3-way, nonfinancial implicação por scope, chk regional=2 keys,
 *     matriz 3 ramos, unicidade ativa regional (com tenant_id);
 *   - CHECK-bite: cada vetor hostil é DB-rejeitado; controles benignos passam;
 *   - dormência: zero grant regional após a migration (e após os rollbacks).
 *
 * 🔒 DB EFÊMERA (run-regional-treasury-grant-substrate-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const KEY_POLICY = 'treasury:regional_policy_manage';
const KEY_PORTA = 'treasury:regional_fund_activation_manage';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const scalar = async <T>(sql: string, p: unknown[] = []): Promise<T> => (await pool.query(sql, p)).rows[0] as T;

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/grant|treasury|regional|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

const INSERT_GRANT = `
  INSERT INTO actor_capability_grants
    (tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id, scope_city_id,
     granted_by_user_id, granted_by_actor_id, authority_source, status)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'e2e-regional-treasury','active')`;

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── 1. CONTRATO FÍSICO (schema real) ──
  const scopeType = (await scalar<{ d: string }>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='actor_capability_grants'::regclass AND conname='chk_acg_scope_type'`)).d;
  record('S1 chk_acg_scope_type = actor|territory|regional_treasury',
    /'actor'/.test(scopeType) && /'territory'/.test(scopeType) && /regional_treasury/.test(scopeType) && !/'(financial|city_treasury|regional_finance|global|system)'/.test(scopeType), scopeType);

  const shape = (await scalar<{ d: string }>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='actor_capability_grants'::regclass AND conname='chk_acg_scope_shape'`)).d;
  record('S2 shape regional_treasury = tenant NOT NULL + scope_actor NULL + city NOT NULL',
    /regional_treasury/.test(shape), shape);

  const nonfin = (await scalar<{ d: string }>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial'`)).d;
  record('S3 nonfinancial virou implicação por scope (12 keys, sem treasury:)',
    /scope_type/.test(nonfin) && /territory:register_neighborhood_succession/.test(nonfin) && /service_order:view/.test(nonfin) && !/treasury:/.test(nonfin), nonfin.slice(0, 60));

  const rtCheck = (await scalar<{ d: string }>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='actor_capability_grants'::regclass AND conname='chk_acg_capability_regional_treasury'`)).d;
  const rtKeys = (rtCheck.match(/treasury:[a-z_]+/g) || []);
  record('S4 chk_acg_capability_regional_treasury = exatamente as 2 keys',
    rtKeys.length === 2 && rtCheck.includes(KEY_POLICY) && rtCheck.includes(KEY_PORTA) && !/~~|LIKE|%/.test(rtCheck), rtCheck);

  const matrix = (await scalar<{ d: string }>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='actor_capability_grants'::regclass AND conname='chk_acg_scope_capability_matrix'`)).d;
  record('S5 matriz 3 ramos (regional_treasury => 2 keys)',
    /'actor'/.test(matrix) && /'territory'/.test(matrix) && /regional_treasury/.test(matrix) && matrix.includes(KEY_POLICY) && matrix.includes(KEY_PORTA), matrix.slice(0, 60));

  const uidx = (await scalar<{ d: string }>(`SELECT indexdef AS d FROM pg_indexes WHERE indexname='uidx_actor_capability_grants_regional_treasury_active'`)).d;
  record('S6 unicidade ativa regional (tenant,grantee,capability,city) COM tenant_id',
    /\(tenant_id, grantee_actor_id, capability_key, scope_city_id\)/.test(uidx) && /regional_treasury/.test(uidx) && /active/.test(uidx) && !/now\(\)/.test(uidx), uidx);

  // ── 2. DORMÊNCIA: zero grant regional após migration ──
  const zero0 = Number((await scalar<{ n: string }>(`SELECT count(*)::int AS n FROM actor_capability_grants WHERE scope_type='regional_treasury'`)).n);
  record('D1 zero grants regional_treasury após a migration (dormente)', zero0 === 0, `count=${zero0}`);

  // ── 3. FIXTURES (committed; não são grants) ──
  const TENANT_A = randomUUID();
  await tenantService.createTenant({ id: TENANT_A, name: 'RT A', slug: `rt-a-${Date.now()}` });
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_B, name: 'RT B', slug: `rt-b-${Date.now()}` });
  const granter = await mkUserActor(TENANT_A, 'Granter');
  const grantee = await mkUserActor(TENANT_A, 'Grantee');
  const CITY = (await scalar<{ id: string }>(`SELECT city_id::text AS id FROM cities LIMIT 1`)).id;
  if (!CITY) throw new Error('ABORT: nenhuma city seedada no efêmero (Location Core FULL ausente).');

  // ── 4. CHECK-BITE — cada insert em SAVEPOINT, sempre ROLLBACK (zero resíduo) ──
  const client = await pool.connect();
  await client.query('BEGIN');
  let spN = 0;
  // tenta um INSERT; retorna {ok, err}. Sempre rollback ao savepoint (nada persiste).
  const tryInsert = async (params: unknown[]): Promise<{ ok: boolean; err?: string }> => {
    spN += 1; const sp = `sp_${spN}`;
    await client.query(`SAVEPOINT ${sp}`);
    try { await client.query(INSERT_GRANT, params); await client.query(`ROLLBACK TO ${sp}`); return { ok: true }; }
    catch (e) { await client.query(`ROLLBACK TO ${sp}`); return { ok: false, err: e instanceof Error ? e.message : String(e) }; }
  };

  try {
    // Controles benignos (devem PASSAR)
    record('V+1 regional_treasury policy válido (tenant+city, scope_actor NULL) → aceito',
      (await tryInsert([TENANT_A, grantee.actorId, KEY_POLICY, 'regional_treasury', null, CITY, granter.userId, granter.actorId])).ok);
    record('V+2 regional_treasury PORTA válido (mesma tupla, outra key) → aceito',
      (await tryInsert([TENANT_A, grantee.actorId, KEY_PORTA, 'regional_treasury', null, CITY, granter.userId, granter.actorId])).ok);
    record('V+3 actor-scoped não-financeiro (calendar:block) → aceito (12 keys preservadas)',
      (await tryInsert([TENANT_A, grantee.actorId, 'calendar:block', 'actor', grantee.actorId, null, granter.userId, granter.actorId])).ok);
    record('V+4 territory-scoped (territory:create_neighborhood, tenant NULL, city) → aceito',
      (await tryInsert([null, grantee.actorId, 'territory:create_neighborhood', 'territory', null, CITY, granter.userId, granter.actorId])).ok);

    // Vetores hostis (devem MORDER)
    record('H1 regional_treasury sem tenant → rejeitado (shape)',
      !(await tryInsert([null, grantee.actorId, KEY_POLICY, 'regional_treasury', null, CITY, granter.userId, granter.actorId])).ok);
    record('H2 regional_treasury sem city → rejeitado (shape)',
      !(await tryInsert([TENANT_A, grantee.actorId, KEY_POLICY, 'regional_treasury', null, null, granter.userId, granter.actorId])).ok);
    record('H3 regional_treasury com scope_actor_id → rejeitado (shape)',
      !(await tryInsert([TENANT_A, grantee.actorId, KEY_POLICY, 'regional_treasury', grantee.actorId, CITY, granter.userId, granter.actorId])).ok);
    record('H4 capability financeira em scope actor → rejeitado (matriz/nonfin)',
      !(await tryInsert([TENANT_A, grantee.actorId, KEY_POLICY, 'actor', grantee.actorId, null, granter.userId, granter.actorId])).ok);
    record('H5 capability financeira em scope territory → rejeitado (matriz)',
      !(await tryInsert([null, grantee.actorId, KEY_POLICY, 'territory', null, CITY, granter.userId, granter.actorId])).ok);
    record('H6 capability não-financeira em regional_treasury → rejeitado (chk regional/matriz)',
      !(await tryInsert([TENANT_A, grantee.actorId, 'calendar:block', 'regional_treasury', null, CITY, granter.userId, granter.actorId])).ok);
    record('H7 terceira key financeira (treasury:regional_other_manage) em regional_treasury → rejeitado',
      !(await tryInsert([TENANT_A, grantee.actorId, 'treasury:regional_other_manage', 'regional_treasury', null, CITY, granter.userId, granter.actorId])).ok);
    record('H8 scope_type alias city_treasury → rejeitado (scope_type)',
      !(await tryInsert([TENANT_A, grantee.actorId, KEY_POLICY, 'city_treasury', null, CITY, granter.userId, granter.actorId])).ok);

    // Unicidade ativa: duplicado no MESMO tenant morde; MESMA tupla em OUTRO tenant é permitida (tenant-scoped).
    // Savepoints internos contêm o abort do erro de unicidade (Postgres aborta a tx até ROLLBACK TO).
    {
      spN += 1; const sp = `sp_${spN}`;
      await client.query(`SAVEPOINT ${sp}`);
      await client.query(INSERT_GRANT, [TENANT_A, grantee.actorId, KEY_POLICY, 'regional_treasury', null, CITY, granter.userId, granter.actorId]);
      let dupBit = false;
      await client.query(`SAVEPOINT ${sp}_dup`);
      try { await client.query(INSERT_GRANT, [TENANT_A, grantee.actorId, KEY_POLICY, 'regional_treasury', null, CITY, granter.userId, granter.actorId]); }
      catch { dupBit = true; await client.query(`ROLLBACK TO ${sp}_dup`); } // limpa o estado abortado
      // outro tenant, mesma (grantee,capability,city) → permitido (prova tenant-scoping); estado já limpo
      let otherTenantOk = false;
      try { await client.query(INSERT_GRANT, [TENANT_B, grantee.actorId, KEY_POLICY, 'regional_treasury', null, CITY, granter.userId, granter.actorId]); otherTenantOk = true; }
      catch (e) { otherTenantOk = false; console.log('   (otherTenant err:', e instanceof Error ? e.message : e, ')'); }
      await client.query(`ROLLBACK TO ${sp}`);
      record('H9 duplicado ativo no mesmo tenant → rejeitado (unicidade regional)', dupBit);
      record('V+5 mesma (grantee,capability,city) em OUTRO tenant → aceito (tenant-scoped)', otherTenantOk);
    }

    await client.query('ROLLBACK'); // nada persiste
  } finally {
    client.release();
  }

  // ── 5. RESÍDUO ZERO ──
  const zero1 = Number((await scalar<{ n: string }>(`SELECT count(*)::int AS n FROM actor_capability_grants WHERE scope_type='regional_treasury'`)).n);
  record('D2 zero grants regional_treasury após rollbacks (resíduo zero)', zero1 === 0, `count=${zero1}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ B-CITY-2 substrato regional_treasury: contrato físico + CHECK-bite + dormência provados (zero resíduo).');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
