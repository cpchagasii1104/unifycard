#!/usr/bin/env node
// backend/scripts/audit-booking-provider-conflict.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — cobre service_offering E user (rollup por provider, 0196 §D.1)
// ║ NORMA:   DECISION_0146 §A.3 (rollup por provider) · §B-bis G10 · DECISION_0196 §D.1
// ║ NÃO:     estreitar o rollup de volta à oferta — cega a agenda pessoal em silêncio
// ║ EM VEZ:  owner_type fora de {service_offering, actor_asset, user} PARA com 501 (G10)
// ╚════════════════════════════════════════════════════════════════
//
// ⚠️ ERRATA DO PRÓPRIO CABEÇALHO (2026-08-06): até hoje ele dizia "cobre APENAS service_offering" e
// "owner_type ≠ service_offering hoje CONFIRMA SEM TRAVA". As duas frases eram verdadeiras quando
// escritas e deixaram de ser no MESMO dia: o terceiro ramo passou a PARAR
// (F-CONFIRM-THIRD-BRANCH-STOP) e o rollup passou a cobrir `user` (DECISION-0196 §D.1).
// Cabeçalho de guard que envelhece é a doença que este arquivo já teve uma vez — corrigido de novo.
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
  // 🔴 ROLLUP GENERALIZADO (DECISION-0196 §D.1) — o provider aparece em DUAS superfícies temporais:
  // a availability da OFERTA e a availability do PRÓPRIO ACTOR (owner_type='user'). Se alguém
  // reverter a segunda, o confirm de agenda pessoal volta a NÃO ACHAR CONFLITO NENHUM — e isso é
  // PIOR que o 501 anterior, porque confirma calado. Substância: a cláusula por owner_id, não o nome.
  if (!/a2\.owner_type = 'user'\s*\)?\s*AND\s+a2\.owner_id = \$2/.test(repo)) {
    failures.push(`${REPO}: o rollup NÃO cobre owner_type='user' (DECISION-0196 §D.1). Sem a cláusula por a2.owner_id, o confirm de agenda pessoal confirma SEM detectar conflito — pior que o STOP.`);
  }
  if (!/LEFT JOIN service_offerings so2/.test(repo)) failures.push(`${REPO}: o JOIN com service_offerings precisa ser LEFT — com INNER, a linha de owner_type='user' (que não tem oferta) é DESCARTADA e o rollup volta a cegar a agenda pessoal.`);
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
  if (!/AvailabilityOwnerType\.SERVICE_OFFERING/.test(svc)) failures.push(`${SVC}: sem gate owner_type=service_offering (rollup por provider — G3/§A.3).`);
  // DECISION-0196 §D.1: a agenda pessoal tem ramo PRÓPRIO, com o mesmo lock e o rollup generalizado.
  // Sem ele, `user` volta a cair no STOP — regressão silenciosa de produto (agenda pessoal deixa de
  // ser contratável) que nenhum outro guard pega.
  if (!/AvailabilityOwnerType\.USER/.test(svc)) failures.push(`${SVC}: sem ramo owner_type=user no confirm (DECISION-0196 §D.1) — a agenda pessoal volta a ser não-contratável.`);
  if (/providerActorId:\s*input\./.test(svc) || /input\.providerActorId/.test(svc)) failures.push(`${SVC}: provider_actor_id NÃO pode vir do body (G9).`);

  // ── F-CONFIRM-THIRD-BRANCH-STOP (G10) — o TERCEIRO RAMO tem de PARAR, não cair fora ──────────
  // 🔴 SUBSTÂNCIA, não string: não basta o código do STOP aparecer no arquivo. O que a G10 exige é
  // que NÃO EXISTA caminho de saída do bloco de confirm sem trava. Então: recorta o bloco por
  // BALANCEAMENTO DE CHAVES e confere que a ÚLTIMA instrução dele é um `throw`. Se alguém puser o
  // STOP dentro de um `if`, ou acrescentar um 4º ramo depois dele, o bloco deixa de terminar em
  // throw e este guard MORDE — que é exatamente o defeito que existiu de 2026-06-21 a 2026-08-06.
  const CONFIRM_HEAD = 'if (input.status === UnifiedBookingStatus.CONFIRMED) {';
  const head = svc.indexOf(CONFIRM_HEAD);
  if (head < 0) {
    failures.push(`${SVC}: bloco de confirm não localizado para auditar o terceiro ramo (G10).`);
  } else {
    let i = head + CONFIRM_HEAD.length - 1; // na '{' de abertura
    let depth = 0;
    let end = -1;
    for (; i < svc.length; i++) {
      const ch = svc[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) {
      failures.push(`${SVC}: não foi possível fechar o bloco de confirm (chaves desbalanceadas?) — auditoria do G10 indeterminada.`);
    } else {
      const block = svc.slice(head, end);
      if (!/BOOKING_CONFIRM_STOP_DECISION_REQUIRED/.test(block)) {
        failures.push(`${SVC}: terceiro ramo do confirm sem STOP — owner_type fora de {service_offering, actor_asset} confirmaria SEM TRAVA. A G10 manda STOP_DECISION_REQUIRED, não "confirma normal".`);
      }
      // Nada pode escapar POR BAIXO dos ramos travados: o STOP tem de vir DEPOIS do último `return`
      // de ramo. Se alguém acrescentar um 4º ramo que retorna após o STOP, isto morde.
      if (block.lastIndexOf('throw ') < block.lastIndexOf('return ')) {
        failures.push(`${SVC}: há caminho de saída do confirm DEPOIS do STOP — o último ramo do bloco retorna em vez de parar (G10).`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [booking-provider-conflict]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [booking-provider-conflict] — F-OFFER-5/6: confirm recusa 2º compromisso do mesmo provider (status {confirmed,checked_in,checked_out}, intervalo [start,end), self excluído, rollup por provider, advisory-lock transacional); provider derivado server-side; availability declarativa não bloqueada. 🔴 ROLLUP GENERALIZADO (0196 §D.1): o conflito por provider atravessa a availability da OFERTA E a do PROPRIO ACTOR (owner_type=user, LEFT JOIN) — um corpo, uma agenda. 🔴 TERCEIRO RAMO PARA (G10): owner_type fora de {service_offering, actor_asset, user} lança BOOKING_CONFIRM_STOP_DECISION_REQUIRED — conferido por BALANCEAMENTO DE CHAVES do bloco de confirm (nada escapa por baixo dos ramos travados), não por presença de string. DECISION-0146 blindada.');
