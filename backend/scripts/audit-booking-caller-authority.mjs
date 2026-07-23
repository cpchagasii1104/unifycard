#!/usr/bin/env node
// Guard estrutural — F-BOOKING-CORE-SUBJECT-MODEL (DECISION-0148, Opção B materializada).
//
// O core `unifiedAvailabilityService.createBooking` recebe um BookingSubject normalizado
// ({subjectUserId, requesterActorId}) e REVALIDA autoridade (canRepresentActor) server-side — não confia só
// no caller. Cada call-site passa um subject (nunca `userId` cru / actorId / global_user_id como subjectUserId);
// checkout normaliza global_user_id→user_id antes do subject. Todo call-site fica classificado.
//
// MORDE se: o CORE perder `canRepresentActor`/o subject; um call-site não passar `subjectUserId` (raw userId);
// surgir call-site não classificado; um BOUND perder binding; FIREWALL_CONTAINED perder firewall; SELF perder a
// derivação server-side ou aceitar requester do body; checkout deixar de normalizar para user_id. Estático.

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');
const readRel = (r) => { const p = join(ROOT, r); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const CALL_RE = /unifiedAvailabilityService\.createBooking\(/;
const FORBID_BODY_REQUESTER = /(req|request|body|input)\.body?\.?requesterActorId|requesterActorId\s*:\s*(req|request)\b/;

// Allowlist EXPLÍCITA dos call-sites (classe + evidência viva). SELF deve derivar subject server-side.
const ALLOW = {
  'src/core/availability/unified-availability.routes.ts': { cls: 'BOUND', ev: /canRepresentActor/ },
  'src/modules/services/service-bundle.service.ts': { cls: 'BOUND', evFile: 'src/modules/services/service-bundle.routes.ts', ev: /canRepresentActor|bindWriteActor/ },
  // Reserva de recurso alugável (modelo Airbnb). O requesterActorId vem do actionContext server-side
  // (DECISION-0113), NUNCA do body; o core createBooking revalida canRepresentActor (0148). A auto-
  // confirmação (approval_mode=automatic) é pré-autorização do DONO aplicada server-side, não do consumidor.
  'src/modules/rentals/rentable-resource.service.ts': { cls: 'BOUND', evFile: 'src/modules/rentals/rentable-resource.routes.ts', ev: /actionContext\?\.actorId/ },
  // Reserva de oferta de serviço (requestBooking, F-PERFORMER-CONTRACTING-POLICY). requesterActorId vem do body
  // mas a ROTA revalida canRepresentActor(userId, requesterActorId)→403 SERVICE_OFFERING_BOOK_NOT_REPRESENTABLE
  // ANTES de chamar; subjectUserId=userId (req.user, server-side); core createBooking revalida (0148). aceita-direto
  // (approval_mode=automatic) = pré-autorização do DONO aplicada server-side no chokepoint, não do consumidor.
  'src/modules/services/service-offering.service.ts': { cls: 'BOUND', evFile: 'src/modules/services/service-offerings.routes.ts', ev: /canRepresentActor/ },
  'src/modules/services/service-hire.routes.ts': { cls: 'FIREWALL_CONTAINED', ev: /isServiceFinancialRuntimeEnabled/ },
  'src/modules/events/checkout-ticket.service.ts': { cls: 'SELF_BOOKING_ALLOWLIST', ev: /user_id/ },
  'src/modules/events/event-rfq.service.ts': { cls: 'SELF_BOOKING_ALLOWLIST', ev: /organizer/i },
  'src/scripts/e2e-offer-activation-p3.ts': { cls: 'TEST_ONLY' },
  'src/scripts/e2e-offer-journey-pre-money.ts': { cls: 'TEST_ONLY' },
  'src/scripts/e2e-booking-subject-authority.ts': { cls: 'TEST_ONLY' },
  'src/scripts/e2e-rental-resource-conflict.ts': { cls: 'TEST_ONLY' },
  'src/scripts/validate-pipeline-e2e-mvp-service-journey-seed.ts': { cls: 'TEST_ONLY' },
  'src/scripts/validate-pipeline-e2e-mvp-service-journey-pj-provider.ts': { cls: 'TEST_ONLY' },
  'src/scripts/validate-pipeline-e2e-service-booking-decision-quarantine-gate.ts': { cls: 'TEST_ONLY' },
  'src/scripts/validate-pipeline-e2e-service-booking-requested-effect-emission.ts': { cls: 'TEST_ONLY' },
  'src/scripts/smoke-rental-locacao.ts': { cls: 'TEST_ONLY' }, // 2026-07-07, catálogo veículo (achado Yala)
  'src/scripts/validate-pipeline-e2e-availability-conflict-detection-materialized.ts': { cls: 'TEST_ONLY' },
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

// 0) CORE — DECISION-0148: createBooking recebe subject + REVALIDA canRepresentActor.
const CORE = 'src/core/availability/unified-availability.service.ts';
const core = readRel(CORE);
if (core === null) fails.push(`arquivo ausente: ${CORE}`);
else {
  if (!/async createBooking\([\s\S]{0,160}subject: BookingSubject/.test(core)) fails.push(`${CORE}: core createBooking não recebe BookingSubject (DECISION-0148).`);
  if (!/async createBooking\([\s\S]{0,2600}canRepresentActor\(/.test(core)) fails.push(`${CORE}: core createBooking NÃO revalida canRepresentActor (DECISION-0148 — core auto-defensivo).`);
}

// descobre call-sites
const found = [];
for (const abs of walk(join(ROOT, 'src'))) {
  const src = stripTs(readFileSync(abs, 'utf-8'));
  if (CALL_RE.test(src)) found.push({ r: rel(abs), src });
}

// 1) completude da allowlist
for (const { r } of found) {
  if (!ALLOW[r]) fails.push(`call-site NÃO classificado: ${r} — classifique no guard (BOUND/SELF_BOOKING_ALLOWLIST/FIREWALL_CONTAINED/TEST_ONLY) ou remova a chamada.`);
}

// 2) contrato do subject + invariante por classe
for (const { r, src } of found) {
  const spec = ALLOW[r];
  if (!spec) continue;
  // todo call-site passa um subject normalizado (nunca userId cru).
  if (!/subjectUserId/.test(src)) fails.push(`${r}: call-site de createBooking não passa BookingSubject (subjectUserId ausente — DECISION-0148; proibido userId cru).`);

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
    if (!spec.ev.test(src)) fails.push(`${r}: SELF_BOOKING_ALLOWLIST perdeu a derivação server-side do subject (esperado ${spec.ev}).`);
    if (FORBID_BODY_REQUESTER.test(src)) fails.push(`${r}: SELF_BOOKING_ALLOWLIST passou a aceitar requesterActorId ARBITRÁRIO do body — proibido.`);
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [booking-caller-authority]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [booking-caller-authority] — DECISION-0148 materializada: core createBooking recebe BookingSubject + revalida canRepresentActor; ${found.length} call-sites passam subject normalizado e classificados (BOUND: rota canônica+bundle; FIREWALL_CONTAINED: service-hire/0110; SELF_BOOKING_ALLOWLIST: checkout-ticket[user_id]/event-rfq derivam server-side; TEST_ONLY: e2e).`);
