#!/usr/bin/env node
// Guard estrutural — F-PERFORMER-CONTRACTING-POLICY: política de contratação da oferta do performer
// (aceita-direto × negocia + gate de DISTÂNCIA). Bank-free.
//
// MORDE se: (a) o auto-confirm deixar de passar pelo CHOKEPOINT ÚNICO de confirm
// (unifiedAvailabilityService.updateBooking → confirmBookingWithProviderLock, SELADO) OU forkar o lock chamando
// confirmBookingWithProviderLock direto no módulo (segundo caminho de confirm — §4.8); (b) o gate de distância
// deixar de rodar ANTES do confirm, ou parar de reusar o primitivo geo canônico (actor_active_location +
// haversine_distance_km — §2 sem geo paralelo); (c) a política deixar de ser CHECK-governed (virar enum type),
// sumir o CHECK físico automatic-exige-distância, ou a migration ganhar campo FINANCEIRO (Bank-free violado).
// Estático, comment-stripped, region-anchored. Em regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripCode = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')   // // linha
  .replace(/\/\*[\s\S]*?\*\//g, '')          // /* bloco */
  .replace(/--[^\n]*/g, '');                  // -- SQL
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripCode(readFileSync(p, 'utf-8')) : null; };
const failures = [];

// ── (b/c) MIGRATION: colunas REAIS + CHECK-governed + automatic-exige-distância + Bank-free ──
const MIG = 'migrations/20260723100000_service_offering_contracting_policy.sql';
const mig = read(MIG);
if (mig === null) { failures.push(`arquivo ausente: ${MIG}`); }
else {
  if (!/ADD COLUMN IF NOT EXISTS booking_approval_mode/i.test(mig)) failures.push(`${MIG}: coluna booking_approval_mode ausente (política = coluna REAL, não JSONB).`);
  if (!/ADD COLUMN IF NOT EXISTS accept_direct_same_city/i.test(mig)) failures.push(`${MIG}: coluna accept_direct_same_city ausente.`);
  if (!/ADD COLUMN IF NOT EXISTS accept_direct_radius_km/i.test(mig)) failures.push(`${MIG}: coluna accept_direct_radius_km ausente.`);
  // vocabulário GOVERNADO por CHECK — NÃO enum type (§4.9.7).
  if (!/CHECK\s*\(\s*booking_approval_mode IN \(\s*'manual'\s*,\s*'automatic'\s*\)\s*\)/i.test(mig)) failures.push(`${MIG}: mode não é CHECK ('manual','automatic') — não pode virar enum type (§4.9.7).`);
  if (/CREATE TYPE|::.*_enum|AS ENUM/i.test(mig)) failures.push(`${MIG}: vocabulário via enum type proibido — a política é CHECK, não enum.`);
  // CHECK físico automatic-exige-distância.
  if (!/chk_service_offering_automatic_requires_distance/i.test(mig)) failures.push(`${MIG}: CHECK automatic-exige-distância (chk_service_offering_automatic_requires_distance) ausente.`);
  if (!/booking_approval_mode <> 'automatic'\s*OR\s*accept_direct_same_city = true\s*OR\s*accept_direct_radius_km IS NOT NULL/i.test(mig.replace(/\s+/g, ' '))) failures.push(`${MIG}: predicado do CHECK automatic-exige-distância não confere (automatic ⇒ same_city OR radius).`);
  // radius > 0.
  if (!/accept_direct_radius_km IS NULL OR accept_direct_radius_km > 0/i.test(mig)) failures.push(`${MIG}: CHECK radius_km > 0 ausente.`);
  // Bank-free: nenhum campo financeiro NOVO na migration (comment-stripped).
  if (/\b(price|cents|amount|fee|_bps|tax|money|payout|ledger|wallet)\b/i.test(mig)) failures.push(`${MIG}: campo/token FINANCEIRO na migration — a fatia é Bank-free (preço fora).`);
}

// ── (a) SERVICE: chokepoint ÚNICO de confirm + gate antes de mutar + geo canônico reusado ──
const SVC = 'src/modules/services/service-offering.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  if (!/async requestBooking\(/.test(svc)) failures.push(`${SVC}: entrypoint requestBooking (nível da oferta) ausente.`);
  // auto-confirm passa pelo CHOKEPOINT ÚNICO (updateBooking → CONFIRMED), NÃO forka o lock.
  if (!/unifiedAvailabilityService\.updateBooking\(/.test(svc)) failures.push(`${SVC}: auto-confirm não passa pelo chokepoint unifiedAvailabilityService.updateBooking (single confirm — §4.8).`);
  if (!/UnifiedBookingStatus\.CONFIRMED/.test(svc)) failures.push(`${SVC}: auto-confirm não transita para CONFIRMED via chokepoint.`);
  if (/confirmBookingWithProviderLock/.test(svc)) failures.push(`${SVC}: chamada DIRETA a confirmBookingWithProviderLock — fork do lock / segundo caminho de confirm proibido (§4.8; use o chokepoint).`);
  // gate de distância roda ANTES do confirm (validate-before-mutate §4.9.5) e é fail-closed a NEGOCIA.
  if (!/isWithinContractingReach\(/.test(svc)) failures.push(`${SVC}: gate de distância isWithinContractingReach ausente.`);
  // geo CANÔNICO reusado — sem caminho paralelo (§2).
  if (!/actorActiveLocationRepository/.test(svc)) failures.push(`${SVC}: gate não reusa actor_active_location (SSOT geo — DECISION-0030).`);
  if (!/haversine_distance_km/.test(svc)) failures.push(`${SVC}: gate não reusa a fn SQL SELADA haversine_distance_km (não recalcular distância em JS / geo paralelo — §2).`);
  // política CHECK-espelhada no writer (automatic exige distância) — validate-before-write.
  if (!/assertContractingPolicy\(/.test(svc)) failures.push(`${SVC}: writer sem assertContractingPolicy (espelho do CHECK automatic-exige-distância, §4.9.5).`);
  // Bank-free: requestBooking não executa dinheiro.
  const _rb = svc.slice(svc.indexOf('async requestBooking('));
  if (/executePayment|bankLedger|createLedger|payout|wallet/i.test(_rb)) failures.push(`${SVC}: requestBooking toca dinheiro — a fatia é Bank-free.`);
}

// ── reuso: o CHOKEPOINT SELADO ainda existe (alvo do confirm) ──
const CHK = 'src/core/availability/unified-availability.service.ts';
const chk = read(CHK);
if (chk === null) { failures.push(`arquivo ausente: ${CHK}`); }
else if (!/confirmBookingWithProviderLock\(/.test(chk)) failures.push(`${CHK}: chokepoint confirmBookingWithProviderLock sumiu — o auto-confirm perdeu o alvo SELADO.`);

// ── wiring: o guard está registrado no runner (anti-drift) ──
const runner = read('scripts/run-regression-guards.mjs');
if (runner && !/audit-service-offering-contracting-policy\.mjs/.test(runner)) failures.push('run-regression-guards.mjs: este guard não está em CMDS[] (anti-drift).');

// universo sanity (fail-closed se scripts dir sumir)
if (!existsSync(join(ROOT, 'scripts')) || readdirSync(join(ROOT, 'scripts')).length === 0) failures.push('scripts/ vazio/ausente — fail-closed.');

if (failures.length > 0) {
  console.error('GATE FAIL [service-offering-contracting-policy]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-offering-contracting-policy] — F-PERFORMER-CONTRACTING-POLICY: aceita-direto × negocia + gate de DISTÂNCIA; política CHECK-governed (não enum) com CHECK físico automatic-exige-distância; auto-confirm pelo chokepoint ÚNICO (updateBooking→confirmBookingWithProviderLock, sem fork); geo canônico (actor_active_location + haversine_distance_km) reusado sem paralelo; validate-before-mutate; Bank-free.');
