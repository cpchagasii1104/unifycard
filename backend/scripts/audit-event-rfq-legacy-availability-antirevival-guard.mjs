#!/usr/bin/env node
// Guard estrutural — F-EVENT-RFQ-LEGACY-SERVICE-AVAILABILITY-ANTI-REACTIVATION-GUARD
//   (DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT / DECISION-0156).
//
// CONTEXTO (arco F-SERVICE-AVAILABILITY-SSOT-RECONCILIATION, HEAD 4eb28edf3):
//   • SSOT temporal reservável = unified_availability/bookings com owner_type='service_offering'
//     (DECISION-0117 D / 0118 D2 / 0146 §A.5). owner_type='service' é LEGADO/compatibilidade, não agenda reservável.
//   • O writer legado eventRFQService.acceptQuote materializa a cadeia
//     availability(owner_type='service', source:'rfq_accept') -> booking -> service_booking_decision(ACCEPTED)
//     -> service_payment_request(PENDING) "em nome do provider". É o RESÍDUO ÚNICO da DT-mãe.
//   • Esse writer está MORTO: a rota W6 POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept responde
//     403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED ANTES de qualquer sink (freezer R7b, guard
//     audit-event-rfq-acceptquote-containment.mjs). Nenhum caller de runtime vivo o alcança.
//
// DECISÃO DESTA FRENTE (Clayton): NÃO re-keyar, NÃO reativar, NÃO redesenhar RFQ agora. Só TRAVAR a reativação
//   acidental do writer legado owner_type='service' pelo fluxo rfq_accept. Este gate MORDE
//   (RFQ_LEGACY_SERVICE_AVAILABILITY_REACTIVATED) se o estado-morto derreter:
//   (A) a rota W6 perder o hard-stop 403 antes do sink acceptQuote (writer legado volta a ficar alcançável);
//   (B) surgir um caller de eventRFQService.acceptQuote( fora da allowlist morta/documentada;
//   (C) o writer legado mudar de forma silenciosamente (perder o owner_type='service' + source:'rfq_accept',
//       ou a cadeia booking/decision/payment_request) — re-key/refactor exige frente própria + revisão deste guard;
//   (D) a provenance availability source:'rfq_accept' aparecer em qualquer arquivo fora do writer morto
//       (o fluxo rfq_accept não pode escrever availability a partir de outro ponto vivo).
//
// Em validate:regression-guards. Heurística textual comment-stripped (não AST). NÃO altera runtime/Bank/RFQ.
// Complementar ao freezer R7b (audit-event-rfq-acceptquote-containment.mjs): aquele congela a CONTENÇÃO da rota;
// este congela o WRITER LEGADO owner_type='service' (lente SSOT temporal da DT-mãe).

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const norm = (p) => p.split(sep).join('/');

const ROUTES_REL = 'src/modules/events/event-rfq.routes.ts';
const SERVICE_REL = 'src/modules/events/event-rfq.service.ts';

// Arquivos que PODEM referenciar eventRFQService.acceptQuote( — todos MORTOS/test-harness/documentados:
//   • event-rfq.routes.ts               = rota W6 CONTIDA por 403 (sink presente mas inalcançável).
//   • validate-pipeline-e2e-transversal.ts = harness E2E que chama o método direto (DB efêmera) p/ provar o legado;
//                                            NÃO é rota de runtime.
const ACCEPTQUOTE_CALLER_ALLOWLIST = new Set([
  ROUTES_REL,
  'src/scripts/validate-pipeline-e2e-transversal.ts',
]);

const failures = [];

// ───────────────────────────────────────────────────────────────────────────
// CHECK A — rota W6: hard-stop 403 precede o sink acceptQuote (writer legado permanece inalcançável).
// ───────────────────────────────────────────────────────────────────────────
const routes = read(ROUTES_REL);
if (routes === null) {
  failures.push(`arquivo ausente: ${ROUTES_REL}`);
} else {
  const re = /fastify\.(post|get)<[\s\S]*?>\(\s*'([^']+)'/g;
  const marks = [];
  let m;
  while ((m = re.exec(routes)) !== null) marks.push({ method: m[1], path: m[2], start: m.index });
  const handlers = marks.map((mk, i) => ({
    ...mk,
    body: routes.slice(mk.start, i + 1 < marks.length ? marks[i + 1].start : routes.length),
  }));
  const w6 = handlers.find((h) => h.method === 'post' && /\/accept$/.test(h.path) && /eventRFQService\.acceptQuote\(/.test(h.body));
  if (!w6) {
    failures.push(`${ROUTES_REL}: handler W6 (POST .../accept que mantém o sink eventRFQService.acceptQuote() ausente — o writer legado não pode sumir/mudar de rota sem revisão desta trava.`);
  } else {
    const CONTAINED = /return\s+reply\.status\(\s*403\s*\)[\s\S]*?EVENT_RFQ_ACCEPT_QUOTE_CONTAINED/;
    const SINK = /eventRFQService\.acceptQuote\(/;
    const g = w6.body.search(CONTAINED);
    const s = w6.body.search(SINK);
    const firstAwait = w6.body.search(/\bawait\b/);
    if (g < 0) {
      failures.push(`${ROUTES_REL} W6: hard-stop 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED ausente — o writer legado owner_type='service' voltaria a ser alcançável. RFQ_LEGACY_SERVICE_AVAILABILITY_REACTIVATED.`);
    } else if (s < 0) {
      failures.push(`${ROUTES_REL} W6: sink eventRFQService.acceptQuote( não encontrado (mudou de forma?).`);
    } else if (g > s) {
      failures.push(`${ROUTES_REL} W6: hard-stop de contenção roda DEPOIS do sink acceptQuote (stop@${g} sink@${s}) — writer legado alcançável. RFQ_LEGACY_SERVICE_AVAILABILITY_REACTIVATED.`);
    } else if (firstAwait >= 0 && g > firstAwait) {
      failures.push(`${ROUTES_REL} W6: existe await ANTES do hard-stop (await@${firstAwait} stop@${g}) — contenção deve preceder todo trabalho material.`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CHECK C (writer freeze) — event-rfq.service.ts: acceptQuote mantém a forma congelada do writer legado.
//   Se sumir/re-keyar silenciosamente (owner_type='service' -> service_offering, ou perder a cadeia),
//   força revisão consciente (isso é o redesenho R7b — frente própria, não drift silencioso).
// ───────────────────────────────────────────────────────────────────────────
const service = read(SERVICE_REL);
if (service === null) {
  failures.push(`arquivo ausente: ${SERVICE_REL}`);
} else {
  const defIdx = service.search(/async\s+acceptQuote\s*\(/);
  if (defIdx < 0) {
    failures.push(`${SERVICE_REL}: definição async acceptQuote( ausente — o writer legado não pode sumir/mudar de forma sem revisão desta trava (redesenho R7b = frente própria).`);
  } else {
    const endIdx = service.indexOf('export const eventRFQService', defIdx);
    const body = service.slice(defIdx, endIdx > defIdx ? endIdx : service.length);
    const FROZEN = [
      { re: /ownerType:\s*AvailabilityOwnerType\.SERVICE\b/, msg: "owner_type='service' (AvailabilityOwnerType.SERVICE) — writer legado re-keyado/removido sem frente própria." },
      { re: /source:\s*'rfq_accept'/, msg: "provenance source:'rfq_accept' — marca do writer legado removida/alterada." },
      { re: /createBooking\(/, msg: 'createBooking( — cadeia legada booking removida sem revisão.' },
      { re: /createDecision\(/, msg: 'createDecision( — cadeia legada decision removida sem revisão.' },
      { re: /createPaymentRequest\(/, msg: 'createPaymentRequest( — cadeia legada payment_request removida sem revisão.' },
    ];
    for (const { re: fre, msg } of FROZEN) {
      if (!fre.test(body)) {
        failures.push(`${SERVICE_REL} acceptQuote: ${msg} RFQ_LEGACY_SERVICE_AVAILABILITY_REACTIVATED (mudança de forma exige atualizar este guard conscientemente).`);
      }
    }
  }
}

// Walker recursivo sobre src/, comment-stripped, pulando node_modules/dist/.git.
const SRC = join(ROOT, 'src');
const allTs = [];
(function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full);
    else if (/\.(ts|mts|cts)$/.test(e) && !/\.d\.ts$/.test(e)) allTs.push(full);
  }
})(SRC);

// ───────────────────────────────────────────────────────────────────────────
// CHECK B — nenhum caller NOVO de eventRFQService.acceptQuote( fora da allowlist morta.
// CHECK D — provenance availability source:'rfq_accept' só no writer morto (não vaza p/ outro ponto vivo).
// ───────────────────────────────────────────────────────────────────────────
for (const full of allTs) {
  const rel = norm(relative(ROOT, full));
  let src;
  try { src = stripTs(readFileSync(full, 'utf-8')); } catch { continue; }

  // CHECK B — caller de acceptQuote (chamada com ponto) fora da allowlist morta.
  if (/\.acceptQuote\s*\(/.test(src) && !ACCEPTQUOTE_CALLER_ALLOWLIST.has(rel)) {
    failures.push(`${rel}: caller de .acceptQuote( fora da allowlist morta — writer legado RFQ NOVO/alcançável. RFQ_LEGACY_SERVICE_AVAILABILITY_REACTIVATED. Reativar exige freezer R7b + frente própria.`);
  }

  // CHECK D — source:'rfq_accept' fora do writer morto (event-rfq.service.ts).
  if (/source:\s*'rfq_accept'/.test(src) && rel !== SERVICE_REL) {
    failures.push(`${rel}: escreve availability com source:'rfq_accept' fora do writer morto (${SERVICE_REL}) — fluxo rfq_accept não pode nascer de outro ponto vivo. RFQ_LEGACY_SERVICE_AVAILABILITY_REACTIVATED.`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CHECK B' — todos os callers da allowlist ainda existem (a allowlist não envelheceu silenciosamente).
// ───────────────────────────────────────────────────────────────────────────
for (const rel of ACCEPTQUOTE_CALLER_ALLOWLIST) {
  const c = read(rel);
  if (c === null) {
    failures.push(`allowlist desatualizada: ${rel} não existe mais — revisar a trava anti-reativação RFQ (remoção do caller morto exige atualizar este guard).`);
  } else if (!/\.acceptQuote\s*\(/.test(c)) {
    failures.push(`allowlist desatualizada: ${rel} não referencia mais .acceptQuote( — revisar a trava (o caller morto mudou de forma).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-rfq-legacy-availability-antirevival-guard]:');
  for (const f of failures) console.error('   - ' + f);
  console.error('\n   Contexto: o writer legado RFQ acceptQuote (availability owner_type=\'service\', source:\'rfq_accept\') está MORTO,');
  console.error('   contido pelo 403 da rota W6. Esta trava congela o estado-morto (lente SSOT temporal da DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT).');
  console.error('   Re-keyar/reativar exige frente própria (redesenho R7b) com owner canônico service_offering + decisão soberana.');
  process.exit(1);
}
console.log("GATE OK [event-rfq-legacy-availability-antirevival-guard] — writer legado RFQ congelado: rota W6 hard-stop 403 antes do sink; acceptQuote só na allowlist morta (rota contida + harness transversal); owner_type='service'+source:'rfq_accept'+cadeia booking/decision/payment_request intactos no writer morto; source:'rfq_accept' não vaza p/ ponto vivo. Reativação sem frente própria = bloqueada.");
