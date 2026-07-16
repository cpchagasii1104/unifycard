#!/usr/bin/env node
// Guard estrutural — REVERSAL CONTAINMENT / SYSTEM-AUTHORSHIP REGRESSION LOCK (C4 / ONDA DECISION-0131).
//
// O READ-FIRST do C4 concluiu: NÃO há money vivo divergente. Motor de reversal = system-authored
// (buildSystemAuthorship); HTTP humano de dispute/reversal = CONTIDO_FAIL_CLOSED (403); bridge
// bank-integration.reverseTransaction (fallback "1º actor") só alcançável por rides.service.cancelRide
// (DEAD/0 callers); post-D-money/recovery block presente; bank-transaction.reverseTransaction = TOMBSTONE.
// A contenção estava protegida SÓ por e2e (fora do chain) — este guard TRAVA o estado (zero runtime) e
// FALHA se regredir. NÃO corrige reversal/rides/bank; NÃO amputa dead code.

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const rel = (p) => p.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const DISPUTE_ROUTES = join(SRC, 'modules', 'reconciliation', 'reconciliation-dispute.routes.ts');
const REVERSAL_SVC = join(SRC, 'modules', 'reversal', 'reversal.service.ts');
const BANK_TX_SVC = join(SRC, 'modules', 'bank', 'bank-transaction.service.ts');

// Funções-motor de reversal que NENHUMA rota HTTP pode chamar diretamente sem classificação.
const ENGINE_CALL = /\b(requestReversal|requestAndExecuteReversalSync|executeReversal|executeDisputeFinancialReversal)\s*\(/;
const DISPUTE_MUTATION_CALL = /reconciliationDisputeService\.(createDisputeFromDiscrepancy|moveDisputeToUnderReview|resolveDispute|executeDisputeFinancialReversal)\s*\(/;

// INV6 — baseline dos arquivos de runtime (fora de scripts) que referenciam o bridge/dead-code.
// Novo arquivo referenciando = novo caller potencial → MORDE.
const BASELINE_REVERSE_TX_FILES = [
  'src/modules/bank/bank-transaction.service.ts',   // def @deprecated (tombstone)
  'src/modules/bank/bank-integration.service.ts',   // def bridge sistêmico (fallback "1º actor")
  'src/modules/rides/rides/rides.service.ts',        // único caller — DEAD (0 callers de cancelRide)
  // FISCAL-4E (Yala B): caller LEGÍTIMO por caminho EXATO — usa o motor formal, encaminha existingClient
  // (full reversal atômica), passa actorId EXPLÍCITO (NÃO revive o fallback "1º actor"), é interno e
  // DORMENTE (zero caller vivo de produto; firewall OFF), não cria 2º motor. Classificação estreita: só
  // este arquivo — sem glob por diretório (modules/bank/**, *composition*, *fiscal*).
  'src/modules/bank/fiscal-reserve-bank-composition.service.ts',
];
const BASELINE_CANCELRIDE_FILES = [
  'src/modules/rides/rides/rides.service.ts',         // definição; 0 callers externos
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (extname(full) === '.ts') files.push(full);
  }
  return files;
}

function runGuard() {
  const failures = [];
  for (const [label, p] of [['reconciliation-dispute.routes.ts', DISPUTE_ROUTES], ['reversal.service.ts', REVERSAL_SVC], ['bank-transaction.service.ts', BANK_TX_SVC]]) {
    if (!existsSync(p)) { console.error(`GATE FAIL [reversal-containment]: ${label} ausente.`); process.exit(1); }
  }
  const disputeRaw = readFileSync(DISPUTE_ROUTES, 'utf8');
  const dispute = stripComments(disputeRaw);
  const reversal = stripComments(readFileSync(REVERSAL_SVC, 'utf8'));
  const bankTx = stripComments(readFileSync(BANK_TX_SVC, 'utf8'));

  // INV1 — rotas mutáveis de dispute/reversal seguem 403 fail-closed e NÃO chamam o motor.
  if (!/DISPUTE_REVERSAL_HTTP_DISABLED/.test(disputeRaw)) failures.push('INV1: code DISPUTE_REVERSAL_HTTP_DISABLED ausente — rota /disputes/:id/reversal não está fail-closed.');
  if (!/DISPUTE_MUTATION_HTTP_DISABLED/.test(disputeRaw)) failures.push('INV1: code DISPUTE_MUTATION_HTTP_DISABLED ausente — rotas de mutação não estão fail-closed.');
  const status403 = (dispute.match(/\.status\(403\)/g) || []).length;
  if (status403 < 4) failures.push(`INV1: esperadas >=4 rotas mutáveis 403 fail-closed (from-discrepancy/to-review/resolve/reversal); achei ${status403}.`);
  if (DISPUTE_MUTATION_CALL.test(dispute)) failures.push('INV1: rota de dispute voltou a CHAMAR o motor de mutation/reversal (createDispute/moveToReview/resolve/executeDisputeFinancialReversal) — contenção quebrada.');
  if (/requestAndExecuteReversalSync\s*\(/.test(dispute)) failures.push('INV1: rota de dispute chama requestAndExecuteReversalSync — reversal HTTP reaberto.');

  // INV2 — GET /disputes/:id/events continua read-only (só o leitor; sem write/transfer/motor).
  if (!/listDisputeAuditEvents\s*\(/.test(dispute)) failures.push('INV2: GET /disputes/:id/events não chama mais listDisputeAuditEvents (leitor) — read-only quebrado.');
  if (/\b(INSERT|UPDATE|DELETE)\b/i.test(dispute) || /\.transfer\s*\(/.test(dispute)) failures.push('INV2: arquivo de rotas de dispute passou a escrever/transferir (INSERT/UPDATE/DELETE/transfer) — deixou de ser read-only no edge.');

  // INV3 — motor de reversal money continua SYSTEM-authored (buildSystemAuthorship).
  const authorships = [...reversal.matchAll(/authorship:\s*([A-Za-z_]\w*)/g)].map((m) => m[1]);
  if (authorships.length < 2) failures.push(`INV3: esperadas >=2 authorship: buildSystemAuthorship nos transfers do reversal; achei ${authorships.length}.`);
  const nonSystem = authorships.filter((a) => a !== 'buildSystemAuthorship');
  if (nonSystem.length > 0) failures.push(`INV3: money do reversal deixou de ser system-authored — authorship não-system: ${[...new Set(nonSystem)].join(', ')} (proibido actor/user/actionContext/client-declared).`);

  // INV5 — bank-transaction.reverseTransaction continua TOMBSTONE (deprecated/throw; não executa reversal).
  const tIdx = bankTx.search(/async\s+reverseTransaction\s*\(/);
  if (tIdx < 0) failures.push('INV5: bank-transaction.service.reverseTransaction sumiu — tombstone esperado.');
  else {
    const rest = bankTx.slice(tIdx + 1);
    const nextIdx = rest.search(/\n\s{2}(?:async\s+)?[A-Za-z_]\w*\s*\(/);
    const body = nextIdx > 0 ? rest.slice(0, nextIdx) : rest;
    if (!/REVERSE_TRANSACTION_DEPRECATED/.test(body) || !/throw\s+new\s+Error/.test(body)) {
      failures.push('INV5: bank-transaction.reverseTransaction deixou de ser tombstone (deprecated throw REVERSE_TRANSACTION_DEPRECATED).');
    }
    // Forbidden = executar reversal de verdade (motor que move dinheiro). NÃO inclui o próprio nome
    // `reverseTransaction(` (aparece na string da mensagem de erro do throw — não é chamada real).
    const bodyNoStrings = body.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
    if (/\b(requestReversal|requestAndExecuteReversalSync|executeReversal)\s*\(/.test(bodyNoStrings) || /\.transfer\s*\(/.test(bodyNoStrings)) {
      failures.push('INV5: tombstone bank-transaction.reverseTransaction voltou a executar reversal (chama motor/transfer).');
    }
  }

  // INV7 — post-D-money/recovery block presente e acionado.
  if (!/checkPostDmoneyBlock/.test(reversal)) failures.push('INV7: checkPostDmoneyBlock removido do reversal.service.');
  const blockCalls = (reversal.match(/checkPostDmoneyBlock\s*\(/g) || []).length;
  if (blockCalls < 3) failures.push(`INV7: checkPostDmoneyBlock deve ser chamado em request/execute/sync (>=2 call-sites + def=3); achei ${blockCalls}.`);
  for (const lit of ['released_to_actor_wallet', 'refunded_via_recovery', 'REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW']) {
    if (!reversal.includes(lit)) failures.push(`INV7: post-D-money/recovery block perdeu a referência a '${lit}'.`);
  }

  // INV4 + INV6 — varredura de runtime (exclui src/scripts = e2e/tests).
  const reverseTxFiles = [];
  const cancelRideFiles = [];
  for (const f of walk(SRC)) {
    const r = rel(f);
    if (r.startsWith('src/scripts/')) continue; // testes/e2e não contam como caller de runtime
    // FISCAL-4E (Yala B): testes NÃO são caller de PRODUÇÃO — exclusão estrutural explícita (não entram na
    // baseline de callers vivos). Ex.: fiscal-reserve-bank-composition.db.test.ts exercita o motor formal.
    if (r.includes('/__tests__/') || /\.(test|spec)\.ts$/.test(r)) continue;
    const code = stripComments(readFileSync(f, 'utf8'));
    // INV4 — nenhuma rota HTTP nova chama o motor de reversal direto.
    if (r.endsWith('.routes.ts') && ENGINE_CALL.test(code)) {
      failures.push(`INV4: rota HTTP ${r} chama o motor de reversal direto (requestReversal/requestAndExecuteReversalSync/executeReversal/executeDisputeFinancialReversal) sem containment — proibido.`);
    }
    if (r.endsWith('.routes.ts') && /\breverseTransaction\s*\(/.test(code)) {
      failures.push(`INV4: rota HTTP ${r} chama reverseTransaction direto — novo entrypoint money de reversal sem classificação.`);
    }
    // INV6 — baseline de arquivos do bridge/dead-code.
    if (/\breverseTransaction\s*\(/.test(code)) reverseTxFiles.push(r);
    if (/\bcancelRide\s*\(/.test(code)) cancelRideFiles.push(r);
    // INV6 (FISCAL-4E anti-relaxamento): o caller fiscal LEGÍTIMO deve passar actorId EXPLÍCITO ao motor
    // formal — nunca depender do fallback "1º actor" do bridge. Largar o actorId reabre o dead-code → MORDE.
    if (r === 'src/modules/bank/fiscal-reserve-bank-composition.service.ts') {
      const call = code.match(/reverseTransaction\s*\(([^)]*)\)/);
      if (!call || !/actorId/.test(call[1])) failures.push('INV6: caller fiscal chama reverseTransaction SEM actorId explícito — revive o fallback "1º actor" do bridge (dead-code).');
    }
  }
  for (const f of reverseTxFiles) {
    if (!BASELINE_REVERSE_TX_FILES.includes(f)) failures.push(`INV6: NOVO arquivo referencia reverseTransaction(): ${f} — baseline do bridge mudou (possível novo caller do fallback "1º actor"). Classifique antes (DT-RIDES-CANCEL-REVERSAL-DEAD-BRIDGE).`);
  }
  for (const f of cancelRideFiles) {
    if (!BASELINE_CANCELRIDE_FILES.includes(f)) failures.push(`INV6: NOVO arquivo referencia cancelRide(): ${f} — rides.service.cancelRide (DEAD, com bridge de reversão) ganhou caller. Classifique antes (DT-RIDES-CANCEL-REVERSAL-DEAD-BRIDGE).`);
  }
  for (const b of BASELINE_REVERSE_TX_FILES) {
    if (!reverseTxFiles.includes(b)) failures.push(`INV6: baseline reverseTransaction sumiu de ${b} — refactor moveu o bridge; re-revise a contenção.`);
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [reversal-containment]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log(`[reversal-containment] dispute mutável 403x${status403} fail-closed; events read-only; reversal money system-authored (${authorships.length} buildSystemAuthorship); nenhuma rota chama o motor; tombstone bank-transaction.reverseTransaction; post-D-money block (${blockCalls} sites); bridge/dead-code baseline (reverseTransaction=${reverseTxFiles.length} files, cancelRide=${cancelRideFiles.length} files).`);
  console.log('GATE OK [reversal-containment] — contenção/system-authorship TRAVADAS; abrir 403, trocar authorship do money, nova rota→motor, reativar tombstone, novo caller do bridge dead, ou remover post-D-money block MORDEM.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
