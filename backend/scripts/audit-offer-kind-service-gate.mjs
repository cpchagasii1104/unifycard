#!/usr/bin/env node
// Guard estrutural — F-OFFER-KIND-SERVICE-GATE (2026-07-08). CONTENÇÃO de papel semântico: os pickers
// operacionais de SERVIÇO (criação de serviço/capability profissional/demanda de trabalho) NÃO podem
// enumerar canonical_services sem o gate governado concept_offer_kinds.offer_kind='service'. Sem isto,
// assunto/tema/formato de evento (futebol/festa/campeonato) vaza como serviço ofertável.
// MORDE (mutation test): remover o gate `offer_kind = 'service'` de qualquer picker → FAIL. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];

// (1) O vocabulário governado precisa conter 'service' (senão o gate não compõe).
const VOCAB = 'src/core/catalog/vehicle-catalog.service.ts';
const vp = join(ROOT, VOCAB);
if (!existsSync(vp)) {
  failures.push(`${VOCAB}: ausente — CONCEPT_OFFER_KINDS não encontrado.`);
} else {
  const v = readFileSync(vp, 'utf-8');
  if (!/CONCEPT_OFFER_KINDS\s*=\s*\[[^\]]*'service'/.test(v)) {
    failures.push(`${VOCAB}: CONCEPT_OFFER_KINDS não inclui 'service' — vocabulário governado incompleto.`);
  }
}

// (2) Cada PICKER operacional de serviço deve conter o gate offer_kind='service' junto ao read de
// canonical_services. Regex tolera aspas/espacos. Mutation: apagar a linha do gate faz o guard morder.
const GATE = /offer_kind\s*=\s*'service'/;
const PICKERS = [
  { rel: 'src/core/catalog/canonical/canonical-service.service.ts', why: 'catálogo/autocomplete de criação de serviço' },
  { rel: 'src/modules/demands/demand.routes.ts', why: 'picker de concept da demanda de trabalho (listWorkConcepts)' },
  { rel: 'src/core/profile/professional-c1/professional-c1.service.ts', why: 'picker de capability profissional (searchDeclarableConcepts)' },
];
for (const { rel, why } of PICKERS) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`${rel}: ausente — picker de serviço não encontrado.`); continue; }
  const code = readFileSync(p, 'utf-8');
  if (!/canonical_services|concept_offer_kinds/.test(code)) continue; // não é mais leitor de catálogo
  if (!GATE.test(code)) {
    failures.push(`${rel}: LÊ o catálogo mas SEM gate offer_kind='service' (${why}) — assunto/tema/formato vaza como serviço.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [offer-kind-service-gate]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [offer-kind-service-gate] — pickers de serviço/capability/demanda gated por offer_kind=service; vocabulário governado com service.');
process.exit(0);
