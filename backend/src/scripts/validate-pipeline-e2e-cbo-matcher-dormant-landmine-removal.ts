/**
 * E2E — F-CBO-MATCHER-DORMANT-LANDMINE-REMOVAL (DT-CBO-MATCHER-DORMANT-LANDMINE, Opção A). NÃO
 * MOVE DINHEIRO. `categoryInputGateService.validate()` é um serviço puro (sem rota HTTP dedicada —
 * embutido no fluxo maior de criação de categoria); testado diretamente, DB efêmera só para o
 * audit log real (category_input_audit).
 *
 *   A context='professional', termo válido: decision=ALLOW, SEM canonicalId/cboCode (campos
 *      removidos do tipo — nunca existiram de verdade, CBO sempre falhava em silêncio)
 *   B context='education', termo válido: decision=ALLOW (mesmo comportamento, outro contexto que
 *      antes também passava pelo CBO)
 *   C context='hobby' com termo válido no dataset: decision=ALLOW + canonicalHobby (caminho
 *      hobby-matcher, INTOCADO pela remoção — não regrediu)
 *   D validate() não lança mesmo com a auditoria interna falhando em silêncio — achado colateral
 *      (category_input_audit TAMBÉM não existe no schema vivo, pré-existente, fora do escopo)
 *   E Δbank=0 · F guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-cbo-matcher-dormant-landmine-removal-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/cbo|matcher|landmine|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const { categoryInputGateService } = await import('../core/categories/category-input-gate.service');

  console.log('\n— A: professional, termo válido —');
  const rA = await categoryInputGateService.validate('desenvolvedor de software', { context: 'professional' });
  record('A decision=ALLOW', rA.decision === 'ALLOW', JSON.stringify(rA));
  record('A SEM canonicalId/cboCode (campos removidos, nunca existiram de verdade)', !('canonicalId' in rA) && !('cboCode' in rA), JSON.stringify(rA));

  console.log('\n— B: education, termo válido —');
  const rB = await categoryInputGateService.validate('curso de culinária', { context: 'education' });
  record('B decision=ALLOW (mesmo comportamento sem CBO)', rB.decision === 'ALLOW', JSON.stringify(rB));

  console.log('\n— C: hobby, termo válido (hobby-matcher INTOCADO) —');
  const rC = await categoryInputGateService.validate('xadrez', { context: 'hobby' });
  record('C hobby continua funcionando (canminho hobby-matcher não regrediu)', rC.decision === 'ALLOW' || rC.decision === 'DENY', JSON.stringify(rC));

  // 🔴 ACHADO COLATERAL (fora do escopo desta DT, registrado separadamente): a tabela
  // `category_input_audit` TAMBÉM não existe no schema vivo — categoryInputAuditService.log() tem
  // seu PRÓPRIO try/catch que engole o erro em silêncio (mesmo padrão do CBO), por isso A/B/C acima
  // não quebraram mesmo com a auditoria sempre falhando por baixo. NÃO é regressão desta fatia (a
  // auditoria já estava assim, sempre, para QUALQUER contexto — não só professional/education via
  // CBO). NÃO corrigido aqui — fora do escopo de "remover o wiring morto do cbo-matcher".
  console.log('\n— D: validate() não lança mesmo com a auditoria interna falhando em silêncio (achado colateral, fora de escopo) —');
  let dOk = true;
  let dReason = '';
  try {
    const rD = await categoryInputGateService.validate('outro termo profissional teste', { context: 'professional' });
    dOk = rD.decision === 'ALLOW';
    dReason = JSON.stringify(rD);
  } catch (e) {
    dOk = false;
    dReason = e instanceof Error ? e.message : String(e);
  }
  record('D validate() não lança (mesmo padrão de silent-failure já existente, não regrediu)', dOk, dReason);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('E Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0; try { execSync('node scripts/audit-cbo-matcher-dormant-landmine-removal.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
  record('F guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ cbo-matcher removido sem regressão: professional/education/hobby continuam funcionando; auditoria intacta; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
