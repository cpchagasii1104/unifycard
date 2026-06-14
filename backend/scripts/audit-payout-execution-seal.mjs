#!/usr/bin/env node
// Guard estrutural — F-PAYOUT-EXECUTION-SEAL (DECISION-0128).
//
// Sela a execução real de payout sobre o trilho canônico actor_wallet_payout_requests.
// Alvo: src/modules/wallet/actor-wallet-payout.service.ts (request F2 + approve bridge + execute F3).
// FALHA (exit 1) se o executor:
//   (a) ler/escrever approval_requests por SQL CRU (deve ser via Core: insert/findApprovalRequestByIdTx);
//   (b) escrever bank_* direto (INSERT/UPDATE) — Bank só via port/transfer;
//   (c) usar seller_available como trilho/autorização;
//   (d) usar can_execute_* ou autoridade client-declared (req.body/query/actionContext);
//   (e) faltar: leitura/criação de approval via Core, bridge via recordFinancialApprovalDecision,
//       FOR UPDATE no payout_request, drain de recovery, transfer via BankTransactionPort com referenceType.
//   (f) ser exposto por HTTP (executeActorWalletPayout/approveActorWalletPayout em *.routes.ts);
//   (g) ser auto-iniciado no BOOT (chamado em BOOT.ts).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const SVC = join(ROOT, 'src', 'modules', 'wallet', 'actor-wallet-payout.service.ts');
const BOOT = join(ROOT, 'BOOT.ts');
const SRC = join(ROOT, 'src');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

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
  if (!existsSync(SVC)) {
    console.error('GATE FAIL [payout-execution-seal]: actor-wallet-payout.service.ts ausente.');
    process.exit(1);
  }
  const code = stripComments(readFileSync(SVC, 'utf8'));

  // (a) sem SQL cru de approval_requests (B2 selado — via Core)
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+approval_requests\b/i.test(code)) {
    failures.push('executor escreve approval_requests por SQL CRU — deve usar o Core (insertApprovalRequestTx/recordFinancialApprovalDecision).');
  }
  if (/\bFROM\s+approval_requests\b/i.test(code)) {
    failures.push('executor LÊ approval_requests por SQL CRU — deve usar findApprovalRequestByIdTx (Core).');
  }
  // (b) sem escrita direta em bank_*
  if (/(INSERT\s+INTO|UPDATE)\s+bank_[a-z_]+/i.test(code)) {
    failures.push('executor escreve bank_* direto — Bank só via bankTransactionService.transfer (port).');
  }
  // (c) sem seller_available
  if (/seller_available/.test(code)) {
    failures.push('executor referencia seller_available (trilho legado) — proibido.');
  }
  // (d) sem can_execute_* / autoridade client-declared
  if (/can_execute_/.test(code)) failures.push('executor referencia can_execute_*.');
  if (/req\.body|req\.query|req\.actionContext|['"]x-actor-id['"]/.test(code)) {
    failures.push('executor usa autoridade client-declared (req.body/query/actionContext/x-actor-id) — é service server-side.');
  }

  // (e) presença dos invariantes do selo
  const required = [
    { re: /\bfindApprovalRequestByIdTx\s*\(/, msg: 'leitura de approval via Core (findApprovalRequestByIdTx) ausente.' },
    { re: /\binsertApprovalRequestTx\s*\(/, msg: 'criação de approval via Core (insertApprovalRequestTx) ausente.' },
    { re: /\brecordFinancialApprovalDecision\s*\(/, msg: 'bridge de aprovação via Core (recordFinancialApprovalDecision) ausente.' },
    { re: /\bdrainRecoveryObligationsForCredit\s*\(/, msg: 'recovery drain/lock (drainRecoveryObligationsForCredit) ausente.' },
    { re: /actor_wallet_payout_requests[\s\S]{0,80}FOR UPDATE/i, msg: 'FOR UPDATE no payout_request ausente.' },
    { re: /\bbankTransactionService\.transfer\s*\(/, msg: 'transfer via BankTransactionPort ausente.' },
    { re: /ACTOR_WALLET_PAYOUT_REFERENCE_TYPE/, msg: 'referenceType de idempotência (ACTOR_WALLET_PAYOUT_REFERENCE_TYPE) ausente no transfer.' },
  ];
  for (const r of required) if (!r.re.test(code)) failures.push(r.msg);

  // (f) executor não exposto por HTTP
  for (const f of walkRoutes(SRC)) {
    const rc = stripComments(readFileSync(f, 'utf8'));
    if (/\b(executeActorWalletPayout|approveActorWalletPayout)\b/.test(rc)) {
      failures.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} expõe executeActorWalletPayout/approveActorWalletPayout via HTTP — deve ser system-only.`);
    }
  }
  // (g) executor não auto-iniciado no BOOT
  if (existsSync(BOOT)) {
    const boot = stripComments(readFileSync(BOOT, 'utf8'));
    if (/\b(executeActorWalletPayout|approveActorWalletPayout)\b/.test(boot)) {
      failures.push('BOOT.ts chama executeActorWalletPayout/approveActorWalletPayout — executor não pode auto-iniciar.');
    }
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [payout-execution-seal]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[payout-execution-seal] approval via Core (insert/find/recordDecision); FOR UPDATE no payout_request; recovery drain; transfer via BankTransactionPort com referenceType; sem SQL cru de approval; sem bank_* direto; sem seller_available; sem can_execute_*/req.body|query; executor system-only (sem HTTP/BOOT).');
  console.log('GATE OK [payout-execution-seal] — execução de payout selada no trilho canônico, Core-aprovada e system-only.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
