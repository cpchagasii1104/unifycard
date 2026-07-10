#!/usr/bin/env node
// Guard estrutural — F-BANK-SPLIT-PIPELINE-CONSOLIDATION-VIRGIN-SYSTEM (DECISION-0165, fatia 1F).
// Anti-revival dos caminhos financeiros paralelos/legados retirados nas fatias 1A..1E-2 (sistema virgem):
//   1A work-assignment split.service · 1B p2p_transfer+donation · 1C service_booking legado ·
//   1D event_ticket+ride_payment sinks · 1E-1/1b treasury workers gated · 1E-2 sweep de mortos.
// stripComments OBRIGATÓRIO: há refs legadas SÓ em comentário (nas próprias notas 1B/1C/1D) — o guard
// não pode confundi-las com código vivo. Heurística textual comment-stripped. NÃO altera runtime.
// Em validate:regression-guards (via agregador). Objetivo: SSOT financeiro sem segunda verdade —
// um só pipeline (economic_policy_engine decide → bank-transaction.service executa → bank_splits/ledger).

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
// Remove // e /* */ preservando :// de URLs (mesmo stripTs dos outros guards).
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const S = (rel) => join(ROOT, ...rel.split('/'));
const readStripped = (p) => stripTs(readFileSync(p, 'utf-8'));
const rel = (p) => p.replace(ROOT + sep, '');
const failures = [];

function walkTs(dir) {
  const out = [];
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (/\.ts$/.test(e) && !/\.d\.ts$/.test(e) && !/\.(test|spec)\.ts$/.test(e)) out.push(full);
  }
  return out;
}

// ── 1. P2P / donation (1B) ─────────────────────────────────────────────────
const P2P = S('src/core/unifybank/bank-p2p-transfer.service.ts');
if (!existsSync(P2P)) failures.push('1: bank-p2p-transfer.service.ts ausente.');
else {
  const s = readStripped(P2P);
  if (!/P2P_AND_DONATION_PAYMENT_RETIRED/.test(s)) failures.push('1: transferP2P perdeu o fail-closed P2P_AND_DONATION_PAYMENT_RETIRED.');
  if (/createTransactionWithSplit|getOrCreateAccount/.test(s)) failures.push('1: transferP2P voltou a alcançar createTransactionWithSplit/getOrCreateAccount (corpo legado reintroduzido).');
}
const MOD = S('src/core/unifybank/unifybank.module.ts');
if (existsSync(MOD)) {
  const s = readStripped(MOD);
  if (/register\(\s*bankP2PTransferRoutes/.test(s)) failures.push('1: rota bankP2PTransferRoutes RE-MONTADA (bloqueador nomeado /bank/p2p-transfer reaberto).');
  if (/register\(\s*donationRoutes/.test(s)) failures.push('1: rota donationRoutes RE-MONTADA (donation = HOLD).');
}

// ── 2. Work assignment (1A) ────────────────────────────────────────────────
for (const f of walkTs(S('src/modules/work'))) {
  const s = readStripped(f);
  if (/splitEngineService|applySplits|core\/economy\/split\.service/.test(s)) {
    failures.push(`2: ${rel(f)} reintroduziu splitEngineService/applySplits (caminho financeiro paralelo de work).`);
  }
}

// ── 3 + 4. Event/ride sinks aposentados + service_booking legado (1C/1D) ────
const BINT = S('src/modules/bank/bank-integration.service.ts');
if (!existsSync(BINT)) failures.push('3/4: bank-integration.service.ts ausente.');
else {
  const s = readStripped(BINT);
  for (const code of ['EVENT_TICKET_PAYMENT_RETIRED', 'EVENT_CONSUMPTION_PAYMENT_RETIRED', 'RIDE_PAYMENT_RETIRED']) {
    if (!s.includes(code)) failures.push(`3: sink perdeu o fail-closed ${code}.`);
  }
  if (/context:\s*'event_ticket'|context:\s*'ride_payment'|referenceType:\s*'ride_payment'/.test(s)) {
    failures.push('3: context event_ticket/ride_payment REINTRODUZIDO em bank-integration (split legado reaberto).');
  }
  if (/processServiceBookingPayment/.test(s)) failures.push('4: método legado processServiceBookingPayment REINTRODUZIDO.');
  if (!/processServicePaymentExecutionCanonical/.test(s)) failures.push('4: caminho CANÔNICO processServicePaymentExecutionCanonical SUMIU (não pode quebrar o canônico).');
  if (/resolveBankAccountForServiceActor\s*\(/.test(s)) failures.push('6: resolveBankAccountForServiceActor (helper morto) REINTRODUZIDO.');
}

// ── 5. Treasury workers gated (1E-1/1E-1b) ─────────────────────────────────
const BOOT = S('BOOT.ts');
if (!existsSync(BOOT)) failures.push('5: BOOT.ts ausente.');
else {
  const s = readStripped(BOOT);
  for (const [flag, start] of [
    ['ENABLE_TREASURY_SPLIT_WORKER', 'startTreasurySplitWorker('],
    ['ENABLE_TREASURY_DISTRIBUTION_WORKER', 'startTreasuryDistributionWorker('],
  ]) {
    const si = s.indexOf(start);
    if (si === -1) continue; // start removido = não boota = ok
    const gi = s.indexOf(flag);
    if (gi === -1 || gi > si) failures.push(`5: ${start} boota SEM gate ${flag} antes (worker de tesouraria ungated).`);
  }
}

// ── 6. Mortos removidos não voltam (1E-2) ──────────────────────────────────
for (const dead of ['src/jobs/post-event-split.job.ts', 'src/jobs/event-scheduler.ts', 'src/core/economy/split.service.ts']) {
  if (existsSync(S(dead))) failures.push(`6: arquivo morto REINTRODUZIDO: ${dead}.`);
}

if (failures.length) {
  console.error('GATE FAIL [bank-split-pipeline-consolidation]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [bank-split-pipeline-consolidation] — caminhos financeiros paralelos/legados seguem retirados: p2p/donation fail-closed+desmontados · work sem split.service · sinks event/ride RETIRED sem context legado · service_booking legado ausente + canônico preservado · treasury workers gated · mortos removidos. SSOT financeiro = um só pipeline.');
