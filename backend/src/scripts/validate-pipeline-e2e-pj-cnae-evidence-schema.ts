/**
 * E2E F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION — schema de fiscal_identity_economic_activities (DECISION-0103).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-cnae-evidence-schema-ephemeral.ps1.
 *
 * Prova a migration 20260604150000: tabela + colunas/tipos; FK fiscal_identity_id; 1 principal / N
 * secundários; UNIQUE (fiscal_identity_id, cnae_code); no máx 1 principal (partial unique); CHECK
 * cnae_code/cnae_description/source não-vazios; fetched_at obrigatório; SEM QSA; companies sem colunas
 * de atividade; Bank/marketplace intocados; zero dado persistido (BEGIN/ROLLBACK).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';

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
  if (!/cnae|evidence|fiscal|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const T = 'fiscal_identity_economic_activities';

async function main(): Promise<void> {
  await assertEphemeralDb();

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

    // 1. tabela existe
    const reg = await client.query<{ t: string | null }>(`SELECT to_regclass('public.${T}')::text AS t`);
    record('1 tabela fiscal_identity_economic_activities existe', reg.rows[0].t === T, `to_regclass=${reg.rows[0].t}`);

    // 2. colunas/tipos
    const cols = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='${T}'`
    );
    const m = new Map(cols.rows.map((r) => [r.column_name, r]));
    const expectCol = (n: string, dt: string, nu: 'YES' | 'NO') => {
      const c = m.get(n);
      record(`2 coluna ${n} (${dt}, nullable=${nu})`, !!c && c.data_type === dt && c.is_nullable === nu, c ? `got ${c.data_type}/${c.is_nullable}` : 'ausente');
    };
    expectCol('id', 'uuid', 'NO');
    expectCol('fiscal_identity_id', 'uuid', 'NO');
    expectCol('cnae_code', 'text', 'NO');
    expectCol('cnae_description', 'text', 'NO');
    expectCol('is_primary', 'boolean', 'NO');
    expectCol('source', 'text', 'NO');
    expectCol('fetched_at', 'timestamp with time zone', 'NO');

    // fixture: fiscal_identity (pending — sem audit obrigatório)
    const cnpj = String(Date.now()).padStart(14, '0').slice(-14);
    const fid = (await client.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status) VALUES ($1,'pending') RETURNING fiscal_identity_id::text AS f`, [cnpj])).rows[0].f;
    const ins = (extra: string, vals: any[]) =>
      `INSERT INTO ${T} (fiscal_identity_id, cnae_code, cnae_description, source, fetched_at${extra ? ', ' + extra : ''}) VALUES ($1,$2,$3,$4, now()${vals.length ? ', ' + vals.map((_, i) => `$${5 + i}`).join(', ') : ''})`;

    // 4. 1 CNAE principal OK
    {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins('is_primary', [true]), [fid, '5611201', 'Restaurantes', 'receitaws', true]);
        await client.query('RELEASE SAVEPOINT sp');
        record('4 insere 1 CNAE principal OK', true);
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('4 insere 1 CNAE principal OK', false, e?.message); }
    }
    // 5. múltiplos secundários OK
    {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins('', []), [fid, '5612100', 'Servicos ambulantes', 'receitaws']);
        await client.query(ins('', []), [fid, '4721102', 'Padaria', 'brasilapi']);
        await client.query('RELEASE SAVEPOINT sp');
        record('5 múltiplos CNAEs secundários OK', true);
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('5 múltiplos CNAEs secundários OK', false, e?.message); }
    }
    // 6. duplicidade (fiscal_identity_id, cnae_code) bloqueada
    {
      const r = await expectViolation(ins('', []), [fid, '5611201', 'Restaurantes dup', 'receitaws'], '23505');
      record('6 duplicidade (fiscal,cnae) bloqueada (23505)', r.blocked, `code=${r.code}`);
    }
    // 7. segundo principal bloqueado (partial unique)
    {
      const r = await expectViolation(ins('is_primary', [true]), [fid, '9999999', 'Outro principal', 'receitaws', true], '23505');
      record('7 segundo CNAE principal bloqueado (23505)', r.blocked, `code=${r.code}`);
    }
    // 8. zero principal permitido (nova fiscal, só secundário)
    {
      const cnpj2 = String(Date.now() + 1).padStart(14, '0').slice(-14);
      const fid2 = (await client.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status) VALUES ($1,'pending') RETURNING fiscal_identity_id::text AS f`, [cnpj2])).rows[0].f;
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins('', []), [fid2, '6201500', 'Desenvolvimento', 'receitaws']);
        await client.query('RELEASE SAVEPOINT sp');
        record('8 zero principal permitido (só secundário)', true);
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('8 zero principal permitido', false, e?.message); }
    }
    // 9/10/11. CHECK não-vazios
    {
      const r = await expectViolation(ins('', []), [fid, '   ', 'desc', 'receitaws'], '23514');
      record('9 cnae_code vazio/trim bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', []), [fid, '1112233', '  ', 'receitaws'], '23514');
      record('10 cnae_description vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', []), [fid, '1112234', 'desc', '   '], '23514');
      record('11 source vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    // 12. fetched_at obrigatório (NOT NULL → 23502)
    {
      const r = await expectViolation(
        `INSERT INTO ${T} (fiscal_identity_id, cnae_code, cnae_description, source, fetched_at) VALUES ($1,$2,$3,$4, NULL)`,
        [fid, '1112235', 'desc', 'receitaws'], '23502'
      );
      record('12 fetched_at NULL bloqueado (23502)', r.blocked, `code=${r.code}`);
    }
    // FK inválida
    {
      const r = await expectViolation(ins('', []), ['00000000-0000-0000-0000-000000000000', '5611201', 'desc', 'receitaws'], '23503');
      record('3 FK fiscal_identity_id inválida bloqueada (23503)', r.blocked, `code=${r.code}`);
    }

    // 13. sem coluna/tabela de QSA
    {
      const qsaTbl = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%qsa%' OR table_name ILIKE '%socio%' OR table_name ILIKE '%shareholder%')`);
      const qsaCol = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM information_schema.columns WHERE table_name='${T}' AND (column_name ILIKE '%qsa%' OR column_name ILIKE '%socio%' OR column_name ILIKE '%cpf%')`);
      record('13 sem QSA (tabela/coluna)', qsaTbl.rows[0].n === '0' && qsaCol.rows[0].n === '0', `tbl=${qsaTbl.rows[0].n} col=${qsaCol.rows[0].n}`);
    }
    // 14. companies sem colunas de atividade
    {
      const actCol = await client.query<{ n: string }>(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='companies' AND column_name IN ('main_activity_code','main_activity_description','secondary_activities')`);
      record('14 companies sem colunas de atividade', Number((actCol.rows[0] as any).n) === 0);
    }
    // 15/16. Bank/marketplace intocados (sem linhas geradas)
    record('15 Bank intocado (bank_transactions=0)', Number((await client.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n) === 0);
    {
      const r = await client.query<{ n: string }>(`SELECT ((SELECT count(*) FROM tenant_concept_offerings) + (SELECT count(*) FROM company_concept_publications))::text AS n`);
      record('16 tenant_concept_offerings/company_concept_publications intocados (0)', r.rows[0].n === '0', `n=${r.rows[0].n}`);
    }

    await client.query('ROLLBACK'); // 17. zero dado persistido
    record('17 ROLLBACK — zero dado persistido', true);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    record('FATAL', false, (e as Error).message);
  } finally {
    client.release();
  }

  const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${T}`);
  record('17b tabela vazia após ROLLBACK', left.rows[0].n === '0', `n=${left.rows[0].n}`);

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
  console.log('✨ Schema fiscal_identity_economic_activities verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
