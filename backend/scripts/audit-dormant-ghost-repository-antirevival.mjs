#!/usr/bin/env node
// backend/scripts/audit-dormant-ghost-repository-antirevival.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-08-01, GO Clayton)
// ║ NORMA:   REMEDIATION_DT_LOG — "AUDITORIA YALA DO ARCO", achado 【4】
// ║ NÃO:     confiar na isenção por caminho de arquivo do schema-coherence
// ║ EM VEZ:  morder se um repositório DORMENTE com SQL fantasma voltar a ser importado
// ╚════════════════════════════════════════════════════════════════
//
// POR QUE EXISTE — a porta que a direção instalou e a auditoria pegou
// Em 2026-07-31 o religamento do Bank tirou `bankReconciliationHistoryRepository`
// do caminho vivo (a rota passou a usar `reconciliation_runs` +
// `reconciliation_ledger_discrepancies`, o SSOT nomeado pela DECISION
// RECONCILIATION_DISCREPANCY_DUAL_TABLE). O repositório ficou DORMENTE — sem
// caller — mas o SQL fantasma continua dentro dele
// (`INSERT INTO bank_reconciliation_history` :101, `FROM` :161, :185; a tabela
// NUNCA existiu no schema vivo, DDL só em migrations_archive/0216).
//
// Para o gate `schema-coherence` parar de contar aquilo, a entrada
// `DT-BANK-RECONCILIATION-HISTORY-DORMANT` foi acrescentada a
// `scripts/schema-coherence-allowlist.json` — e ela isenta **POR CAMINHO DE
// ARQUIVO**. `validate-schema-code-coherence.mjs:1001-1005` descarta o ref
// allowlistado ANTES de entrar em `violations`, que é o `--json` que o ratchet
// consome.
//
// 🔴 CONSEQUÊNCIA QUE A AUDITORIA YALA NOMEOU (2026-08-01):
// **quem reimportar o repositório acende o SQL fantasma com o gate VERDE.**
// A isenção não sabe distinguir "dormente" de "religado" — ela só olha o
// caminho do arquivo, que não muda quando alguém volta a chamá-lo.
// Este guard é o anticorpo: a isenção continua valendo enquanto NINGUÉM
// importar; no instante em que alguém importa, o runner fica vermelho.
//
// Em validate:regression-guards.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const REPO = join(__dirname, '..', '..');

// ============================================================================
// OS DORMENTES — arquivo isento no schema-coherence por estar SEM CALLER.
// Acrescentar aqui exige: (a) o arquivo ter SQL de tabela inexistente,
// (b) zero caller vivo, (c) entrada correspondente na allowlist do gate.
// ============================================================================
const DORMANT = [
  {
    file: 'modules/bank/bank-reconciliation-history.repository.ts',
    symbol: 'bankReconciliationHistoryRepository',
    ghostTable: 'bank_reconciliation_history',
    allowlistId: 'DT-BANK-RECONCILIATION-HISTORY-DORMANT',
    instead:
      'reconciliation_runs + reconciliation_ledger_discrepancies (SSOT nomeado pela DECISION RECONCILIATION_DISCREPANCY_DUAL_TABLE) — ver bank-balance-consolidation.routes.ts',
  },
];

// ============================================================================
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

// comentário não conta: a migalha §7.1 CITA o símbolo de propósito, para dizer
// "não religue". Se o comentário mordesse, documentar corretamente ficaria proibido.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const files = walk(SRC);
const errors = [];

for (const d of DORMANT) {
  const target = join(SRC, d.file);
  if (!existsSync(target)) {
    errors.push(
      `❌ DORMENTE SUMIU: ${d.file} não existe mais. Se foi removido de propósito, remova esta entrada do guard E a entrada ${d.allowlistId} de scripts/schema-coherence-allowlist.json no MESMO commit — isenção órfã é allowlist podre.`
    );
    continue;
  }

  // (1) o SQL fantasma ainda está lá? Se saiu, a isenção não é mais necessária.
  const targetSrc = stripComments(readFileSync(target, 'utf-8'));
  if (!targetSrc.includes(d.ghostTable)) {
    errors.push(
      `❌ ISENÇÃO VENCIDA: ${d.file} não tem mais SQL de \`${d.ghostTable}\`. O arquivo foi consertado — remova ${d.allowlistId} da allowlist e esta entrada do guard, e deixe o teto do ratchet DESCER de verdade (desta vez por conserto, não por isenção).`
    );
  }

  // (2) 🔴 o núcleo: alguém voltou a importar/chamar?
  for (const f of files) {
    if (f === target) continue;
    const rel = relative(REPO, f).replace(/\\/g, '/');
    const src = stripComments(readFileSync(f, 'utf-8'));
    const importa =
      new RegExp(`from\\s+['"][^'"]*${d.file.replace(/\.ts$/, '').split('/').pop()}['"]`).test(src) ||
      src.includes(`import('${d.file.replace(/^modules/, '../modules').replace(/\.ts$/, '')}`);
    const usa = new RegExp(`\\b${d.symbol}\\b`).test(src);
    if (importa || usa) {
      errors.push(
        `❌ DORMENTE RELIGADO: ${rel} referencia \`${d.symbol}\`. Esse repositório está ISENTO no schema-coherence (${d.allowlistId}) por estar SEM CALLER — a isenção é por CAMINHO DE ARQUIVO e não percebe o religamento, então o SQL fantasma de \`${d.ghostTable}\` volta a viver com o gate VERDE. EM VEZ: ${d.instead}.`
      );
    }
  }
}

if (errors.length > 0) {
  console.error('='.repeat(80));
  console.error('❌ GATE — ANTI-REVIVAL DE REPOSITÓRIO DORMENTE COM SQL FANTASMA: FALHOU');
  console.error('='.repeat(80));
  errors.forEach((e) => console.error(e));
  console.error('');
  process.exit(1);
}

console.log(
  `GATE OK [dormant-ghost-repository-antirevival] — ${DORMANT.length} repositório(s) dormente(s) isento(s) no schema-coherence seguem SEM CALLER; ` +
    'o SQL fantasma continua contido pela ausência de import, não pela allowlist. Religar = FAIL; consertar o arquivo = FAIL (para forçar a retirada da isenção e a descida real do teto).'
);
