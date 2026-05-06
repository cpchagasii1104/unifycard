#!/usr/bin/env node
/**
 * Valida ordem e invariantes do registo EXEC-* em STATUS_EXECUCAO.md
 * Uso: node scripts/validate-execution-order.mjs
 * EXEC_STRICT=1 — falha se a secção do registo não existir
 */
import { parseExecRegistry } from './execution-guard/parse-exec-registry.mjs';
import { EXEC_ORDER } from './execution-guard/exec-order.mjs';

const strict = process.env.EXEC_STRICT === '1';

const { rows, foundSection } = parseExecRegistry();

if (!foundSection) {
  const msg = '[execution-order] Secção "## Registo de tasks EXEC-*" não encontrada em STATUS_EXECUCAO.md';
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.log(`${msg} — SKIP (defina EXEC_STRICT=1 para obrigar)`);
  process.exit(0);
}

if (rows.length === 0) {
  console.log('[execution-order] Tabela EXEC vazia — SKIP (sem linhas de dados)');
  process.exit(0);
}

const byTask = new Map(rows.map((r) => [r.task, r]));
const norm = (s) => s.trim().toUpperCase();

const inProgress = rows.filter((r) => norm(r.state) === 'IN_PROGRESS');
if (inProgress.length > 1) {
  console.error('[execution-order] FAIL: mais de uma task IN_PROGRESS:', inProgress.map((r) => r.task).join(', '));
  process.exit(1);
}

for (const r of rows) {
  if (!EXEC_ORDER.includes(r.task)) {
    console.error(`[execution-order] FAIL: task desconhecida (fora da ordem canónica): ${r.task}`);
    process.exit(1);
  }
}

for (let i = 0; i < EXEC_ORDER.length; i++) {
  const task = EXEC_ORDER[i];
  const row = byTask.get(task);
  if (!row) continue;
  const st = norm(row.state);
  if (st === 'DONE') {
    for (let k = 0; k < i; k++) {
      const prev = EXEC_ORDER[k];
      const pr = byTask.get(prev);
      if (!pr) {
        console.error(`[execution-order] FAIL: ${task} está DONE mas falta linha para predecessor ${prev}`);
        process.exit(1);
      }
      if (norm(pr.state) !== 'DONE') {
        console.error(`[execution-order] FAIL: ${task} está DONE mas ${prev} não está DONE (${pr.state})`);
        process.exit(1);
      }
    }
  }
}

if (inProgress.length === 1) {
  const t = inProgress[0].task;
  const idx = EXEC_ORDER.indexOf(t);
  for (let k = 0; k < idx; k++) {
    const prev = EXEC_ORDER[k];
    const pr = byTask.get(prev);
    if (!pr || norm(pr.state) !== 'DONE') {
      console.error(`[execution-order] FAIL: ${t} IN_PROGRESS mas predecessor ${prev} não está DONE`);
      process.exit(1);
    }
  }
}

console.log('[execution-order] PASS');
process.exit(0);
