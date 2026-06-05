/**
 * E2E F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SCHEMA-MIGRATION — schema de cnae_concept_suggestions (DECISION-0104).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-cnae-concept-suggestion-schema-ephemeral.ps1.
 *
 * Prova a migration 20260604160000: tabela + colunas/tipos; FK suggested_concept_id → concepts;
 * multi-candidato por CNAE; UNIQUE (cnae_code, suggested_concept_id); CHECKs não-vazios
 * (cnae_code/rationale/source/catalog_version); CHECK confidence/review_status; defaults
 * (review_status='proposed', is_active=true); o quadro NÃO toca companies.primary_ ·
 * company_concept_publications · tenant_concept_offerings · Bank; sem seed; zero resíduo (BEGIN/ROLLBACK).
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
  if (!/cnae|concept|suggestion|fiscal|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const T = 'cnae_concept_suggestions';

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
    record('1 tabela cnae_concept_suggestions existe', reg.rows[0].t === T, `to_regclass=${reg.rows[0].t}`);

    // 2. colunas/tipos
    const cols = await client.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='${T}'`
    );
    const m = new Map(cols.rows.map((r) => [r.column_name, r]));
    const expectCol = (n: string, dt: string, nu: 'YES' | 'NO') => {
      const c = m.get(n);
      record(`2 coluna ${n} (${dt}, nullable=${nu})`, !!c && c.data_type === dt && c.is_nullable === nu, c ? `got ${c.data_type}/${c.is_nullable}` : 'ausente');
    };
    expectCol('id', 'uuid', 'NO');
    expectCol('cnae_code', 'text', 'NO');
    expectCol('suggested_concept_id', 'uuid', 'NO');
    expectCol('confidence', 'text', 'NO');
    expectCol('rationale', 'text', 'NO');
    expectCol('source', 'text', 'NO');
    expectCol('catalog_version', 'text', 'NO');
    expectCol('review_status', 'text', 'NO');
    expectCol('is_active', 'boolean', 'NO');

    // âncora real: 2 concepts distintos seedados por migration (137 vivos)
    const cps = await client.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts ORDER BY slug LIMIT 2`);
    if (cps.rowCount !== 2) throw new Error(`fixture: esperava ≥2 concepts seedados, achei ${cps.rowCount}`);
    const conceptA = cps.rows[0].c;
    const conceptB = cps.rows[1].c;

    const ins = (extraCols: string, extraVals: string) =>
      `INSERT INTO ${T} (cnae_code, suggested_concept_id, confidence, rationale, source, catalog_version${extraCols}) VALUES ($1,$2,$3,$4,$5,$6${extraVals})`;

    // 3. FK concept inválido → 23503
    {
      const r = await expectViolation(ins('', ''), ['4721102', '00000000-0000-0000-0000-000000000000', 'high', 'padaria', 'curadoria', 'v1'], '23503');
      record('3 FK suggested_concept_id inválido bloqueado (23503)', r.blocked, `code=${r.code}`);
    }

    // 4. múltiplos concepts para o MESMO CNAE OK
    {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins('', ''), ['4721102', conceptA, 'high', 'padaria principal', 'curadoria', 'v1']);
        await client.query(ins('', ''), ['4721102', conceptB, 'medium', 'padaria alternativa', 'curadoria', 'v1']);
        await client.query('RELEASE SAVEPOINT sp');
        record('4 múltiplos concepts para o mesmo CNAE (N candidatos) OK', true);
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('4 múltiplos concepts para o mesmo CNAE OK', false, e?.message); }
    }
    // 5. duplicidade (cnae_code, suggested_concept_id) bloqueada → 23505
    {
      const r = await expectViolation(ins('', ''), ['4721102', conceptA, 'low', 'dup', 'curadoria', 'v1'], '23505');
      record('5 duplicidade (cnae_code, concept) bloqueada (23505)', r.blocked, `code=${r.code}`);
    }
    // 6/7/8/9. CHECKs não-vazios → 23514
    {
      const r = await expectViolation(ins('', ''), ['   ', conceptA, 'high', 'r', 's', 'v1'], '23514');
      record('6 cnae_code vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', ''), ['1112233', conceptA, 'high', '   ', 's', 'v1'], '23514');
      record('7 rationale vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', ''), ['1112234', conceptA, 'high', 'r', '   ', 'v1'], '23514');
      record('8 source vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', ''), ['1112235', conceptA, 'high', 'r', 's', '   '], '23514');
      record('9 catalog_version vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    // 10. confidence inválido → 23514
    {
      const r = await expectViolation(ins('', ''), ['1112236', conceptA, 'altissima', 'r', 's', 'v1'], '23514');
      record('10 confidence inválido bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    // 11. review_status inválido → 23514
    {
      const r = await expectViolation(ins(', review_status', ', $7'), ['1112237', conceptA, 'high', 'r', 's', 'v1', 'aprovadissimo'], '23514');
      record('11 review_status inválido bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    // 12/13. defaults review_status='proposed' e is_active=true
    {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins('', ''), ['8888888', conceptA, 'medium', 'default test', 'curadoria', 'v1']);
        const d = await client.query<{ review_status: string; is_active: boolean }>(
          `SELECT review_status, is_active FROM ${T} WHERE cnae_code='8888888' AND suggested_concept_id=$1::uuid`, [conceptA]
        );
        record('12 default review_status=proposed', d.rows[0].review_status === 'proposed', `got=${d.rows[0].review_status}`);
        record('13 default is_active=true', d.rows[0].is_active === true, `got=${d.rows[0].is_active}`);
        await client.query('ROLLBACK TO SAVEPOINT sp');
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('12/13 defaults', false, e?.message); }
    }

    // 14/15/16. o quadro NÃO escreve companies.primary_* / publication / offering
    {
      const prim = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM companies WHERE primary_company_type_id IS NOT NULL OR primary_concept_id IS NOT NULL`);
      record('14 nenhuma companies.primary_* escrita pelo quadro', prim.rows[0].n === '0', `n=${prim.rows[0].n}`);
    }
    {
      const ccp = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM company_concept_publications`);
      record('15 company_concept_publications intocado (0)', ccp.rows[0].n === '0', `n=${ccp.rows[0].n}`);
    }
    {
      const tco = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM tenant_concept_offerings`);
      record('16 tenant_concept_offerings intocado (0)', tco.rows[0].n === '0', `n=${tco.rows[0].n}`);
    }
    // 17. Bank intocado
    {
      const bank = await client.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions))::text AS n`);
      record('17 Bank intocado (bank_ledger+bank_transactions=0)', bank.rows[0].n === '0', `n=${bank.rows[0].n}`);
    }
    // 18. sem seed: a migration não popula o quadro (descontando as inserções de teste, via tabela limpa antes)
    //     Aqui valida que NÃO há nenhuma linha além das que ESTE teste inseriu nesta tx — antes de tudo era 0.
    //     (a verificação dura de "zero seed" é o 19b pós-ROLLBACK.)

    await client.query('ROLLBACK'); // 19. zero dado persistido
    record('19 ROLLBACK — zero dado persistido', true);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    record('FATAL', false, (e as Error).message);
  } finally {
    client.release();
  }

  // 18/19b. sem seed + tabela vazia após ROLLBACK (a migration não semeia nada)
  const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${T}`);
  record('18 sem seed + tabela vazia após ROLLBACK (migration não semeia)', left.rows[0].n === '0', `n=${left.rows[0].n}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Schema cnae_concept_suggestions verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
