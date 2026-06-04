/**
 * E2E F-PJ-PUBLICATION-OFFERING-SCHEMA-MIGRATION — schema de company_concept_publications.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-publication-schema-ephemeral.ps1 (cria DB, migra FULL, roda, dropa).
 *
 * Prova a migration 20260604140000_create_company_concept_publications:
 *   - tabela + colunas/tipos; CHECK status (active/retired); CHECK lifecycle; UNIQUE parcial ativa;
 *     histórico (retired + active coexistem); FKs (válido passa, inválido falha);
 *   - tenant_concept_offerings inalterada; zero dado persistido (BEGIN/ROLLBACK num client dedicado).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const TENANT_ID = '66666666-7777-4444-8888-cccccccccccc';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/publication|schema|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // tenant mínimo (commit próprio, fora da transação de teste)
  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Publication Schema Test', slug: `pj-publication-schema-${Date.now()}` });
  }

  const client = await pool.connect();
  const expectViolation = async (sql: string, params: any[], pgcode: string): Promise<{ blocked: boolean; code: string }> => {
    await client.query('SAVEPOINT sp');
    try {
      await client.query(sql, params);
      await client.query('RELEASE SAVEPOINT sp');
      return { blocked: false, code: '' };
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      return { blocked: e?.code === pgcode, code: e?.code ?? '' };
    }
  };

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT_ID]);

    // ── 1. tabela existe ─────────────────────────────────────────────────────
    const reg = await client.query<{ t: string | null }>(`SELECT to_regclass('public.company_concept_publications')::text AS t`);
    record('1 tabela company_concept_publications existe', reg.rows[0].t === 'company_concept_publications', `to_regclass=${reg.rows[0].t}`);

    // ── 2. colunas/tipos esperados ───────────────────────────────────────────
    const cols = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='company_concept_publications'`
    );
    const colMap = new Map(cols.rows.map((r) => [r.column_name, r]));
    const expectCol = (name: string, type: string, nullable: 'YES' | 'NO') => {
      const c = colMap.get(name);
      record(`2 coluna ${name} (${type}, nullable=${nullable})`, !!c && c.data_type === type && c.is_nullable === nullable, c ? `got ${c.data_type}/${c.is_nullable}` : 'ausente');
    };
    expectCol('id', 'uuid', 'NO');
    expectCol('tenant_id', 'uuid', 'NO');
    expectCol('company_id', 'uuid', 'NO');
    expectCol('page_actor_id', 'uuid', 'NO');
    expectCol('concept_id', 'uuid', 'NO');
    expectCol('status', 'text', 'NO');
    expectCol('published_at', 'timestamp with time zone', 'NO');
    expectCol('retired_at', 'timestamp with time zone', 'YES');
    expectCol('created_by_actor_id', 'uuid', 'NO');
    expectCol('retired_by_actor_id', 'uuid', 'YES');
    expectCol('source', 'text', 'NO');

    // ── fixtures válidas (company inerte + page-actor + concept + human actor) ─
    const conceptRows = (await client.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts LIMIT 2`)).rows;
    const conceptId = conceptRows[0].c;
    const conceptId2 = conceptRows[1].c; // par livre p/ isolar FK de page_actor (evita colisão com UNIQUE ativa)
    const companyId = (await client.query<{ c: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1,'CCP Schema Co') RETURNING company_id::text AS c`, [TENANT_ID])).rows[0].c;
    // chain identity (chk_actor_requires_identity: actor 'user' exige global_user_id → identities).
    const gid = randomUUID();
    const cpf = String(Date.now()).padStart(11, '0').slice(-11);
    await client.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'CCP Owner','{}'::jsonb)`, [gid, cpf]);
    await client.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [gid, cpf]);
    // actor humano (âncora identity) + page-actor (responsible aponta p/ o humano).
    const humanActor = (await client.query<{ a: string }>(`INSERT INTO actors (tenant_id, actor_type, global_user_id, display_name) VALUES ($1,'user',$2,'CCP human') RETURNING id::text AS a`, [TENANT_ID, gid])).rows[0].a;
    const pageActor = (await client.query<{ a: string }>(`INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id) VALUES ($1,'page',$2,'CCP page',$3) RETURNING id::text AS a`, [TENANT_ID, companyId, humanActor])).rows[0].a;

    const insActive = `INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, created_by_actor_id) VALUES ($1,$2,$3,$4,$5)`;

    // ── 3. CHECK status permite active (default) ─────────────────────────────
    await client.query('SAVEPOINT sp_ok');
    try {
      await client.query(insActive, [TENANT_ID, companyId, pageActor, conceptId, humanActor]);
      await client.query('RELEASE SAVEPOINT sp_ok');
      record('3 insere publicação active (default) OK', true);
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_ok');
      record('3 insere publicação active (default) OK', false, e?.message);
    }

    // ── 3b. CHECK status permite retired válido ──────────────────────────────
    {
      const r = await expectViolation(
        `INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, created_by_actor_id, status, retired_at, retired_by_actor_id) VALUES ($1,$2,$3,$4,$5,'retired', now(), $5)`,
        [TENANT_ID, companyId, pageActor, conceptId, humanActor], 'NONE'
      );
      record('3b insere publicação retired válida OK', r.blocked === false && r.code === '', `code=${r.code}`);
    }

    // ── 4. CHECK status bloqueia valor inválido ──────────────────────────────
    {
      const r = await expectViolation(
        `INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, created_by_actor_id, status) VALUES ($1,$2,$3,$4,$5,'banana')`,
        [TENANT_ID, companyId, pageActor, conceptId, humanActor], '23514'
      );
      record('4 status inválido bloqueado (23514)', r.blocked, `code=${r.code}`);
    }

    // ── 5. CHECK lifecycle ───────────────────────────────────────────────────
    {
      const r = await expectViolation(
        `INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, created_by_actor_id, status, retired_at) VALUES ($1,$2,$3,$4,$5,'active', now())`,
        [TENANT_ID, companyId, pageActor, conceptId, humanActor], '23514'
      );
      record('5a active com retired_at preenchido bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(
        `INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, created_by_actor_id, status) VALUES ($1,$2,$3,$4,$5,'retired')`,
        [TENANT_ID, companyId, pageActor, conceptId, humanActor], '23514'
      );
      record('5b retired sem retired_at bloqueado (23514)', r.blocked, `code=${r.code}`);
    }

    // ── 6. UNIQUE parcial — 2ª active para (company,concept) bloqueada ────────
    {
      const r = await expectViolation(insActive, [TENANT_ID, companyId, pageActor, conceptId, humanActor], '23505');
      record('6 2ª publicação active mesmo (company,concept) bloqueada (23505)', r.blocked, `code=${r.code}`);
    }

    // ── 7. histórico — retired + active coexistem p/ mesmo (company,concept) ──
    {
      // aposenta a active vigente, depois insere nova active (deve passar)
      await client.query(`UPDATE company_concept_publications SET status='retired', retired_at=now(), retired_by_actor_id=$1 WHERE company_id=$2 AND concept_id=$3 AND status='active'`, [humanActor, companyId, conceptId]);
      const r = await expectViolation(insActive, [TENANT_ID, companyId, pageActor, conceptId, humanActor], 'NONE');
      const cnt = (await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM company_concept_publications WHERE company_id=$1 AND concept_id=$2`, [companyId, conceptId])).rows[0].n;
      record('7 retired + nova active coexistem (UNIQUE só sobre active)', r.blocked === false && Number(cnt) >= 2, `code=${r.code} count=${cnt}`);
    }

    // ── 8. FKs — referência inválida falha ───────────────────────────────────
    {
      const r = await expectViolation(insActive, [TENANT_ID, randomUUID(), pageActor, conceptId, humanActor], '23503');
      record('8a FK company_id inválida bloqueada (23503)', r.blocked, `code=${r.code}`);
    }
    {
      // usa conceptId2 (par livre) p/ isolar a violação de FK do page_actor — senão a UNIQUE ativa de
      // (companyId, conceptId) dispara 23505 antes do FK.
      const r = await expectViolation(insActive, [TENANT_ID, companyId, randomUUID(), conceptId2, humanActor], '23503');
      record('8b FK page_actor_id inválida bloqueada (23503)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(insActive, [TENANT_ID, companyId, pageActor, randomUUID(), humanActor], '23503');
      record('8c FK concept_id inválida bloqueada (23503)', r.blocked, `code=${r.code}`);
    }

    // ── 9. tenant_concept_offerings inalterada (colunas continuam tenant×concept) ──
    {
      const tco = await client.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='tenant_concept_offerings' ORDER BY column_name`);
      const names = tco.rows.map((r) => r.column_name).sort();
      const expected = ['concept_id', 'created_at', 'id', 'is_active', 'tenant_id', 'updated_at'].sort();
      const same = names.length === expected.length && names.every((n, i) => n === expected[i]);
      record('9 tenant_concept_offerings inalterada (sem company_id/page_actor)', same && !names.includes('company_id') && !names.includes('page_actor_id'), JSON.stringify(names));
    }

    await client.query('ROLLBACK'); // ── 10. zero dado persistido ──
    record('10 ROLLBACK — zero dado persistido', true);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    record('FATAL', false, (e as Error).message);
  } finally {
    client.release();
  }

  // confirmação pós-rollback: nenhuma linha em company_concept_publications
  const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM company_concept_publications`);
  record('10b company_concept_publications vazia após ROLLBACK', left.rows[0].n === '0', `n=${left.rows[0].n}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Schema company_concept_publications verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
