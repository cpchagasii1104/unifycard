#!/usr/bin/env node
// Guard estrutural — F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL (DECISION-0128).
//
// O worker de payout de PRODUÇÃO é canônico/system-only: consome SOMENTE actor_wallet_payout_requests
// 'approved' e chama o executor SELADO executeActorWalletPayout. FALHA (exit 1) se:
//   (a) o worker canônico usar seller_available/seller_payout/payout_requests legado/bank_settlements como executor;
//   (b) chamar bankTransactionService.transfer direto / escrever bank_* / usar availableBalanceCents;
//   (c) não consumir actor_wallet_payout_requests='approved' ou não chamar executeActorWalletPayout;
//   (d) não ser default-off (isFinancialWorkerEnabled) / habilitar por NODE_ENV / fail-open / ter HTTP/req.*;
//   (e) BOOT iniciar o worker LEGADO startPayoutWorker (em vez do canônico startActorWalletPayoutWorker gateado);
//   (f) o legado startPayoutWorker NÃO estar tombstoned (voltar a setInterval/runPayoutCycle);
//   (g) baseline 0113 regredir (bank-http/payout fora de SAFE_SUBJECT_READERS / voltar ao BASELINE).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BASELINE, SAFE_SUBJECT_READERS } from './audit-actor-authority-boundary.mjs';

const ROOT = process.cwd();
const W = join(ROOT, 'src', 'workers', 'actor-wallet-payout-worker.ts');
const LEGACY = join(ROOT, 'src', 'workers', 'payout-worker.ts');
const BOOT = join(ROOT, 'BOOT.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];

  // ── worker canônico ──────────────────────────────────────────────────────────
  if (!existsSync(W)) {
    failures.push('worker canônico actor-wallet-payout-worker.ts ausente.');
  } else {
    const code = stripComments(readFileSync(W, 'utf8'));
    // (a) legado/seller
    for (const t of ['seller_available', 'seller_payout']) {
      if (new RegExp(t).test(code)) failures.push(`worker canônico referencia ${t} (legado) — proibido.`);
    }
    if (/\bpayout_requests\b/.test(code)) failures.push('worker canônico referencia payout_requests legado — proibido.');
    // (b) Bank direto
    if (/\bbankTransactionService\b/.test(code)) failures.push('worker canônico chama bankTransactionService direto — só via executeActorWalletPayout.');
    if (/(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i.test(code)) failures.push('worker canônico escreve bank_* direto — proibido.');
    if (/availableBalanceCents/.test(code)) failures.push('worker canônico usa availableBalanceCents.');
    // (c) trilho + executor
    if (!/actor_wallet_payout_requests/.test(code)) failures.push('worker canônico não consome actor_wallet_payout_requests.');
    if (!/status\s*=\s*'approved'/.test(code) && !/'approved'/.test(code)) failures.push("worker canônico não filtra status='approved'.");
    if (!/\bexecuteActorWalletPayout\s*\(/.test(code)) failures.push('worker canônico não chama executeActorWalletPayout (executor selado).');
    // (d) default-off / sem NODE_ENV / sem HTTP
    if (!/isFinancialWorkerEnabled\(\s*['"]ENABLE_PAYOUT_WORKER['"]\s*\)/.test(code)) failures.push('worker canônico não é gateado por isFinancialWorkerEnabled(ENABLE_PAYOUT_WORKER).');
    if (/NODE_ENV/.test(code)) failures.push('worker canônico referencia NODE_ENV (auto-enable proibido).');
    if (/req\.body|req\.query|req\.actionContext|['"]x-actor-id['"]|can_execute_/.test(code)) failures.push('worker canônico usa autoridade client-declared / can_execute_*.');
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────────
  if (existsSync(BOOT)) {
    const boot = stripComments(readFileSync(BOOT, 'utf8'));
    if (!/startActorWalletPayoutWorker\s*\(\s*\)/.test(boot)) {
      failures.push('BOOT não inicia o worker canônico startActorWalletPayoutWorker.');
    }
    // BOOT não pode chamar o worker legado.
    if (/\bstartPayoutWorker\s*\(\s*\)/.test(boot)) {
      failures.push('BOOT chama o worker LEGADO startPayoutWorker — deve usar o canônico.');
    }
    // o startActorWalletPayoutWorker precisa estar gateado por ENABLE_PAYOUT_WORKER.
    const m = boot.match(/startActorWalletPayoutWorker\s*\(\s*\)/);
    if (m) {
      const before = boot.slice(Math.max(0, m.index - 400), m.index);
      if (!/isFinancialWorkerEnabled\(\s*['"]ENABLE_PAYOUT_WORKER['"]\s*\)/.test(before)) {
        failures.push('startActorWalletPayoutWorker não está gateado por isFinancialWorkerEnabled(ENABLE_PAYOUT_WORKER) no BOOT.');
      }
    }
  }

  // ── legado tombstoned ────────────────────────────────────────────────────────
  if (existsSync(LEGACY)) {
    const legacy = readFileSync(LEGACY, 'utf8');
    const startBody = (legacy.match(/export function startPayoutWorker\(\)\s*:\s*void\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
    const startCode = stripComments(startBody);
    if (/setInterval\s*\(/.test(startCode) || /\brunPayoutCycle\s*\(/.test(startCode)) {
      failures.push('legado startPayoutWorker voltou a iniciar ciclo/interval (deve ser tombstone no-op).');
    }
  }

  // ── baseline 0113 íntegro ────────────────────────────────────────────────────
  if ('core/unifybank/bank-http.routes.ts' in BASELINE || 'modules/payout/payout.routes.ts' in BASELINE) {
    failures.push('baseline 0113 regrediu: bank-http/payout voltou ao BASELINE.');
  }
  if (!('core/unifybank/bank-http.routes.ts' in SAFE_SUBJECT_READERS) || !('modules/payout/payout.routes.ts' in SAFE_SUBJECT_READERS)) {
    failures.push('bank-http/payout saiu de SAFE_SUBJECT_READERS — regressão de selo.');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [payout-worker-system-only]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[payout-worker-system-only] worker canônico consome actor_wallet_payout_requests approved → executeActorWalletPayout; sem seller_available/payout_requests/bank direto/availableBalanceCents; default-off (ENABLE_PAYOUT_WORKER); BOOT usa canônico gateado; legado tombstoned; baseline 0113 íntegro.');
  console.log('GATE OK [payout-worker-system-only] — worker de payout system-only, default-off, no trilho canônico.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
