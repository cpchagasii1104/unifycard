/**
 * E2E — F-HOBBY-MATCHER-DIRNAME-ESM-FIX (DT-HOBBY-MATCHER-DIRNAME-ESM-CRASH). NÃO MOVE DINHEIRO.
 * Prova, via `categoryInputGateService.validate()` (mesmo caminho real usado na criação de
 * categoria, context='hobby'), que hobby-matching funciona de verdade agora — antes, __dirname
 * indisponível sob tsx/ESM fazia a construção do array de candidatos lançar ReferenceError,
 * quebrando TODA validação de hobby (fail para DENY/erro, mesmo para hobbies legítimos).
 *
 *   A hobby válido no dataset ("xadrez"): decision=ALLOW, canonicalHobby preenchido — SEM crash
 *   B hobby inválido/inexistente: decision=DENY, reasonCode='NOT_IN_HOBBY_DATASET' (fail-closed
 *      correto por AUSÊNCIA no dataset, NÃO por erro de carregamento — distinção importante: antes
 *      do fix, TODO hobby (válido ou não) caía em erro de carregamento; agora só o realmente
 *      ausente cai em NOT_IN_HOBBY_DATASET)
 *   C audit log grava para ambos os casos (A e B) em category_input_audit — confirma que os dois
 *      fixes desta sessão (schema ghost + dirname) compõem corretamente juntos
 *   D Δbank=0 · E guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-hobby-matcher-dirname-esm-fix-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/hobby|dirname|esm|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const { categoryInputGateService } = await import('../core/categories/category-input-gate.service');

  console.log('\n— A: hobby válido no dataset ("xadrez") —');
  let crashedA = false;
  let rA: Awaited<ReturnType<typeof categoryInputGateService.validate>> | undefined;
  try {
    rA = await categoryInputGateService.validate('xadrez', { context: 'hobby' });
  } catch {
    crashedA = true;
  }
  record('A sem crash (ReferenceError __dirname eliminado)', !crashedA, `crashed=${crashedA}`);
  record('A decision=ALLOW + canonicalHobby preenchido', rA?.decision === 'ALLOW' && !!rA?.canonicalHobby, JSON.stringify(rA));

  console.log('\n— B: hobby inexistente no dataset —');
  const rB = await categoryInputGateService.validate('termo-hobby-totalmente-inexistente-e2e-zzz', { context: 'hobby' });
  record('B decision=DENY + reasonCode=NOT_IN_HOBBY_DATASET (ausência real, não erro de carregamento)', rB.decision === 'DENY' && rB.reasonCode === 'NOT_IN_HOBBY_DATASET', JSON.stringify(rB));

  console.log('\n— C: audit log grava para ambos —');
  const auditCount = await count(
    `SELECT count(*)::int AS n FROM category_input_audit WHERE context='hobby' AND created_at > now() - interval '1 minute'`
  );
  record('C audit log gravou ao menos 2 linhas hobby recentes (fix schema-ghost + fix dirname compõem)', auditCount >= 2, `count=${auditCount}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('D Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0; try { execSync('node scripts/audit-hobby-matcher-dirname-esm-fix.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
  record('E guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ hobby-matcher funciona sem crash sob tsx/ESM; hobby válido casa, inválido nega corretamente por ausência; auditoria grava; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
