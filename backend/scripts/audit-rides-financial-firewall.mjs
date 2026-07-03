#!/usr/bin/env node
// Guard estrutural — F-RIDES-FINANCIAL-FIREWALL (achado B1 do auditoria.md, Clayton aprovou
// adicionar o firewall, 2026-07-02).
//
// O trilho de rides era o ÚNICO com money-sink (processRidePayment → createTransactionWithExplicit
// SplitLines → bank_ledger) SEM firewall runtime — contido só por dead-code + guard anti-reativação
// (CI-time, camada única). Agora tem firewall RUNTIME default-off com GATE DUPLO (defesa-em-
// profundidade): no SINK (bankIntegrationService.processRidePayment) E no CALLER
// (distributionService.processRidePayment), espelhando o padrão checkout caller+sink.
//
// MORDE:
//   (A) o firewall rides-financial-firewall.ts sumir ou perder o flag/assert;
//   (B) o SINK (bank-integration.service.ts::processRidePayment) perder assertRidesFinancialRuntimeEnabled;
//   (C) o CALLER (distribution.service.ts::processRidePayment) perder assertRidesFinancialRuntimeEnabled;
//   (D) o flag deixar de ser estrito (=== 'true').
// Complementa (não substitui) audit-rides-money-antirevival-guard.mjs — aquele trava re-registro de
// rota morta; este trava o money-write ficar sem kill-switch runtime. Em validate:regression-guards.
// Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// (A) firewall existe, flag estrito, assert.
const FW = join(ROOT, 'src', 'core', 'rides', 'rides-financial-firewall.ts');
if (!existsSync(FW)) {
  failures.push(`firewall ausente: ${FW} — B1 reaberto (rides money sem kill-switch runtime).`);
} else {
  const src = stripTs(readFileSync(FW, 'utf-8'));
  if (!/RIDES_FINANCIAL_RUNTIME_ENABLED/.test(src)) failures.push(`${FW}: flag RIDES_FINANCIAL_RUNTIME_ENABLED ausente.`);
  if (!/=== 'true'/.test(src)) failures.push(`${FW}: flag não é estrito (=== 'true') — risco de fail-open por '1'/'TRUE'/'yes'.`);
  if (!/export function assertRidesFinancialRuntimeEnabled/.test(src)) failures.push(`${FW}: assertRidesFinancialRuntimeEnabled ausente.`);
  if (!/throw new AppError\(\s*403/.test(src)) failures.push(`${FW}: assert não lança 403 fail-closed.`);
}

// (B) SINK gated.
const SINK = join(ROOT, 'src', 'modules', 'bank', 'bank-integration.service.ts');
if (!existsSync(SINK)) {
  failures.push(`arquivo ausente: ${SINK}`);
} else {
  const src = stripTs(readFileSync(SINK, 'utf-8'));
  const idx = src.indexOf('async processRidePayment(');
  if (idx < 0) {
    failures.push(`${SINK}: processRidePayment não encontrado.`);
  } else {
    // corpo até a próxima declaração 'async ' de método
    const nextAsync = src.indexOf('\n  async ', idx + 1);
    const body = src.slice(idx, nextAsync > idx ? nextAsync : idx + 4000);
    if (!/assertRidesFinancialRuntimeEnabled\(/.test(body)) {
      failures.push(`${SINK}: processRidePayment (SINK, money-write via createTransactionWithExplicitSplitLines) não chama assertRidesFinancialRuntimeEnabled — B1 reaberto.`);
    }
  }
}

// (C) CALLER gated.
const CALLER = join(ROOT, 'src', 'modules', 'rides', 'distribution', 'distribution.service.ts');
if (!existsSync(CALLER)) {
  failures.push(`arquivo ausente: ${CALLER}`);
} else {
  const src = stripTs(readFileSync(CALLER, 'utf-8'));
  const idx = src.indexOf('async processRidePayment(');
  if (idx < 0) {
    failures.push(`${CALLER}: processRidePayment não encontrado.`);
  } else {
    const nextAsync = src.indexOf('\n  async ', idx + 1);
    const body = src.slice(idx, nextAsync > idx ? nextAsync : idx + 4000);
    if (!/assertRidesFinancialRuntimeEnabled\(/.test(body)) {
      failures.push(`${CALLER}: processRidePayment (CALLER) não chama assertRidesFinancialRuntimeEnabled — gate duplo (defesa-em-profundidade) quebrado.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [rides-financial-firewall]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [rides-financial-firewall] — rides money com firewall runtime default-off, gate DUPLO (sink bankIntegration.processRidePayment + caller distributionService.processRidePayment); flag estrito 403 fail-closed. Achado B1 do auditoria.md fechado (rides à paridade com os demais trilhos).');
