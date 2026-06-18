#!/usr/bin/env node
// Guard estrutural — R7b ACCEPTQUOTE P0 CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2 · Clayton 2026-06-18).
// Cerca de regressão da rota W6 POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept.
// acceptQuote é MONEY-ADJACENT (cria availability → booking → service_booking_decision → service_payment_request
// PENDING em nome do provider, sem canRepresentActor, sem confirmação do provider, sem transação/idempotência).
// Esta frente é P0 CONTAINMENT (NÃO redesenho final): a rota deve responder 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED
// ANTES de qualquer sink. O guard prova:
//   1. o hard-stop existe (code EVENT_RFQ_ACCEPT_QUOTE_CONTAINED) no handler W6;
//   2. o hard-stop roda ANTES da chamada eventRFQService.acceptQuote (gate@idx < sink@idx);
//   3. o sink eventRFQService.acceptQuote(...) permanece presente no fonte (não foi removido — baseline canal-1);
//   4. a rota W6 NÃO chama/menciona sinks materiais (availability/booking/decision/payment_request/bank_*).
// MORDE regressão real (remover o hard-stop OU mover acceptQuote antes dele faz o guard falhar).
// Em validate:regression-guards.

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
  console.error(`GATE FAIL [event-rfq-acceptquote-containment]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// Segmenta os handlers por registro fastify.post/get. Cada segmento vai até o próximo registro.
const re = /fastify\.(post|get)<[\s\S]*?>\(\s*'([^']+)'/g;
const marks = [];
let m;
while ((m = re.exec(code)) !== null) marks.push({ method: m[1], path: m[2], start: m.index });
const handlers = marks.map((mk, i) => ({
  ...mk,
  body: code.slice(mk.start, i + 1 < marks.length ? marks[i + 1].start : code.length),
}));

// W6 acceptQuote — POST .../accept que mantém o sink eventRFQService.acceptQuote(.
const w6 = handlers.find((h) => h.method === 'post' && /\/accept$/.test(h.path) && /eventRFQService\.acceptQuote\(/.test(h.body));
if (!w6) {
  failures.push('W6 acceptQuote: handler/sink eventRFQService.acceptQuote ausente — não pode ser removido (mascararia o estado contido + quebraria baseline canal-1/R7a).');
} else {
  // Exige um RETURN explícito (early-exit) — não basta a expressão 403 existir: ela tem de cortar o fluxo.
  const CONTAINED = /return\s+reply\.status\(\s*403\s*\)[\s\S]*?EVENT_RFQ_ACCEPT_QUOTE_CONTAINED/;
  const SINK = /eventRFQService\.acceptQuote\(/;
  const g = w6.body.search(CONTAINED);
  const s = w6.body.search(SINK);

  if (g < 0) {
    failures.push('W6 acceptQuote: hard-stop ausente — esperado return reply.status(403) com code EVENT_RFQ_ACCEPT_QUOTE_CONTAINED ANTES de qualquer sink.');
  } else if (s < 0) {
    failures.push('W6 acceptQuote: sink eventRFQService.acceptQuote não encontrado (mudou a assinatura/rota?).');
  } else if (g > s) {
    failures.push(`W6 acceptQuote: hard-stop de contenção roda DEPOIS do sink acceptQuote (stop@${g} sink@${s}) — mover ANTES.`);
  }

  // O hard-stop deve ser o PRIMEIRO statement material do handler: nada de leitura/validação antes do 403
  // de contenção que possa virar caminho material. Aproximação: o 403 contido deve aparecer antes do primeiro
  // `await` do handler (qualquer await já é trabalho material/sink).
  const firstAwait = w6.body.search(/\bawait\b/);
  if (g >= 0 && firstAwait >= 0 && g > firstAwait) {
    failures.push(`W6 acceptQuote: existe await ANTES do hard-stop de contenção (await@${firstAwait} stop@${g}) — contenção deve preceder todo trabalho material.`);
  }

  // A rota W6 NÃO pode mencionar/chamar sinks materiais money-adjacent (vivem no service; não devem vazar p/ rota).
  const W6_FORBIDDEN = [
    { re: /createAvailability/, msg: 'createAvailability não pode aparecer na rota W6 (sink contido — money-adjacent R7b).' },
    { re: /createBooking/, msg: 'createBooking não pode aparecer na rota W6 (sink contido — money-adjacent R7b).' },
    { re: /createDecision/, msg: 'createDecision não pode aparecer na rota W6 (sink contido — money-adjacent R7b).' },
    { re: /createPaymentRequest/, msg: 'createPaymentRequest não pode aparecer na rota W6 (sink contido — money-adjacent R7b).' },
    { re: /service_payment_requests?/, msg: 'service_payment_request(s) não pode aparecer na rota W6.' },
    { re: /service_booking_decisions?/, msg: 'service_booking_decision(s) não pode aparecer na rota W6.' },
    { re: /event_outbox/, msg: 'event_outbox não pode aparecer na rota W6.' },
    { re: /bank_ledger|bank_transactions|bank_splits/, msg: 'bank_ledger/bank_transactions/bank_splits não podem aparecer na rota W6.' },
  ];
  for (const { re: fre, msg } of W6_FORBIDDEN) if (fre.test(w6.body)) failures.push(`${REL} W6: ${msg}`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-rfq-acceptquote-containment]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [event-rfq-acceptquote-containment]');
