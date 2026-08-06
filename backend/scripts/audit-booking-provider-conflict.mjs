#!/usr/bin/env node
// backend/scripts/audit-booking-provider-conflict.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — cobre APENAS owner_type='service_offering'
// ║ NORMA:   docs/02_decisions/DECISION_0146_… §A.3 (rollup por provider) · §B-bis G10
// ║ NÃO:     ler "fica fora do guard" como conformidade com a G10 — a G10 manda PARAR
// ║ EM VEZ:  owner_type ≠ service_offering hoje CONFIRMA SEM TRAVA — ver GATE_F0 §1(a)
// ╚════════════════════════════════════════════════════════════════
//
// ⚠️ CORREÇÃO DE ATRIBUIÇÃO (2026-08-05, GO Clayton): a mensagem da checagem do gate `SERVICE_OFFERING`
// citava a **G10** como se ela autorizasse deixar os outros owner_types fora da trava. Ela não autoriza —
// diz o contrário: *"Resolução ambígua/ausente → **STOP_DECISION_REQUIRED** […] para (não adivinhar o
// recurso)"*. Norma manda PARAR; o código CONFIRMA; e o guard carimbava a passagem citando a norma.
// **Comentário que mente dentro de um guard é pior que dentro de código** — guard é onde as pessoas vão
// ler a regra. Corrigida a mensagem; o comportamento do guard NÃO mudou (ele nunca cobriu os outros
// owner_types, e continua não cobrindo — o que mudou é ele parar de chamar isso de conformidade).
//
// Guard estrutural — F-OFFER-5/6 (DECISION-0146): integridade temporal da oferta + conflito de booking por provider.
//
// O COMPROMISSO (confirm de booking) recusa, fail-closed e à prova de corrida, um 2º booking do MESMO
// provider_actor_id em status bloqueante {confirmed,checked_in,checked_out} com intervalo [start,end) sobreposto;
// availability (DECLARAÇÃO) NUNCA é bloqueada. MORDE se: sumir o guard no confirm; provider vier do body em vez
// de derivado server-side; conjunto bloqueante perder checked_out; rollup deixar de ser por provider_actor_id;
// sumir o advisory lock; self deixar de ser excluído; overlap virar BETWEEN (fechado) em vez de [start,end);
// ou o guard passar a depender do stub detect_availability_conflicts. Estático, comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

// ── repository: o guard transacional de confirm ──
const REPO = 'src/core/availability/unified-availability.repository.ts';
const repo = read(REPO);
if (repo === null) { failures.push(`arquivo ausente: ${REPO}`); }
else {
  if (!/confirmBookingWithProviderLock/.test(repo)) failures.push(`${REPO}: método confirmBookingWithProviderLock ausente (guard de confirm).`);
  if (!/pg_advisory_xact_lock/.test(repo)) failures.push(`${REPO}: sem pg_advisory_xact_lock (concorrência/anti-phantom — G7).`);
  if (!/status IN \('confirmed','checked_in','checked_out'\)/.test(repo)) failures.push(`${REPO}: conjunto bloqueante não é {confirmed,checked_in,checked_out} (G4; checked_out obrigatório).`);
  if (!/so2\.provider_actor_id = \$2/.test(repo)) failures.push(`${REPO}: rollup não é por provider_actor_id (G3; conflito é cross-oferta do provider, não por offering isolada).`);
  if (!/b2\.booking_id <> \$3/.test(repo)) failures.push(`${REPO}: self booking não excluído da busca de conflito (falso-positivo na reconfirmação).`);
  if (!/a2\.start_datetime < \$5/.test(repo) || !/a2\.end_datetime > \$4/.test(repo)) failures.push(`${REPO}: overlap não é meio-aberto [start,end) (G8; back-to-back deve NÃO conflitar).`);
  if (!/JOIN service_offerings so2/.test(repo)) failures.push(`${REPO}: cadeia booking→availability→service_offerings ausente (derivação do provider).`);
  if (!/UPDATE bookings SET status = 'confirmed'/.test(repo)) failures.push(`${REPO}: o guard não grava o confirm na MESMA transação (atomicidade).`);
  // escopo: SÓ o método novo (entre confirmBookingWithProviderLock e o método seguinte) não pode depender do stub.
  const _mStart = repo.indexOf('async confirmBookingWithProviderLock');
  const _mEnd = repo.indexOf('async findBookingById');
  const _confirmMethod = (_mStart >= 0 && _mEnd > _mStart) ? repo.slice(_mStart, _mEnd) : '';
  if (/detect_availability_conflicts/.test(_confirmMethod)) failures.push(`${REPO}: guard de confirm não pode depender do stub detect_availability_conflicts.`);
  // availability é DECLARAÇÃO — o guard não pode bloquear/alterar availability
  if (/UPDATE availability SET status/.test(_confirmMethod)) failures.push(`${REPO}: o guard NÃO pode alterar status de availability (declaração não bloqueia — G1).`);
}

// ── service: a transição p/ confirm aciona o guard, provider derivado server-side ──
const SVC = 'src/core/availability/unified-availability.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  if (!/input\.status === UnifiedBookingStatus\.CONFIRMED/.test(svc)) failures.push(`${SVC}: guard não incide na transição p/ confirmed (G11; não pode ficar só no createBooking).`);
  if (!/confirmBookingWithProviderLock/.test(svc)) failures.push(`${SVC}: confirm não chama o guard transacional confirmBookingWithProviderLock.`);
  if (!/resolveAvailabilityOwner\(/.test(svc)) failures.push(`${SVC}: provider não é derivado server-side (resolveAvailabilityOwner — G9).`);
  if (!/AvailabilityOwnerType\.SERVICE_OFFERING/.test(svc)) failures.push(`${SVC}: sem gate owner_type=service_offering — este guard cobre SOMENTE service_offering. ⚠️ owner_type≠service_offering está FORA da cobertura deste guard, e isso NÃO é conformidade com a G10: a G10 manda STOP_DECISION_REQUIRED, e o código hoje CONFIRMA SEM TRAVA (ver GATE_F0 §1(a)).`);
  if (/providerActorId:\s*input\./.test(svc) || /input\.providerActorId/.test(svc)) failures.push(`${SVC}: provider_actor_id NÃO pode vir do body (G9).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [booking-provider-conflict]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [booking-provider-conflict] — F-OFFER-5/6: confirm recusa 2º compromisso do mesmo provider (status {confirmed,checked_in,checked_out}, intervalo [start,end), self excluído, rollup por provider, advisory-lock transacional); provider derivado server-side; availability declarativa não bloqueada. DECISION-0146 blindada.');
