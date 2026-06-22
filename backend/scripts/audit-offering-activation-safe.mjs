#!/usr/bin/env node
// Guard estrutural — P3 / DECISION-0147 (ativação segura de service_offering).
//
// active = público/contratável com elegibilidade VIVA revalidada na ativação; status = state-machine fail-closed;
// booking só em oferta active. MORDE se: updateOwnOffering perder a state-machine / o gate de ativação; o gate
// deixar de checar publicação+KYB+operacional (PJ) ou declaração+civil(CPF/full_name/identities)+ATL (PF); o gate
// passar a ler profile.metadata; ou o booking aceitar offering não-active. Estático, comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const fails = [];
const need = (src, file, re, why) => { if (!re.test(src)) fails.push(`${file}: ${why}`); };

// ── gate de ativação ──
const GATE = 'src/modules/services/services-offering-activation-gate.ts';
const gate = read(GATE);
if (gate === null) fails.push(`arquivo ausente: ${GATE}`);
else {
  need(gate, GATE, /company_concept_publications[\s\S]*status = 'active'/, 'PJ: sem checagem de publicação ACTIVE (Q3).');
  need(gate, GATE, /evaluatePageActorKybApproved/, 'PJ: sem KYB approved (Q2).');
  need(gate, GATE, /primary_company_type_id/, 'PJ: sem checagem operacional (primary_company_type, 0100 D6).');
  need(gate, GATE, /actor_professional_concepts[\s\S]*is_active = true/, 'PF: sem declaração ACTIVE (Q2/Q3).');
  need(gate, GATE, /global_users[\s\S]*cpf IS NOT NULL[\s\S]*full_name IS NOT NULL/, 'PF: KYC-lite civil V1 sem CPF/full_name de SSOT.');
  need(gate, GATE, /identities/, 'PF: KYC-lite civil V1 sem vínculo identities.');
  need(gate, GATE, /isActorEffectivelyBlocked/, 'PF: sem checagem ATL (atl_blocked_actors).');
  if (/profile\.metadata|localStorage/.test(gate)) fails.push(`${GATE}: gate NÃO pode ler profile.metadata/localStorage como elegibilidade (DECISION-0147 §D).`);
}

// ── state-machine + gate em updateOwnOffering ──
const SVC = 'src/modules/services/service-offering.service.ts';
const svc = read(SVC);
if (svc === null) fails.push(`arquivo ausente: ${SVC}`);
else {
  need(svc, SVC, /SERVICE_OFFERING_INVALID_TRANSITION/, 'updateOwnOffering sem state-machine fail-closed (Q4).');
  need(svc, SVC, /assertOfferingActivationEligibility/, 'updateOwnOffering não chama o gate de ativação na transição p/ active (Q1/Q2/Q3).');
  need(svc, SVC, /to === 'active' && \(from === 'draft' \|\| from === 'suspended'\)/, 'state-machine não restringe draft/suspended→active.');
}

// ── cascata Q5 (base revogada → suspende offerings active) ──
const PUB = 'src/core/companies/company-publications.service.ts';
const pub = read(PUB);
if (pub === null) fails.push(`arquivo ausente: ${PUB}`);
else {
  need(pub, PUB, /UPDATE service_offerings[\s\S]{0,200}status = 'suspended'[\s\S]{0,200}company_id/, 'cascata PJ: KYB/publicação revogada não suspende service_offerings active (Q5).');
  if (/DELETE FROM service_offerings/.test(pub)) fails.push(`${PUB}: cascata NÃO pode apagar offering (só suspender).`);
}
const PF = 'src/core/profile/professional-c1/professional-c1.service.ts';
const pf = read(PF);
if (pf === null) fails.push(`arquivo ausente: ${PF}`);
else {
  need(pf, PF, /UPDATE service_offerings[\s\S]{0,200}status = 'suspended'[\s\S]{0,200}provider_actor_id/, 'cascata PF: declaração retirada não suspende service_offerings active (Q5).');
}

// ── booking-gate (só offering active) ──
const AV = 'src/core/availability/unified-availability.service.ts';
const av = read(AV);
if (av === null) fails.push(`arquivo ausente: ${AV}`);
else {
  need(av, AV, /OFFERING_NOT_ACTIVE/, 'booking não recusa offering não-active (P3-2).');
  need(av, AV, /SERVICE_OFFERING[\s\S]{0,400}service_offerings[\s\S]{0,200}status !== 'active'/, 'booking não valida service_offerings.status=active.');
}

if (fails.length > 0) {
  console.error('GATE FAIL [offering-activation-safe]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [offering-activation-safe] — DECISION-0147: updateOwnOffering com state-machine fail-closed + gate de ativação (PJ: publicação+KYB+operacional; PF: declaração+civil(CPF/full_name/identities)+ATL); booking só em offering active. Elegibilidade viva revalidada na ativação; sem metadata como autoridade.");
