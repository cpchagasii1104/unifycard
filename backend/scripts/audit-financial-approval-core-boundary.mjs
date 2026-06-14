#!/usr/bin/env node
// Guard estrutural — F-CORE-FINANCIAL-APPROVAL-MODEL (DECISION-0128).
//
// O Core de Aprovação Financeira (src/core/financial-approval/**) é NÃO-EXECUTOR: registra
// request/decision/governança, mas NÃO move dinheiro. Esta cerca FALHA (exit 1) se o Core:
//   (a) escrever bank_* (INSERT/UPDATE/DELETE);
//   (b) chamar executor financeiro (payout/transfer/reversal/settlement/cartão/ledger/Bank port);
//   (c) usar availableBalanceCents como entrada (autorização por read-model);
//   (d) referenciar can_execute_* (permissão de execução não mora no Core como grant);
//   (e) ler tenant/actor de req.body/req.query/req.params/actionContext (autoridade client-declared);
//   (f) importar módulo de Bank/payout/reversal (wiring de execução).
// Heurística file-level (sem AST) sobre o diretório do Core. Integrado em validate:regression-guards.

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const CORE_DIR = join(process.cwd(), 'src', 'core', 'financial-approval');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const FORBIDDEN = [
  { key: 'bank_* write', re: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+bank_[a-z_]+/i },
  { key: 'money executor call', re: /\b(executePayout|executeTransfer|executeReversal|requestAndExecuteReversalSync|executeActorWalletPayout|executeDisputeFinancialReversal|postLedger|debitLedger|creditLedger|settlePayout|authorizeCardPayment|drainRecoveryObligationsForCredit|debitActorWalletForRecovery)\s*\(/ },
  { key: 'Bank port / transaction service', re: /\bbankTransactionService\b|\btransactionService\.transfer\b|bankPortsRegistry/ },
  { key: 'availableBalanceCents as input', re: /availableBalanceCents/ },
  { key: 'can_execute_* reference', re: /can_execute_/ },
  { key: 'client-declared authority (req.body/query/params/actionContext)', re: /req\.body|req\.query|req\.params|actionContext/ },
  { key: 'import of Bank/payout/reversal module', re: /from\s+['"][^'"]*(unifybank|bank-transaction|\/payout|payout\.service|reversal\.service|bank-ledger|actor-wallet-payout)[^'"]*['"]/ },
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.ts$/.test(full)) files.push(full);
  }
  return files;
}

function runGuard() {
  const files = walk(CORE_DIR);
  if (files.length === 0) {
    console.error('GATE FAIL [financial-approval-core]: diretório do Core ausente — esperado src/core/financial-approval/.');
    process.exit(1);
  }
  const violations = [];
  for (const file of files) {
    const rel = file.replace(process.cwd(), '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const f of FORBIDDEN) {
      if (f.re.test(code)) violations.push({ rel, key: f.key });
    }
  }
  if (violations.length > 0) {
    console.error('GATE FAIL [financial-approval-core]: o Core de Aprovação NÃO pode executar dinheiro nem usar autoridade client-declared —');
    violations.forEach((v) => console.error(`  ❌ ${v.rel} → ${v.key}`));
    process.exit(1);
  }
  console.log(`[financial-approval-core] ${files.length} arquivo(s) do Core verificados: sem bank_* write, sem executor financeiro, sem availableBalanceCents, sem can_execute_*, sem req.body/query/params/actionContext, sem import de Bank/payout.`);
  console.log('GATE OK [financial-approval-core] — núcleo de aprovação é NÃO-EXECUTOR.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
