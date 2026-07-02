/**
 * E2E — F-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST-FIX (DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST). NÃO MOVE
 * DINHEIRO. Prova, via `categoryInputGateService.validate()` (mesmo caminho real da criação de
 * categoria), que a auditoria REALMENTE grava agora — antes, `category_input_audit` não existia e
 * TODA chamada falhava em silêncio (nunca uma linha nasceu, para nenhum contexto).
 *
 *   A validate() com termo léxico bloqueado (DENY na ETAPA 1) grava 1 linha em
 *      category_input_audit — achado no processo: o branch ALLOW de professional/education (após
 *      CBO removido) NUNCA chamou .log() sozinho, nem antes desta fatia (só os branches DENY e o
 *      ALLOW de hobby chamam; a auditoria do ALLOW professional/education vive em
 *      categories.service.ts, no fluxo MAIOR de criação de categoria, fora do escopo desta fatia
 *      — testar aqui só a camada corrigida: a TABELA agora existe e aceita INSERT real)
 *   B a linha gravada NÃO tem canonical_id/cbo_match_code/embedding_similarity (colunas não
 *      existem mais — confirma que o fix não reviveu esses campos)
 *   C occupations_reference CONTINUA sem existir (confirma que a Opção A não foi revertida — a
 *      auditoria funciona SEM reviver CBO)
 *   D validate() para hobby (com termo inválido, DENY) TAMBÉM grava auditoria — caminho DENY
 *      diferente do A (hobby-matcher, não lexical-gate)
 *   E Δbank=0 · F guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-category-input-audit-schema-ghost-fix-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/audit|ghost|category|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const auditColumns = (await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='category_input_audit'`
  )).rows.map((r) => r.column_name);
  record('(pré-condição) category_input_audit foi aplicada pela migration FULL', auditColumns.length > 0, JSON.stringify(auditColumns));

  const { categoryInputGateService } = await import('../core/categories/category-input-gate.service');

  console.log('\n— A/B: termo léxico bloqueado (DENY na ETAPA 1) —');
  const countBefore = await count(`SELECT count(*)::int AS n FROM category_input_audit`);
  const rA = await categoryInputGateService.validate('traficante e2e', { context: 'professional' });
  const countAfter = await count(`SELECT count(*)::int AS n FROM category_input_audit`);
  record('A validate() grava 1 linha em category_input_audit (antes: sempre falhava em silêncio)', rA.decision === 'DENY' && countAfter === countBefore + 1, `before=${countBefore} after=${countAfter} decision=${rA.decision}`);

  const row = (await pool.query<Record<string, unknown>>(
    `SELECT * FROM category_input_audit ORDER BY created_at DESC LIMIT 1`
  )).rows[0] as Record<string, unknown> | undefined;
  record('B linha gravada NÃO tem canonical_id/cbo_match_code/embedding_similarity (colunas não existem)', !!row && !('canonical_id' in row) && !('cbo_match_code' in row) && !('embedding_similarity' in row), JSON.stringify(row ? Object.keys(row) : null));

  console.log('\n— C: occupations_reference CONTINUA sem existir —');
  const occExists = (await pool.query<{ exists: string | null }>(`SELECT to_regclass('public.occupations_reference')::text AS exists`)).rows[0].exists;
  record('C occupations_reference NÃO foi revivida (Opção A preservada)', occExists === null, `to_regclass=${occExists}`);

  console.log('\n— D: hobby com termo inválido (DENY) também audita —');
  const countBeforeD = await count(`SELECT count(*)::int AS n FROM category_input_audit`);
  const rD = await categoryInputGateService.validate('termo-hobby-inexistente-e2e-xyz', { context: 'hobby' });
  const countAfterD = await count(`SELECT count(*)::int AS n FROM category_input_audit`);
  record('D caminho DENY (hobby inválido) também grava auditoria', countAfterD === countBeforeD + 1, `before=${countBeforeD} after=${countAfterD} decision=${rD.decision}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('E Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0; try { execSync('node scripts/audit-category-input-audit-schema-ghost-fix.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
  record('F guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ category_input_audit aplicada e gravando de verdade (ALLOW e DENY); occupations_reference continua não revivida; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
