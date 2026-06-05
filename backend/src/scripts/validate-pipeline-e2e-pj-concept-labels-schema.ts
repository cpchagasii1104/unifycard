/**
 * E2E F-PJ-CONCEPT-LABELS-SCHEMA-MIGRATION — schema de concept_labels (DECISION-0107).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-concept-labels-schema-ephemeral.ps1.
 *
 * Prova: tabela + colunas/tipos; FK concept_id→concepts; CHECKs não-vazios (locale/context_key/label/source);
 * 1 primária por (concept,locale,context); múltiplas NÃO-primárias OK; defaults (locale/context_key/is_primary);
 * `concepts` segue seco (sem display_name); zero seed; Bank intocado; zero resíduo (BEGIN/ROLLBACK).
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
  if (!/concept|label|schema|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const T = 'concept_labels';

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
    record('1 tabela concept_labels existe', reg.rows[0].t === T, `to_regclass=${reg.rows[0].t}`);

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
    expectCol('concept_id', 'uuid', 'NO');
    expectCol('locale', 'text', 'NO');
    expectCol('context_key', 'text', 'NO');
    expectCol('label', 'text', 'NO');
    expectCol('short_label', 'text', 'YES');
    expectCol('is_primary', 'boolean', 'NO');
    expectCol('source', 'text', 'NO');

    // âncora real: 1 concept seedado
    const concept = (await client.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts ORDER BY slug LIMIT 1`)).rows[0].c;
    const ins = (extraCols: string, vals: string) =>
      `INSERT INTO ${T} (concept_id, label, source${extraCols}) VALUES ($1,$2,$3${vals})`;

    // 3. FK concept inválido → 23503
    {
      const r = await expectViolation(ins('', ''), ['00000000-0000-0000-0000-000000000000', 'X', 'seed'], '23503');
      record('3 FK concept_id inválido bloqueado (23503)', r.blocked, `code=${r.code}`);
    }
    // 4. 1 primária OK + defaults
    {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins('', ''), [concept, 'Açougue', 'curadoria']);
        const d = await client.query<{ locale: string; context_key: string; is_primary: boolean }>(
          `SELECT locale, context_key, is_primary FROM ${T} WHERE concept_id=$1::uuid AND label='Açougue'`, [concept]
        );
        record('4 insere 1 primária OK + defaults (locale=pt-BR, context=default, is_primary=true)',
          d.rows[0].locale === 'pt-BR' && d.rows[0].context_key === 'default' && d.rows[0].is_primary === true);
        await client.query('RELEASE SAVEPOINT sp');
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('4 insere 1 primária OK', false, e?.message); }
    }
    // 5. segunda primária mesmo (concept,locale,context) → 23505
    {
      const r = await expectViolation(ins(', is_primary', ', true'), [concept, 'Outra Primária', 'curadoria'], '23505');
      record('5 segunda primária (mesmo concept/locale/context) bloqueada (23505)', r.blocked, `code=${r.code}`);
    }
    // 6. múltiplas NÃO-primárias OK
    {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(ins(', is_primary', ', false'), [concept, 'Alias 1', 'curadoria']);
        await client.query(ins(', is_primary', ', false'), [concept, 'Alias 2', 'curadoria']);
        await client.query('RELEASE SAVEPOINT sp');
        record('6 múltiplas NÃO-primárias OK (mesmo concept/locale/context)', true);
      } catch (e: any) { await client.query('ROLLBACK TO SAVEPOINT sp'); record('6 múltiplas NÃO-primárias OK', false, e?.message); }
    }
    // 7. CHECKs não-vazios → 23514
    {
      const r = await expectViolation(ins(', locale', `, '   '`), [concept, 'L', 'seed'], '23514');
      record('7a locale vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins(', context_key', `, '   '`), [concept, 'L', 'seed'], '23514');
      record('7b context_key vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', ''), [concept, '   ', 'seed'], '23514');
      record('7c label vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }
    {
      const r = await expectViolation(ins('', ''), [concept, 'L', '   '], '23514');
      record('7d source vazio bloqueado (23514)', r.blocked, `code=${r.code}`);
    }

    // 8. concepts segue seco (sem display_name/name/label)
    {
      const dry = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.columns WHERE table_name='concepts' AND column_name IN ('display_name','name','label')`
      );
      record('8 concepts segue seco (sem display_name/name/label)', dry.rows[0].n === '0', `n=${dry.rows[0].n}`);
    }
    // 10. Bank intocado
    {
      const bank = await client.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`);
      record('10 Bank intocado (0)', bank.rows[0].n === '0', `n=${bank.rows[0].n}`);
    }

    await client.query('ROLLBACK'); // 11. zero resíduo
    record('11 ROLLBACK — zero dado persistido', true);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    record('FATAL', false, (e as Error).message);
  } finally {
    client.release();
  }

  // 9. zero seed (migration não popula) + tabela vazia após ROLLBACK
  const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${T}`);
  record('9 zero seed + tabela vazia após ROLLBACK (migration não semeia)', left.rows[0].n === '0', `n=${left.rows[0].n}`);

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
  console.log('✨ Schema concept_labels verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
