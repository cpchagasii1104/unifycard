#!/usr/bin/env node
/**
 * docs-gateA-check.mjs
 *
 * Verificação automatizada do Gate A — Autoridade Constitucional.
 * Critérios extraídos de GATES.md §GATE A.
 *
 * PASS/FAIL binário. Sem interpretação. Sem exceção.
 *
 * Uso: node scripts/docs-gateA-check.mjs
 * Exit code: 0 = PASS, 1 = FAIL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NORMATIVE = path.join(ROOT, 'docs', '01_normative');
const SSOT = path.join(ROOT, 'docs', 'ssot');

const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const DIM    = (s) => `\x1b[2m${s}\x1b[0m`;

const failures = [];
const warnings = [];
const passes   = [];

function PASS(label) { passes.push(label); }
function FAIL(label, detail) { failures.push({ label, detail }); }
function WARN(label, detail) { warnings.push({ label, detail }); }

// ─── Helpers ───────────────────────────────────────────────────────────────

function locate(filename) {
  // Procurar em 01_normative e ssot
  const candidates = [
    path.join(NORMATIVE, filename),
    path.join(SSOT, filename),
  ];
  return candidates.find(fs.existsSync) || null;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function containsAll(content, terms) {
  return terms.filter((t) => !content.includes(t));
}

function containsAny(content, patterns) {
  return patterns.filter((p) => {
    const re = typeof p === 'string' ? new RegExp(p, 'i') : p;
    return re.test(content);
  });
}

// ─── Critério 1: AUTHORITY_LAW.md existe ──────────────────────────────────

function checkAuthorityLaw() {
  const label = 'Critério 1 — AUTHORITY_LAW.md existe e está estruturado';
  const filePath = locate('AUTHORITY_LAW.md');

  if (!filePath) {
    FAIL(label, 'Arquivo AUTHORITY_LAW.md não encontrado em 01_normative/ ou ssot/');
    return;
  }

  const content = read(filePath);

  // Deve ter artigos numerados OU seções estruturadas
  const hasArticles = /Art(igo)?\s*\d+|##\s+\d+\.|^#{1,3}\s+[A-Z]/m.test(content);
  if (!hasArticles) {
    FAIL(label, 'Não há artigos numerados ou seções estruturadas detectáveis');
    return;
  }

  // Não pode ter ambiguidades abertas (TODO, TBD, A DEFINIR)
  const ambiguities = containsAny(content, [
    /\bTODO\b/i, /\bTBD\b/i, /a definir/i, /a ser definido/i,
    /pendente de definição/i, /\bWIP\b/i,
  ]);
  if (ambiguities.length > 0) {
    FAIL(label, `Ambiguidades abertas detectadas: ${ambiguities.join(', ')}`);
    return;
  }

  PASS(label);
}

// ─── Critério 2: Anexos Constitucionais existem ───────────────────────────

const REQUIRED_ANNEXES = [
  'AUTHORITY_ANNEX_IRREVERSIBLE_ACTIONS.md',
  'AUTHORITY_ANNEX_EVASION.md',
  'AUTHORITY_ANNEX_TEST_OF_BREAK.md',
];

function checkAnnexes() {
  for (const annex of REQUIRED_ANNEXES) {
    const label = `Critério 2 — ${annex} existe`;
    const filePath = locate(annex);

    if (!filePath) {
      FAIL(label, `Arquivo ${annex} não encontrado`);
    } else {
      const content = read(filePath);
      if (content.trim().length < 200) {
        FAIL(label, `${annex} existe mas está vazio ou mínimo (< 200 chars)`);
      } else {
        PASS(label);
      }
    }
  }
}

// ─── Critério 3: Conteúdo Obrigatório na Lei ──────────────────────────────

const REQUIRED_CONCEPTS = [
  { term: 'CPF',                        desc: 'raiz humana irrenunciável (CPF)' },
  { term: 'Permissão',                  desc: 'separação Autoridade × Permissão' },
  { term: 'ATL',                        desc: 'ATL determinístico e não-configurável' },
  { term: 'quarentena',                 desc: 'quarentena sem exceção' },
  { term: 'responsabilidade',           desc: 'responsabilidade econômica única' },
  { term: 'kill switch',                desc: 'IA com kill switch' },
  { term: 'tentativa',                  desc: 'tentativa = violação consumada' },
  { term: 'precedência',                desc: 'ordem de precedência entre travas' },
  { term: 'herança',                    desc: 'herança de ATL por associação' },
  { term: 'guarda',                     desc: 'guarda sem cadeia e com responsabilidade solidária' },
];

function checkLawContent() {
  const label = 'Critério 3 — Conteúdo obrigatório da Lei';
  const filePath = locate('AUTHORITY_LAW.md');
  if (!filePath) return; // já falhou no Critério 1

  const contentLower = read(filePath).toLowerCase();
  const missing = REQUIRED_CONCEPTS.filter(({ term }) => !contentLower.includes(term.toLowerCase()));

  if (missing.length > 0) {
    FAIL(label, `Conceitos obrigatórios ausentes: ${missing.map((m) => m.desc).join('; ')}`);
  } else {
    PASS(label);
  }
}

// ─── Critério 4: Teste de Falsificação ────────────────────────────────────

function checkFalsificationTest() {
  const label = 'Critério 4 — AUTHORITY_ANNEX_TEST_OF_BREAK.md tem ≥ 20 cenários';
  const filePath = locate('AUTHORITY_ANNEX_TEST_OF_BREAK.md');
  if (!filePath) return; // já falhou no Critério 2

  const content = read(filePath);

  // Contar cenários numerados (## 1., Cenário 1, Teste 1, etc.)
  const scen = content.match(/(?:Cen[aá]rio|Teste|CENÁRIO|TESTE)\s*\d+|^#{1,4}\s+\d+\b/gm) || [];

  // Alternativa: contar listas ordenadas ou itens que parecem cenários
  const numberedItems = content.match(/^\d+\.\s+\*\*|^##\s+\d+\./gm) || [];
  const total = Math.max(scen.length, numberedItems.length);

  if (total < 20) {
    FAIL(
      label,
      `Detectados ${total} cenários (mínimo: 20). Verificar formato — o script procura headings numerados ou listas ordenadas.`
    );
  } else {
    PASS(`${label} (${total} detectados)`);
  }

  // Verificar se AUTHORITY_LAW.md bloqueia os cenários explicitamente
  const lawPath = locate('AUTHORITY_LAW.md');
  if (lawPath) {
    const lawContent = read(lawPath);
    // Verificar se a lei referencia o test break ou os cenários
    if (!lawContent.includes('AUTHORITY_ANNEX_TEST_OF_BREAK') && !lawContent.includes('TEST_OF_BREAK')) {
      WARN(
        'Critério 4 — Cross-reference Lei → Teste de Falsificação',
        'AUTHORITY_LAW.md não referencia explicitamente AUTHORITY_ANNEX_TEST_OF_BREAK.md — cobertura de cenários não verificável automaticamente'
      );
    }
  }
}

// ─── Critério 5: Status do Gate A em GATES.md ─────────────────────────────

function checkGateAStatus() {
  const label = 'Critério 5 — Gate A não está em aberto (BLOQUEANTE)';
  const filePath = locate('GATES.md') || path.join(SSOT, 'GATES.md');

  if (!fs.existsSync(filePath)) {
    FAIL(label, 'GATES.md não encontrado');
    return;
  }

  const content = read(filePath);

  // Gate A deve estar fechado
  if (/A EXECUTAR.*BLOQUEANTE|BLOQUEANTE.*A EXECUTAR/i.test(content)) {
    FAIL(label, 'Gate A ainda está marcado como "A EXECUTAR (BLOQUEANTE)" — Gate A não foi executado');
    return;
  }

  if (/Gate A.*FECHADO|FECHADO.*Gate A/i.test(content)) {
    PASS(`${label} — Gate A marcado como FECHADO`);
  } else {
    WARN(label, 'Status do Gate A em GATES.md é ambíguo — não é FECHADO nem "A EXECUTAR (BLOQUEANTE)"');
  }
}

// ─── Critério 6: FALSIFICATION_LOG existe e tem entradas ──────────────────

function checkFalsificationLog() {
  const label = 'Critério 6 — FALSIFICATION_LOG.md existe e está ativo';
  const filePath = path.join(SSOT, 'FALSIFICATION_LOG.md');

  if (!fs.existsSync(filePath)) {
    FAIL(label, 'FALSIFICATION_LOG.md não encontrado');
    return;
  }

  const content = read(filePath);
  const entries = content.match(/^## ENTRADA FL-\d+/gm) || [];

  if (entries.length === 0) {
    FAIL(label, 'Nenhuma entrada FL-NNN encontrada no log');
  } else {
    PASS(`${label} (${entries.length} entradas registradas)`);
  }

  // Verificar se a anomalia FL-005 está resolvida ou pendente
  if (content.includes('FL-005') && content.includes('PENDENTE REVALIDAÇÃO')) {
    WARN(
      'Critério 6 — FL-005 pendente',
      'Anomalia FL-005 (violação de ordem de Gates) ainda não resolvida — Gate A precisa fechar para liberar Gate 3'
    );
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────

function main() {
  console.log('');
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log(BOLD('  docs-gateA-check — Gate A: Autoridade Constitucional'));
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log('');

  checkAuthorityLaw();
  checkAnnexes();
  checkLawContent();
  checkFalsificationTest();
  checkGateAStatus();
  checkFalsificationLog();

  // ── Relatório
  console.log(BOLD('▸ Resultados'));
  for (const label of passes) {
    console.log(`  ${GREEN('✔')} ${label}`);
  }
  for (const { label, detail } of warnings) {
    console.log(`  ${YELLOW('⚠')} ${label}`);
    console.log(`    ${DIM(detail)}`);
  }
  for (const { label, detail } of failures) {
    console.log(`  ${RED('✖')} ${label}`);
    console.log(`    ${DIM(detail)}`);
  }

  console.log('');
  console.log(BOLD('▸ Resumo'));
  console.log(`  PASS    : ${GREEN(String(passes.length))}`);
  console.log(`  WARN    : ${warnings.length > 0 ? YELLOW(String(warnings.length)) : String(warnings.length)}`);
  console.log(`  FAIL    : ${failures.length > 0 ? RED(String(failures.length)) : String(failures.length)}`);
  console.log('');

  if (failures.length > 0) {
    console.log(RED(BOLD('  GATE A → FALHOU')));
    console.log(DIM('  Todos os Gates dependentes (0, 1, 2, 3, 4, 5) permanecem inválidos.'));
    console.log('');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(YELLOW(BOLD('  GATE A → PASSA COM RESSALVAS')));
    console.log(DIM('  Resolver os warnings antes de marcar Gate A como FECHADO definitivo.'));
    console.log('');
    process.exit(0);
  } else {
    console.log(GREEN(BOLD('  GATE A → PASSOU')));
    console.log(DIM('  Todos os critérios verificados. Gate A pode ser marcado como FECHADO.'));
    console.log(DIM('  Próximo passo: revalidar Gate 3 (FL-005) e fechar GATES.md.'));
    console.log('');
    process.exit(0);
  }
}

main();
