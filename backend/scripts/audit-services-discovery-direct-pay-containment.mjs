#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8J-SERVICES-DISCOVERY-DIRECT-PAY-CONTAINMENT (DECISION-0110 D2 / DECISION-0113 / Z2).
//
// POST /services/request/pay era o trilho DIRETO legado: payAcceptedRequest → bankTx.createSimpleTransaction →
// bank_ledger/bank_transactions, lendo actionContext.actorId (client-declared) SEM canRepresentActor antes do
// sink. DECISION-0110 D2 marca o trilho direto como FORA da política. APOSENTADO: firewall (default OFF) como 1º
// gate + hard-stop INCONDICIONAL (403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110) — flipar o firewall
// NÃO reabre. Este gate trava a aposentadoria. MORDE se: /request/pay voltar a chamar payAcceptedRequest; ler
// actionContext.actorId; tocar bank_*/createSimpleTransaction; perder o 403 RETIRED; OU o firewall sumir do
// arquivo. Heurística textual comment-stripped (não AST). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/services/services-discovery.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [services-discovery-direct-pay-containment]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// Segmenta o handler /request/pay (do registro até o próximo fastify.<verbo>).
const re = /fastify\.(post|get|put|patch|delete)\b/g;
const marks = [];
let m;
while ((m = re.exec(code)) !== null) marks.push(m.index);
const payStart = code.search(/fastify\.post\(\s*['"]\/request\/pay['"]/);
let pay = '';
if (payStart < 0) {
  failures.push(`${REL}: rota POST /request/pay desapareceu — não pode ser removida silenciosamente.`);
} else {
  const next = marks.find((idx) => idx > payStart);
  pay = code.slice(payStart, next ?? code.length);

  // 1) hard-stop de aposentadoria nomeado.
  if (!/SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110/.test(pay)) {
    failures.push(`${REL} /request/pay: perdeu o hard-stop SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110.`);
  }
  if (!/return\s+reply\.status\(\s*403\s*\)[\s\S]{0,400}SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110/.test(pay)) {
    failures.push(`${REL} /request/pay: DEVE retornar 403 com code SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110.`);
  }
  // 2) firewall geral preservado como 1º gate (fail-closed default OFF).
  if (!/isServiceFinancialRuntimeEnabled\(\)/.test(pay)) {
    failures.push(`${REL} /request/pay: firewall isServiceFinancialRuntimeEnabled() removido — deve permanecer como 1º gate fail-closed.`);
  }
  // 3) PROIBIDO no handler: chamar o sink payAcceptedRequest, tocar bank_*, createSimpleTransaction.
  for (const re2 of [/payAcceptedRequest\s*\(/, /createSimpleTransaction/, /bank_ledger|bank_transactions|bank_splits/, /payment_status|payment_bank_transaction_id/]) {
    if (re2.test(pay)) failures.push(`${REL} /request/pay: voltou a referenciar o trilho direto/sink (${re2}) — APOSENTADO por DECISION-0110 D2; reabertura exige cadeia canônica em frente própria.`);
  }
  // 4) PROIBIDO: actionContext.actorId no handler aposentado (canal-1 client-declared eliminado).
  if (/actionContext\s*\.\s*actorId/.test(pay)) {
    failures.push(`${REL} /request/pay: voltou a referenciar actionContext.actorId — o handler aposentado não lê ator do cliente.`);
  }
}

// 5) firewall fail-closed default OFF preservado (arquivo do firewall intocado: default OFF).
const FW = 'src/modules/services/service-financial-firewall.ts';
const fwp = join(ROOT, FW);
if (!existsSync(fwp)) {
  failures.push(`${FW}: firewall ausente — não pode ser removido.`);
} else {
  const fw = readFileSync(fwp, 'utf-8');
  if (!/===\s*'true'/.test(fw) || !/SERVICE_FINANCIAL_RUNTIME_ENABLED/.test(fw)) {
    failures.push(`${FW}: firewall enfraquecido — deve permanecer default OFF (só 'true' habilita).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [services-discovery-direct-pay-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [services-discovery-direct-pay-containment] — POST /services/request/pay APOSENTADO (403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110; firewall default OFF preservado como 1º gate; zero payAcceptedRequest/createSimpleTransaction/bank_*/actionContext.actorId no handler). Trilho direto não reabre via firewall.');
