#!/usr/bin/env node
// Guard estrutural — F-ORCHESTRATED-CONTRACTING (C3): BIND CONFIÁVEL do performer ao ELENCO no confirm.
// Fecha o loop propose→accept→BIND: um booking de service_offering CONFIRMADO que carrega metadata.eventId
// vincula o PERFORMER (provider derivado server-side) ao elenco via o writer SELADO createCommitment. Bank-free.
//
// MORDE se:
//  (a) o bind usa o REQUESTER (ou um hint do body) em vez do PROVIDER derivado server-side (owner.authorityActorId);
//  (b) o bind NÃO é idempotente (sem checagem de linha existente em event_staff antes de createCommitment → duplo-bind);
//  (c) qualquer token porta-01/pagamento (service_payment_request|payment_intent|amount|cachê|split|payout) no caminho do bind;
//  (d) o bind é CRÍTICO ao confirm (não está em try/catch no chokepoint — uma falha do bind quebraria o booking confirmado);
//  (e) HOLLOW-EMIT (trap F4): o bind vira efeito no outbox (event_outbox/insertEventOutboxRow) em vez de acontecer de fato;
//  (f) surge SPINE de booking PARALELA (2º createBooking no bind) ou WRITER de vínculo PARALELO (INSERT INTO event_staff
//      fora do writer selado operational-commitments.service.ts) — deve REUSAR requestBooking + createCommitment.
// Estático, comment-stripped, region-anchored. Em regression-guards (anti-drift).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripCode = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')   // // linha
  .replace(/\/\*[\s\S]*?\*\//g, '')          // /* bloco */
  .replace(/--[^\n]*/g, '');                  // -- SQL
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripCode(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const PORTA01 = /service_payment_request|payment_intent\b|\bamount\b|cachê|\bsplit\b|payout/i;

// ── (1) HELPER do bind — reusa o writer SELADO, idempotente, money-free, sem writer paralelo ──
const BIND = 'src/core/availability/performer-event-binding.ts';
const bind = read(BIND);
if (bind === null) { failures.push(`arquivo ausente: ${BIND}`); }
else {
  // reuso do writer SELADO (createCommitment) — NÃO um 2º writer de vínculo.
  if (!/operationalCommitmentsService\.createCommitment\(/.test(bind)) failures.push(`${BIND}: bind não reusa o writer SELADO createCommitment (event_staff actor-first).`);
  // (f) writer de vínculo PARALELO proibido — nenhum INSERT direto em event_staff no helper.
  if (/INSERT\s+INTO\s+event_staff/i.test(bind)) failures.push(`${BIND}: INSERT direto em event_staff — writer de vínculo PARALELO proibido (§4.8; use createCommitment).`);
  // (f) spine de booking PARALELA proibida — o bind não cria booking.
  if (/createBooking\(/.test(bind)) failures.push(`${BIND}: createBooking no caminho do bind — spine de booking PARALELA proibida (§4.8).`);
  // (b) IDEMPOTÊNCIA — lê event_staff por (responsible_actor_id, role) ANTES de createCommitment.
  const selIdx = bind.search(/FROM\s+event_staff/i);
  const insIdx = bind.search(/createCommitment\(/);
  if (selIdx < 0 || !/responsible_actor_id/.test(bind) || !/\brole\b/.test(bind)) {
    failures.push(`${BIND}: sem checagem de idempotência (SELECT em event_staff por responsible_actor_id+role) — createCommitment NÃO deduplica.`);
  } else if (insIdx >= 0 && selIdx > insIdx) {
    failures.push(`${BIND}: checagem de idempotência ocorre DEPOIS de createCommitment — deve preceder o bind.`);
  }
  if (!/already_bound/.test(bind)) failures.push(`${BIND}: sem short-circuit de linha já existente (already_bound) — duplo-bind possível.`);
  // (a) PROVIDER derivado server-side — o helper vincula performerActorId, NUNCA um requesterActorId.
  if (/requesterActorId/i.test(bind)) failures.push(`${BIND}: referência a requesterActorId no helper de bind — o performer é o PROVIDER derivado server-side, nunca o requester.`);
  // (c) money-free / porta-01 FORA.
  if (PORTA01.test(bind)) failures.push(`${BIND}: token porta-01/pagamento no caminho do bind — o vínculo é factual/sem-economia (Bank-free).`);
  // (e) anti-hollow (Opção A síncrona): o bind NÃO passa pelo outbox.
  if (/insertEventOutboxRow|event_outbox/i.test(bind)) failures.push(`${BIND}: bind via outbox (hollow-emit, trap F4) — o vínculo deve ACONTECER de fato (createCommitment síncrono), não virar efeito.`);
}

// ── (2) CHOKEPOINT — bind no confirm ÚNICO: provider derivado, NÃO-CRÍTICO (try/catch), síncrono ──
const CHK = 'src/core/availability/unified-availability.service.ts';
const chk = read(CHK);
if (chk === null) { failures.push(`arquivo ausente: ${CHK}`); }
else {
  // região do bind C3 — ancorada em CÓDIGO (comentários são strip-ados): da chamada do helper recuando ao try{
  // que a envolve, até o return do confirm SERVICE_OFFERING.
  const anchor = chk.search(/bindConfirmedPerformerToEvent\(/);
  if (anchor < 0) { failures.push(`${CHK}: bind C3 (bindConfirmedPerformerToEvent) ausente no chokepoint de confirm.`); }
  else {
    const start = chk.lastIndexOf('try', anchor);
    const region = chk.slice(start >= 0 ? start : anchor, chk.indexOf('return confirmedBooking', anchor) + 40);
    // (a) PROVIDER derivado server-side (owner.authorityActorId), NUNCA requester/body.
    if (!/performerActorId:\s*owner\.authorityActorId/.test(region)) failures.push(`${CHK}: bind não passa owner.authorityActorId como performer (provider derivado server-side).`);
    if (/requesterActorId|\brequester\b|req\.body|\.body\b/.test(region)) failures.push(`${CHK}: bind referencia requester/body — o performer DEVE ser o provider derivado server-side (owner.authorityActorId).`);
    // reuso do helper (sem fork).
    if (!/bindConfirmedPerformerToEvent\(/.test(region)) failures.push(`${CHK}: bind não chama o helper bindConfirmedPerformerToEvent (reuso, sem fork).`);
    // (d) NÃO-CRÍTICO — o bind vive dentro de try{...}catch{...} (falha não desfaz o confirm).
    if (!/try\s*\{[\s\S]*bindConfirmedPerformerToEvent\([\s\S]*\}\s*catch/.test(region)) failures.push(`${CHK}: bind não está em try/catch — deve ser NÃO-CRÍTICO (uma falha jamais desfaz o booking confirmado).`);
    // (f) sem writer de vínculo paralelo no chokepoint.
    if (/INSERT\s+INTO\s+event_staff/i.test(region)) failures.push(`${CHK}: INSERT direto em event_staff no chokepoint — writer paralelo proibido.`);
    // (c) porta-01 fora do bloco de bind.
    if (PORTA01.test(region)) failures.push(`${CHK}: token porta-01/pagamento no bloco de bind — Bank-free.`);
  }
}

// ── (3) WRITER de vínculo ÚNICO — event_staff só é inserido pelo writer SELADO (operational-commitments) ──
const COMMIT = 'src/core/events/operational-commitments.service.ts';
const commit = read(COMMIT);
if (commit === null) { failures.push(`arquivo ausente: ${COMMIT}`); }
else if (!/INSERT\s+INTO\s+event_staff/i.test(commit)) failures.push(`${COMMIT}: writer selado de event_staff (createCommitment) sumiu — o bind perdeu o alvo.`);

// ── (4) EDGE C-1 — requestBooking carrega contexto (metadata) com AUTORIDADE de evento reusada ──
const SVC = 'src/modules/services/service-offering.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  if (!/assertEventContractingAuthority\(/.test(svc)) failures.push(`${SVC}: EDGE C-1 sem autoridade de evento (assertEventContractingAuthority).`);
  // reusa a decisão SELADA de autoridade (canActAs manage_attendees), não forka.
  if (!/canActAs\([^)]*'manage_attendees'\)/.test(svc)) failures.push(`${SVC}: EDGE C-1 não reusa a decisão de autoridade canActAs('manage_attendees') (mesma chave do commitments).`);
  // contexto é repassado como metadata no createBooking (persistência JSONB existente).
  if (!/metadata:\s*bookingMetadata/.test(svc)) failures.push(`${SVC}: EDGE C-1 não repassa o contexto como metadata no createBooking.`);
  // configId é SOFT (metadata-only), sem FK dura.
  if (!/assertConfigBelongsToOffering\(/.test(svc)) failures.push(`${SVC}: EDGE C-1 sem validação SOFT de configId (assertConfigBelongsToOffering).`);
}

// ── (5) wiring: o guard está registrado no runner (anti-drift) ──
const runner = read('scripts/run-regression-guards.mjs');
if (runner && !/audit-performer-event-binding\.mjs/.test(runner)) failures.push('run-regression-guards.mjs: este guard não está em CMDS[] (anti-drift).');

// universo sanity (fail-closed se scripts dir sumir)
if (!existsSync(join(ROOT, 'scripts')) || readdirSync(join(ROOT, 'scripts')).length === 0) failures.push('scripts/ vazio/ausente — fail-closed.');

if (failures.length > 0) {
  console.error('GATE FAIL [performer-event-binding]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [performer-event-binding] — F-ORCHESTRATED-CONTRACTING C3: bind CONFIÁVEL do performer (provider derivado server-side, nunca o requester) ao elenco via writer SELADO createCommitment; IDEMPOTENTE (checa linha existente antes); NÃO-CRÍTICO (try/catch no chokepoint ÚNICO); síncrono/anti-hollow (sem outbox oco — trap F4); sem spine de booking nem writer de vínculo paralelo; EDGE C-1 carrega contexto (metadata) com canActAs(manage_attendees) reusado; Bank-free.');
