#!/usr/bin/env node
// Guard — F-COMPANY-READINESS-PROJECTION (anti-drift readiness × P3 gate).
//
// A elegibilidade de ATIVAÇÃO de oferta tem UMA fonte: o predicado `evaluateOfferingActivationEligibility`
// (em services-offering-activation-gate.ts). O P3 gate (assert…) e a readiness projection
// (company-readiness.service.ts) DEVEM ambos consumir esse predicado — NUNCA re-implementar a regra. Senão
// "UI diz pronto" e "gate deixa ativar" divergem. MORDE se: (1) o predicado sumir; (2) o assert não delegar;
// (3) a readiness re-implementar a regra (SQL de eligibility) em vez de chamar o predicado.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const failures = [];

const GATE = 'src/modules/services/services-offering-activation-gate.ts';
const SVC = 'src/core/companies/company-readiness.service.ts';
// tokens da REGRA de eligibility — só podem viver no predicado (gate), não na readiness.
const RULE_TOKENS = ['company_concept_publications', 'actor_professional_concepts', 'primary_company_type_id', 'evaluatePageActorKybApproved'];

const gate = read(GATE);
if (gate === null) {
  failures.push(`${GATE}: ausente (predicado único da elegibilidade).`);
} else {
  if (!/export async function evaluateOfferingActivationEligibility/.test(gate)) {
    failures.push(`${GATE}: predicado único 'evaluateOfferingActivationEligibility' ausente.`);
  }
  const i = gate.indexOf('export async function assertOfferingActivationEligibility');
  const assertBlock = i >= 0 ? gate.slice(i) : '';
  if (!/evaluateOfferingActivationEligibility\(/.test(assertBlock)) {
    failures.push(`${GATE}: assertOfferingActivationEligibility NÃO delega ao predicado (regra duplicada no gate).`);
  }
}

const svc = read(SVC);
if (svc === null) {
  failures.push(`${SVC}: ausente.`);
} else {
  if (!/evaluateOfferingActivationEligibility/.test(svc)) {
    failures.push(`${SVC}: readiness NÃO consome o predicado único 'evaluateOfferingActivationEligibility' (deve chamar a mesma fonte do P3).`);
  }
  for (const t of RULE_TOKENS) {
    if (svc.includes(t)) {
      failures.push(`${SVC}: re-implementa a regra de eligibility ('${t}') — readiness deve SÓ consumir o predicado (sem drift readiness×gate).`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [company-readiness-shared-predicate]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [company-readiness-shared-predicate] — readiness e P3 gate consomem o MESMO predicado evaluateOfferingActivationEligibility; nenhuma regra duplicada. UI e gate não divergem. F-COMPANY-READINESS-PROJECTION.');
