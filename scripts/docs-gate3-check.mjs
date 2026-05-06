#!/usr/bin/env node
/**
 * docs-gate3-check.mjs
 *
 * Verificação automatizada do Gate 3 — Remoção de Escritas Proibidas.
 * Critérios extraídos de GATES.md §GATE 3.
 *
 * Pré-condição: Gate A deve estar FECHADO (verificado aqui).
 *
 * Uso: node scripts/docs-gate3-check.mjs
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

function locate(filename) {
  for (const dir of [NORMATIVE, SSOT]) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Pré-condição: Gate A fechado ──────────────────────────────────────────

function checkPrerequisiteGateA() {
  const label = 'Pré-condição — Gate A está FECHADO';
  const gatesPath = path.join(SSOT, 'GATES.md');

  if (!fs.existsSync(gatesPath)) {
    FAIL(label, 'GATES.md não encontrado');
    return false;
  }

  const content = read(gatesPath);

  if (/A EXECUTAR.*BLOQUEANTE|BLOQUEANTE.*A EXECUTAR/i.test(content)) {
    FAIL(label, 'Gate A ainda está em aberto — Gate 3 não pode ser validado sem Gate A fechado');
    return false;
  }

  if (/Gate A.*FECHADO|FECHADO.*Gate A/i.test(content)) {
    PASS(label);
    return true;
  }

  FAIL(label, 'Status do Gate A em GATES.md é ambíguo — verificar GATES.md manualmente');
  return false;
}

// ─── Critério 1: GATE_3_REVIEW.md existe e está validado ──────────────────

function checkGate3Review() {
  const label = 'Critério 1 — GATE_3_REVIEW.md existe e está validado pós Gate A';
  const filePath = locate('GATE_3_REVIEW.md');

  if (!filePath) {
    FAIL(label, 'GATE_3_REVIEW.md não encontrado');
    return;
  }

  const content = read(filePath);

  // Não deve mais estar com status pendente
  if (/PENDENTE REVALIDA/i.test(content)) {
    FAIL(label, 'GATE_3_REVIEW.md ainda marcado como PENDENTE REVALIDAÇÃO — revalidar após Gate A');
    return;
  }

  if (/VALIDADO P.S GATE A/i.test(content) || /FECHADO.*VALIDADO/i.test(content)) {
    PASS(label);
  } else {
    WARN(label, 'Status de GATE_3_REVIEW.md não é explicitamente "VALIDADO PÓS GATE A" — verificar');
  }
}

// ─── Critério 2: GATE_3_EXECUTION.md existe ───────────────────────────────

function checkGate3Execution() {
  const label = 'Critério 2 — GATE_3_EXECUTION.md existe (plano de execução)';
  const filePath = locate('GATE_3_EXECUTION.md');

  if (!filePath) {
    FAIL(label, 'GATE_3_EXECUTION.md não encontrado');
    return;
  }

  const content = read(filePath);
  if (content.trim().length < 200) {
    FAIL(label, 'GATE_3_EXECUTION.md está vazio ou incompleto');
  } else {
    PASS(label);
  }
}

// ─── Critério 3: IMPACT_MATRIX.md existe ──────────────────────────────────

function checkImpactMatrix() {
  const label = 'Critério 3 — IMPACT_MATRIX.md existe (escopo forense)';
  const filePath = locate('IMPACT_MATRIX.md');

  if (!filePath) {
    FAIL(label, 'IMPACT_MATRIX.md não encontrado');
    return;
  }

  const content = read(filePath);
  if (content.trim().length < 200) {
    FAIL(label, 'IMPACT_MATRIX.md está vazio ou incompleto');
  } else {
    PASS(label);
  }
}

// ─── Critério 4: WRITE_SURFACE_BASELINE.md existe ─────────────────────────

function checkWriteSurface() {
  const label = 'Critério 4 — WRITE_SURFACE_BASELINE.md existe (baseline de comparação)';
  const filePath = locate('WRITE_SURFACE_BASELINE.md');

  if (!filePath) {
    FAIL(label, 'WRITE_SURFACE_BASELINE.md não encontrado');
    return;
  }

  const content = read(filePath);
  if (content.trim().length < 200) {
    FAIL(label, 'WRITE_SURFACE_BASELINE.md está vazio ou incompleto');
  } else {
    PASS(label);
  }
}

// ─── Critério 5: GATES.md marca Gate 3 como FECHADO pós Gate A ────────────

function checkGate3Status() {
  const label = 'Critério 5 — GATES.md marca Gate 3 como FECHADO · VALIDADO PÓS GATE A';
  const gatesPath = path.join(SSOT, 'GATES.md');
  if (!fs.existsSync(gatesPath)) return; // já falhou na pré-condição

  const content = read(gatesPath);

  if (/VALIDADO P.S GATE A/i.test(content)) {
    PASS(label);
  } else if (/FECHADO.*PASSOU TECNICAMENTE/i.test(content)) {
    FAIL(label, 'Gate 3 ainda marcado como "PASSOU TECNICAMENTE" — revalidação pós Gate A não registrada');
  } else {
    WARN(label, 'Status do Gate 3 em GATES.md não é explicitamente "VALIDADO PÓS GATE A"');
  }
}

// ─── Critério 6: FL-005 resolvido no FALSIFICATION_LOG ────────────────────

function checkFL005() {
  const label = 'Critério 6 — FL-005 marcado como RESOLVIDO em FALSIFICATION_LOG.md';
  const filePath = path.join(SSOT, 'FALSIFICATION_LOG.md');

  if (!fs.existsSync(filePath)) {
    FAIL(label, 'FALSIFICATION_LOG.md não encontrado');
    return;
  }

  const content = read(filePath);

  if (!content.includes('FL-005')) {
    FAIL(label, 'Entrada FL-005 não encontrada no log');
    return;
  }

  if (/FL-005.*RESOLVIDO|RESOLVIDO.*FL-005/i.test(content)) {
    PASS(label);
  } else if (/PENDENTE REVALIDA/i.test(content)) {
    FAIL(label, 'FL-005 ainda marcado como PENDENTE — registrar resolução após Gate A fechado');
  } else {
    WARN(label, 'FL-005 existe mas não está explicitamente marcado como RESOLVIDO');
  }
}

// ─── Critério 7: Sem writers proibidos detectáveis (heurística) ────────────

function checkNoProhibitedWriters() {
  const label = 'Critério 7 — Nenhum writer proibido óbvio em banco/ssot fora do módulo bank/';

  // Heurística: verificar se PROHIBITED_STRUCTURES.md existe e tem conteúdo
  const psPath = locate('PROHIBITED_STRUCTURES.md');
  if (!psPath) {
    WARN(label, 'PROHIBITED_STRUCTURES.md não encontrado — impossível verificar escopo de proibições');
    return;
  }

  // Verificar se WRITE_SURFACE_BASELINE tem registro de "zero" ou "nenhum"
  const baselinePath = locate('WRITE_SURFACE_BASELINE.md');
  if (baselinePath) {
    const content = read(baselinePath);
    if (/nenhum|zero|removido|eliminado/i.test(content)) {
      PASS(`${label} (baseline confirma remoção)`);
    } else {
      WARN(label, 'WRITE_SURFACE_BASELINE.md não confirma explicitamente remoção de todos os writers — verificar manualmente');
    }
  } else {
    WARN(label, 'WRITE_SURFACE_BASELINE.md ausente — evidência de remoção não verificável automaticamente');
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────

function main() {
  console.log('');
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log(BOLD('  docs-gate3-check — Gate 3: Remoção de Escritas Proibidas'));
  console.log(BOLD('══════════════════════════════════════════════════════'));
  console.log('');

  const gateAOk = checkPrerequisiteGateA();

  if (!gateAOk) {
    console.log('');
    console.log(RED(BOLD('  PRÉ-CONDIÇÃO FALHOU — Gate A não está fechado')));
    console.log(DIM('  Execute e feche Gate A antes de revalidar Gate 3.'));
    console.log(DIM('  Comando: npm run docs:gateA:check'));
    console.log('');
    process.exit(1);
  }

  checkGate3Review();
  checkGate3Execution();
  checkImpactMatrix();
  checkWriteSurface();
  checkGate3Status();
  checkFL005();
  checkNoProhibitedWriters();

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
    console.log(RED(BOLD('  GATE 3 → FALHOU')));
    console.log(DIM('  Gate 3 não pode ser considerado normativo até todos os critérios passarem.'));
    console.log('');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(YELLOW(BOLD('  GATE 3 → PASSA COM RESSALVAS')));
    console.log(DIM('  Resolver os warnings antes de considerar Gate 3 definitivamente fechado.'));
    console.log('');
    process.exit(0);
  } else {
    console.log(GREEN(BOLD('  GATE 3 → PASSOU')));
    console.log(DIM('  Gate 3 validado normativamente. FL-005 resolvido.'));
    console.log(DIM('  Próximo passo: Gates 1, 2, 4, 5 (em ordem de precedência).'));
    console.log('');
    process.exit(0);
  }
}

main();
