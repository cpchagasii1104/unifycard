#!/usr/bin/env node
// Guard estrutural — F-OFFER-4 V1 (DECISION-0142): discovery de serviços casa por concept_id.
//
// As 2 superfícies READ de discovery de serviços (services-discovery.service.search + services.service.discoverServices)
// resolvem a entrada de navegação (category) para concept_id (hop de LEITURA efêmero, V1 exige folha) e casam
// MATERIALMENTE por canonical_services.concept_id — NUNCA por category_id/domain como identidade. MORDE se:
// uma superfície voltar a passar categoryId como matching (categoryId: filters.categoryId) ao discoverServices;
// sumir o hop resolveConceptFromCategory; sumir o gate CATEGORY_REQUIRES_LEAF_CONCEPT; ou o repo perder o
// JOIN canonical_services.concept_id. Escopo: SÓ as 2 superfícies de serviço (marketplace-search/assertServicosCategory
// FORA do V1 — verificados por commit-scope, não aqui). Estático, comment-stripped. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

// ── superfície 1: services-discovery.service.search ──
const SVC = 'src/modules/services/services-discovery.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  if (!/resolveConceptFromCategory/.test(svc)) failures.push(`${SVC}: search não resolve category→concept (resolveConceptFromCategory ausente).`);
  if (!/CATEGORY_REQUIRES_LEAF_CONCEPT/.test(svc)) failures.push(`${SVC}: falta o gate de folha CATEGORY_REQUIRES_LEAF_CONCEPT.`);
  if (!/discoverServices\([\s\S]{0,160}\bconceptId\b/.test(svc)) failures.push(`${SVC}: search não passa conceptId ao discoverServices (matching material por concept).`);
  if (/categoryId:\s*filters\.categoryId/.test(svc)) failures.push(`${SVC}: voltou a passar categoryId: filters.categoryId ao discoverServices — matching por category é proibido (DECISION-0142).`);
}

// ── superfície 2: services.service.discoverServices (wrapper de /services/discover) ──
const WRAP = 'src/modules/services/services.service.ts';
const wrap = read(WRAP);
if (wrap === null) { failures.push(`arquivo ausente: ${WRAP}`); }
else {
  if (!/resolveConceptFromCategory/.test(wrap)) failures.push(`${WRAP}: discoverServices wrapper não resolve category→concept.`);
  if (!/CATEGORY_REQUIRES_LEAF_CONCEPT/.test(wrap)) failures.push(`${WRAP}: falta o gate de folha CATEGORY_REQUIRES_LEAF_CONCEPT.`);
  if (/categoryId:\s*filters\.categoryId/.test(wrap)) failures.push(`${WRAP}: voltou a passar categoryId: filters.categoryId ao discoverServices — matching por category é proibido.`);
}

// ── repo: discoverServices suporta concept_id via JOIN canonical_services ──
const REPO = 'src/modules/services/services.repository.ts';
const repo = read(REPO);
if (repo === null) { failures.push(`arquivo ausente: ${REPO}`); }
else {
  if (!/INNER JOIN canonical_services cs ON cs\.id = s\.canonical_service_id/.test(repo)) failures.push(`${REPO}: discoverServices perdeu o JOIN canonical_services (matching por concept_id).`);
  if (!/cs\.concept_id/.test(repo)) failures.push(`${REPO}: discoverServices não filtra por cs.concept_id.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [discovery-concept-rekey]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [discovery-concept-rekey] — F-OFFER-4 V1: discovery de serviços (search + discoverServices wrapper) resolve category→concept (folha) e casa por canonical_services.concept_id; sem category/domain como identidade. Re-key concept-bound blindado (DECISION-0142).');
