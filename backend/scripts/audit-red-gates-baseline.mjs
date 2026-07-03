#!/usr/bin/env node
// Guard de baseline-ratchet — F-RED-GATES-BASELINE (achado B4 do auditoria.md / DECISION-0158).
//
// O laudo apontou o ponto cego institucional: 3 gates vermelhos (typecheck 35 · financial-vocabulary
// 3.8k · financial-ssot ~580) conviviam com um pipeline "verde" — a suíte estrutural não os enxergava.
// Clayton ratificou BASELINE FORMAL (não zeragem — drenar 4.4k violações money-adjacent antes de
// PORTA-1 violaria a norma "não-agir em dívida classificada" com os trilhos em HOLD).
//
// MECÂNICA (ratchet): roda os 2 validadores financeiros + o typecheck do gate e compara com
// red-gates-baseline.json:
//   count > baseline  → GATE FAIL (violação NOVA — proibido; o pipeline agora ENXERGA o vermelho).
//   count < baseline  → GATE OK + aviso pra abaixar o baseline no mesmo commit (ratchet down).
//   count = baseline  → GATE OK.
// typecheck_build_max = 0 (drenado na mesma fatia): QUALQUER erro novo no tsconfig.build FALHA.
//
// ⚠️ CUSTO: roda tsc + 2 validadores (~1-2 min). Por isso NÃO entra no agregador de guards pequenos —
// é wired como script próprio (validate:red-gates-baseline) E na cadeia validate:regression-guards
// (fim da cadeia, onde o custo é aceitável 1×/rodada).
// NÃO altera runtime. Δbank=0.

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const BASELINE = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'red-gates-baseline.json'), 'utf-8'));

const failures = [];
const ratchets = [];

function run(cmd) {
  try {
    return { out: execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }), code: 0 };
  } catch (e) {
    return { out: `${e.stdout ?? ''}\n${e.stderr ?? ''}`, code: e.status ?? 1 };
  }
}

// ── 1. financial-vocabulary ──
{
  const { out } = run('node scripts/validate-financial-vocabulary.js');
  const m = out.match(/Encontradas (\d+) violaç/);
  const count = m ? Number(m[1]) : (/Nenhuma violação/.test(out) ? 0 : null);
  if (count === null) {
    failures.push(`financial-vocabulary: não consegui parsear a contagem do validador (formato mudou?). Saída não reconhecida.`);
  } else if (count > BASELINE.financial_vocabulary_max) {
    failures.push(`financial-vocabulary: ${count} violações > baseline ${BASELINE.financial_vocabulary_max} — violação NOVA de vocabulário financeiro fora de src/core/bank (DECISION-0158: o número só pode DESCER).`);
  } else if (count < BASELINE.financial_vocabulary_max) {
    ratchets.push(`financial-vocabulary: ${count} < baseline ${BASELINE.financial_vocabulary_max} — ABAIXE o baseline (ratchet down) em red-gates-baseline.json.`);
  }
  console.log(`   financial-vocabulary: ${count} / max ${BASELINE.financial_vocabulary_max}`);
}

// ── 2. financial-ssot ──
{
  const { out } = run('node scripts/validate-financial-ssot.js');
  const m = out.match(/Encontradas (\d+) violaç/);
  const count = m ? Number(m[1]) : (/exit(ed)? 0|Nenhuma/.test(out) ? 0 : null);
  if (count === null) {
    failures.push(`financial-ssot: não consegui parsear a contagem do validador (formato mudou?).`);
  } else if (count > BASELINE.financial_ssot_max) {
    failures.push(`financial-ssot: ${count} violações > baseline ${BASELINE.financial_ssot_max} — persistência financeira NOVA fora do Bank (DECISION-0158: o número só pode DESCER).`);
  } else if (count < BASELINE.financial_ssot_max) {
    ratchets.push(`financial-ssot: ${count} < baseline ${BASELINE.financial_ssot_max} — ABAIXE o baseline (ratchet down).`);
  }
  console.log(`   financial-ssot: ${count} / max ${BASELINE.financial_ssot_max}`);
}

// ── 3. typecheck do gate (tsconfig.build) — baseline 0, drenado ──
{
  const { out } = run('npx tsc -p tsconfig.build.json --noEmit');
  const count = (out.match(/error TS/g) || []).length;
  if (count > BASELINE.typecheck_build_max) {
    const first = out.split('\n').filter((l) => /error TS/.test(l)).slice(0, 5).join('\n      ');
    failures.push(`typecheck (tsconfig.build): ${count} erros > baseline ${BASELINE.typecheck_build_max} (ZERADO em F-RED-GATES-BASELINE — nenhum erro novo permitido). Primeiros:\n      ${first}`);
  }
  console.log(`   typecheck (tsconfig.build): ${count} / max ${BASELINE.typecheck_build_max}`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [red-gates-baseline]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
for (const r of ratchets) console.log('   ⬇️  RATCHET: ' + r);
console.log('GATE OK [red-gates-baseline] — os 3 ex-gates-vermelhos do achado B4 agora são VIGIADOS: typecheck do gate ZERADO (0 erros); financial-vocabulary/ssot congelados no teto ratificado (DECISION-0158) com ratchet só-desce. O pipeline não está mais "verde mentindo".');
