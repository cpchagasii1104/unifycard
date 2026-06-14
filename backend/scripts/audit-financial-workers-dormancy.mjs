#!/usr/bin/env node
// Guard estrutural — F-FINANCIAL-WORKERS-STRUCTURAL-DORMANCY-SEAL (DECISION-0128).
//
// Os 3 workers financeiros que movem dinheiro (payout / reversal / bank-settlement) NÃO podem
// iniciar no BOOT por padrão enquanto o Core EXECUTION estiver em HOLD. Esta cerca FALHA (exit 1) se:
//   (a) BOOT.ts chamar start{Payout,Reversal,BankSettlement}Worker() SEM o gate isFinancialWorkerEnabled(...);
//   (b) o helper de gate (financial-worker-gate.ts) deixar de ser DEFAULT-OFF estrito (=== 'true');
//   (c) houver auto-enable por NODE_ENV ou fail-open (!== 'false' / ?? true);
//   (d) um producer de payout_requests/bank_settlements aparecer em rota HTTP (*.routes.ts).
// Heurística file-level. Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const BOOT = join(ROOT, 'BOOT.ts');
const GATE = join(ROOT, 'src', 'workers', 'financial-worker-gate.ts');
const SRC = join(ROOT, 'src');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const WORKERS = [
  { start: 'startPayoutWorker', flag: 'ENABLE_PAYOUT_WORKER' },
  // canônico (F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL): mesmo flag default-off; o legado startPayoutWorker é tombstone.
  { start: 'startActorWalletPayoutWorker', flag: 'ENABLE_PAYOUT_WORKER' },
  { start: 'startReversalWorker', flag: 'ENABLE_REVERSAL_WORKER' },
  { start: 'startBankSettlementWorker', flag: 'ENABLE_BANK_SETTLEMENT_WORKER' },
];

function walkRoutes(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { if (e !== 'node_modules') walkRoutes(full, files); }
    else if (extname(full) === '.ts' && full.endsWith('.routes.ts')) files.push(full);
  }
  return files;
}

function runGuard() {
  const failures = [];

  // (b/c) helper default-off estrito
  if (!existsSync(GATE)) {
    failures.push('financial-worker-gate.ts ausente — gate de dormência removido.');
  } else {
    const gate = stripComments(readFileSync(GATE, 'utf8'));
    if (!/process\.env\[flag\]\s*===\s*'true'/.test(gate) && !/process\.env\[[A-Za-z]+\]\s*===\s*'true'/.test(gate)) {
      failures.push('financial-worker-gate.ts não é DEFAULT-OFF estrito (esperado process.env[flag] === \'true\').');
    }
    if (/NODE_ENV/.test(gate)) failures.push('financial-worker-gate.ts referencia NODE_ENV (auto-enable proibido).');
    if (/!==\s*'false'|\?\?\s*true|\|\|\s*true/.test(gate)) failures.push('financial-worker-gate.ts tem semântica fail-open (!== \'false\' / ?? true / || true).');
  }

  // (a) BOOT gateia cada worker
  if (!existsSync(BOOT)) {
    failures.push('BOOT.ts (raiz) ausente.');
  } else {
    const boot = stripComments(readFileSync(BOOT, 'utf8'));
    for (const w of WORKERS) {
      const callRe = new RegExp(`\\b${w.start}\\s*\\(\\s*\\)`, 'g');
      let m;
      let found = 0;
      while ((m = callRe.exec(boot)) !== null) {
        found++;
        // o gate da flag deve aparecer ANTES da chamada, dentro da janela do bloco (~400 chars).
        const before = boot.slice(Math.max(0, m.index - 400), m.index);
        if (!new RegExp(`isFinancialWorkerEnabled\\(\\s*['"]${w.flag}['"]\\s*\\)`).test(before)) {
          failures.push(`BOOT chama ${w.start}() SEM o gate isFinancialWorkerEnabled('${w.flag}') imediatamente antes — start financeiro incondicional.`);
        }
      }
      if (found === 0) {
        // ok: worker pode ter sido removido/tombstoned; mas então o gate da flag não deve estar pendurado sozinho de forma enganosa.
        continue;
      }
    }
    // NODE_ENV não pode habilitar os workers financeiros no BOOT.
    for (const w of WORKERS) {
      const re = new RegExp(`NODE_ENV[^\\n]*${w.flag}|${w.flag}[^\\n]*NODE_ENV`);
      if (re.test(boot)) failures.push(`BOOT auto-habilita ${w.flag} via NODE_ENV — proibido.`);
    }
  }

  // (d) nenhum producer de payout_requests/bank_settlements em rota HTTP
  for (const f of walkRoutes(SRC)) {
    const code = stripComments(readFileSync(f, 'utf8'));
    if (/\bcreatePayoutRequest\s*\(/.test(code)) {
      failures.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} chama createPayoutRequest (producer de payout_requests) em rota HTTP — proibido.`);
    }
    if (/\bcreateBankSettlement\s*\(/.test(code)) {
      failures.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} chama createBankSettlement (producer de bank_settlements) em rota HTTP — proibido.`);
    }
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [financial-workers-dormancy]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[financial-workers-dormancy] payout/reversal/bank-settlement workers gateados default-off (ENABLE_*_WORKER===\'true\' estrito; sem NODE_ENV auto-enable; sem fail-open); nenhum producer de payout_requests/bank_settlements em rota HTTP.');
  console.log('GATE OK [financial-workers-dormancy] — workers financeiros NÃO iniciam por padrão (Core EXECUTION HOLD).');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
