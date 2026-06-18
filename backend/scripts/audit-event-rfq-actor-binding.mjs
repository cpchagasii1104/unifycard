#!/usr/bin/env node
// Guard estrutural — R7a EVENT-RFQ ACTING-USER-GATE (DECISION-0113 / DECISION-0131 §B7 / Z2).
// Cerca de regressão das ESCRITAS RFQ non-money-runtime W1-W5: deixar de confiar em
// actionContext.actorId / actionContext.actingUserId como autoridade e exigir req.user.userId +
// representação ANTES do sink. W6 acceptQuote (money-adjacent) é EXPRESSAMENTE FORA do escopo — o
// guard prova que o handler/call-chain de acceptQuote NÃO recebeu o binding desta frente.
// MORDE regressão real (não grep decorativo). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/events/event-rfq.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [event-rfq-actor-binding]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// Segmenta os handlers por registro fastify.post/get. Cada segmento vai até o próximo registro.
const handlers = [];
const re = /fastify\.(post|get)<[\s\S]*?>\(\s*'([^']+)'/g;
let m;
const marks = [];
while ((m = re.exec(code)) !== null) marks.push({ method: m[1], path: m[2], start: m.index });
for (let i = 0; i < marks.length; i++) {
  const body = code.slice(marks[i].start, i + 1 < marks.length ? marks[i + 1].start : code.length);
  handlers.push({ ...marks[i], body });
}

const find = (pred) => handlers.find(pred);
const CAN_REP = /canRepresentActor\(\s*req\.tenant\.id\s*,\s*callerUserId\s*,\s*actionContext\.actorId\s*\)/;
const READ_MONEY = /assertCanReadEventMoney\(\s*tenantId\s*,\s*eventId\s*,\s*callerUserId\s*\)/;
const NOT_REP_CODE = /EVENT_RFQ_ACTOR_NOT_REPRESENTABLE/;

// gate ANTES do sink: índice do gate < índice do sink no corpo do handler.
const requireGateBeforeSink = (label, h, gateRe, sinkRe) => {
  if (!h) { failures.push(`${label}: handler não encontrado (mudou rota/sink?).`); return; }
  const g = h.body.search(gateRe);
  const s = h.body.search(sinkRe);
  if (g < 0) { failures.push(`${label}: gate de autoridade ausente (${gateRe}).`); return; }
  if (s < 0) { failures.push(`${label}: sink esperado ausente (${sinkRe}).`); return; }
  if (g > s) failures.push(`${label}: gate de autoridade roda DEPOIS do sink (gate@${g} sink@${s}) — mover ANTES.`);
};

// W1 createRFQ — POST /events/:eventId/rfqs, canRepresentActor(actorId declarado) antes de createRFQ.
requireGateBeforeSink(
  'W1 createRFQ',
  find((h) => h.method === 'post' && h.path === '/events/:eventId/rfqs' && /eventRFQService\.createRFQ\(/.test(h.body)),
  CAN_REP, /eventRFQService\.createRFQ\(/
);
// W2 closeRFQ — assertCanReadEventMoney (organizer server-resolved) antes de closeRFQ.
requireGateBeforeSink(
  'W2 closeRFQ',
  find((h) => h.method === 'post' && /\/close$/.test(h.path) && /eventRFQService\.closeRFQ\(/.test(h.body)),
  READ_MONEY, /eventRFQService\.closeRFQ\(/
);
// W3 createQuote — canRepresentActor(provider declarado) antes de createQuote.
requireGateBeforeSink(
  'W3 createQuote',
  find((h) => h.method === 'post' && /\/quotes$/.test(h.path) && /eventRFQService\.createQuote\(/.test(h.body)),
  CAN_REP, /eventRFQService\.createQuote\(/
);
// W4 from-spec — assertCanReadEventMoney antes de updateEventDeclarationFromSpec E createRFQ.
const w4 = find((h) => h.method === 'post' && /from-spec/.test(h.path));
requireGateBeforeSink('W4 from-spec (updateEventDeclarationFromSpec)', w4, READ_MONEY, /updateEventDeclarationFromSpec\(/);
requireGateBeforeSink('W4 from-spec (createRFQ)', w4, READ_MONEY, /eventRFQService\.createRFQ\(/);
// W5 dispatch — assertCanReadEventMoney antes de dispatchRFQToCompanies.
requireGateBeforeSink(
  'W5 dispatch',
  find((h) => h.method === 'post' && /\/dispatch$/.test(h.path) && /dispatchRFQToCompanies\(/.test(h.body)),
  READ_MONEY, /dispatchRFQToCompanies\(/
);

// W1-W5 devem exigir subject server-side (callerUserId de req.user) e o código 403 da frente.
for (const label of ['W1 createRFQ', 'W3 createQuote']) {
  const h = label === 'W1 createRFQ'
    ? find((x) => x.method === 'post' && x.path === '/events/:eventId/rfqs' && /createRFQ\(/.test(x.body))
    : find((x) => x.method === 'post' && /\/quotes$/.test(x.path) && /createQuote\(/.test(x.body));
  if (h && !NOT_REP_CODE.test(h.body)) failures.push(`${label}: código 403 EVENT_RFQ_ACTOR_NOT_REPRESENTABLE ausente.`);
  if (h && !/callerUserId\s*=\s*\(req\.user/.test(h.body)) failures.push(`${label}: subject deve vir de req.user.userId (callerUserId server-side).`);
}

// PROIBIÇÃO: actionContext.actorId/actingUserId como SUBJECT de representação (deve ser target/hint, nunca subject).
if (/canRepresentActor\(\s*[^,]*,\s*actionContext\.(actorId|actingUserId)/.test(code)) {
  failures.push(`${REL}: actionContext.actorId/actingUserId usado como SUBJECT de canRepresentActor — subject é req.user.userId.`);
}

// ── W6 acceptQuote: FORA DO ESCOPO — provar que NÃO recebeu o binding desta frente ──
const w6 = find((h) => h.method === 'post' && /\/accept$/.test(h.path) && /eventRFQService\.acceptQuote\(/.test(h.body));
if (!w6) {
  failures.push('W6 acceptQuote: handler/sink eventRFQService.acceptQuote ausente — não pode ser removido/alterado por R7a.');
} else {
  if (CAN_REP.test(w6.body) || READ_MONEY.test(w6.body) || NOT_REP_CODE.test(w6.body)) {
    failures.push('W6 acceptQuote: recebeu binding de R7a (canRepresentActor/assertCanReadEventMoney/403 da frente) — money-adjacent, FORA do escopo R7a (frente própria R7b).');
  }
}

// ── Bank / payment-request NUNCA aparecem nas rotas RFQ (money-runtime fora do escopo) ──
const FORBIDDEN = [
  { re: /createPaymentRequest/, msg: 'createPaymentRequest não pode aparecer nas rotas RFQ (money-adjacent R7b).' },
  { re: /service_payment_requests?/, msg: 'service_payment_request(s) não pode aparecer nas rotas RFQ.' },
  { re: /service_payment_executions/, msg: 'service_payment_executions não pode aparecer nas rotas RFQ.' },
  { re: /bank_ledger|bank_transactions|bank_splits/, msg: 'bank_ledger/bank_transactions/bank_splits não podem aparecer nas rotas RFQ (non-money-runtime).' },
];
for (const { re, msg } of FORBIDDEN) if (re.test(code)) failures.push(`${REL}: ${msg}`);

if (failures.length > 0) {
  console.error('GATE FAIL [event-rfq-actor-binding]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [event-rfq-actor-binding]');
