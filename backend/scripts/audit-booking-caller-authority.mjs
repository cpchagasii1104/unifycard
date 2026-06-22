#!/usr/bin/env node
// Guard estrutural INTERIM (D) — F-BOOKING-CORE-AUTHORITY-HARDENING-D1-GUARD-INTERIM.
//
// Congela a disciplina ATUAL dos callers de `unifiedAvailabilityService.createBooking`: o CORE não revalida
// autoridade (DECISION-0113 channel-1: rota gateia, core confia) e o param `userId` é semanticamente
// inconsistente entre callers (actorId / user_id / global_user_id) — por isso `canRepresentActor` no core foi
// DESCARTADO agora (quebraria fluxo legítimo). Até a DECISION do subject-model (F-BOOKING-CORE-SUBJECT-MODEL-
// DECISION), este guard torna a disciplina ENFORCEABLE: todo call-site precisa estar classificado.
//
// NÃO altera runtime. MORDE se: surgir call-site NÃO classificado; um BOUND perder o binding (canRepresentActor/
// bindWriteActor); o FIREWALL_CONTAINED perder o firewall; um SELF_BOOKING_ALLOWLIST passar a aceitar requester
// ARBITRÁRIO do body (em vez de derivar server-side). Estático, comment-stripped. Em validate:regression-guards.

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');
const readRel = (r) => { const p = join(ROOT, r); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const CALL_RE = /unifiedAvailabilityService\.createBooking\(/;
const FORBID_BODY_REQUESTER = /(req|request|body|input)\.body?\.?requesterActorId|requesterActorId\s*:\s*(req|request)\b/;

// Allowlist EXPLÍCITA dos call-sites atuais (cada um classificado + evidência viva da contenção/binding).
const ALLOW = {
  'src/core/availability/unified-availability.routes.ts': { cls: 'BOUND', ev: /canRepresentActor/ },
  'src/modules/services/service-bundle.service.ts': { cls: 'BOUND', evFile: 'src/modules/services/service-bundle.routes.ts', ev: /canRepresentActor|bindWriteActor/ },
  'src/modules/services/service-hire.routes.ts': { cls: 'FIREWALL_CONTAINED', ev: /isServiceFinancialRuntimeEnabled/ },
  'src/modules/events/checkout-ticket.service.ts': { cls: 'SELF_BOOKING_ALLOWLIST', ev: /global_user_id/ },
  'src/modules/events/event-rfq.service.ts': { cls: 'SELF_BOOKING_ALLOWLIST', ev: /organizer/i },
  'src/scripts/e2e-offer-activation-p3.ts': { cls: 'TEST_ONLY' },
  'src/scripts/e2e-offer-journey-pre-money.ts': { cls: 'TEST_ONLY' },
};

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const fails = [];
const found = [];
for (const abs of walk(join(ROOT, 'src'))) {
  const src = stripTs(readFileSync(abs, 'utf-8'));
  if (CALL_RE.test(src)) found.push({ r: rel(abs), src });
}

// 1) completude da allowlist — call-site novo não classificado MORDE.
for (const { r } of found) {
  if (!ALLOW[r]) fails.push(`call-site NÃO classificado: ${r} — classifique em audit-booking-caller-authority.mjs (BOUND/SELF_BOOKING_ALLOWLIST/FIREWALL_CONTAINED/TEST_ONLY) ou remova a chamada.`);
}

// 2) invariante por classe — perda de binding/firewall/derivação MORDE.
for (const { r, src } of found) {
  const spec = ALLOW[r];
  if (!spec) continue;
  if (spec.cls === 'TEST_ONLY') {
    if (!r.startsWith('src/scripts/')) fails.push(`${r}: classificado TEST_ONLY mas não está em src/scripts/.`);
    continue;
  }
  if (spec.cls === 'BOUND') {
    const evSrc = spec.evFile ? readRel(spec.evFile) : src;
    if (!evSrc || !spec.ev.test(evSrc)) fails.push(`${r}: BOUND perdeu o binding (esperado ${spec.ev} em ${spec.evFile || r}).`);
  } else if (spec.cls === 'FIREWALL_CONTAINED') {
    if (!spec.ev.test(src)) fails.push(`${r}: FIREWALL_CONTAINED perdeu o firewall (esperado ${spec.ev}).`);
  } else if (spec.cls === 'SELF_BOOKING_ALLOWLIST') {
    if (!spec.ev.test(src)) fails.push(`${r}: SELF_BOOKING_ALLOWLIST perdeu a derivação server-side do requester (esperado ${spec.ev}).`);
    if (FORBID_BODY_REQUESTER.test(src)) fails.push(`${r}: SELF_BOOKING_ALLOWLIST passou a aceitar requesterActorId ARBITRÁRIO do body — proibido sem subject-model decidido (F-BOOKING-CORE-SUBJECT-MODEL-DECISION).`);
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [booking-caller-authority]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [booking-caller-authority] — ${found.length} call-sites de createBooking classificados (BOUND: rota canônica+bundle; FIREWALL_CONTAINED: service-hire/0110; SELF_BOOKING_ALLOWLIST: checkout-ticket/event-rfq derivam server-side; TEST_ONLY: e2e). Core não revalida autoridade (DECISION-0113 channel-1) — disciplina congelada até F-BOOKING-CORE-SUBJECT-MODEL-DECISION (B).`);
