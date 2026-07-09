#!/usr/bin/env node
// Guard — RFC-SHARED-SUBJECT-CONCEPT-POOL (2026-07-08). Protege a separação de trilhos do pool de ASSUNTO.
// SSOT = concepts.concept_id; autoridade de elegibilidade tema/interesse = shared_subject_concepts;
// canonical_services só rótulo auxiliar; assunto NÃO é oferta. MORDE (mutation) se:
//  - tema/interesse voltarem a ler canonical_services flat como AUTORIDADE;
//  - serviço/capability/demanda lerem shared_subject_concepts;
//  - concept_offer_kinds receber 'subject';
//  - o reader do pool tratar assunto como oferta (join concept_offer_kinds);
//  - o picker de interesse depender só de categoria (perder a busca no pool);
//  - frontend criar lista local de assuntos (coberto tb pelo anti-hardcode).
// Em validate:regression-guards (runner).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FE = join(ROOT, '..', 'frontend', 'src');
const failures = [];
const read = (rel, base = ROOT) => { const p = join(base, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };

// (A) Reader do pool: autoridade = shared_subject_concepts; canonical_services NUNCA como FROM/autoridade;
// NUNCA join com concept_offer_kinds (assunto não é oferta).
const POOL = 'src/core/concepts/subject-pool.service.ts';
const pool = read(POOL);
if (!pool) failures.push(`${POOL}: ausente — reader do pool de assunto não encontrado.`);
else {
  if (!/FROM\s+shared_subject_concepts/.test(pool)) failures.push(`${POOL}: não lê shared_subject_concepts como autoridade (FROM).`);
  if (/FROM\s+canonical_services/.test(pool)) failures.push(`${POOL}: usa canonical_services como FROM/autoridade — deve ser só LEFT JOIN de rótulo.`);
  if (/(FROM|JOIN)\s+concept_offer_kinds/.test(pool)) failures.push(`${POOL}: faz JOIN/FROM concept_offer_kinds — assunto NÃO é oferta.`);
}

// (B) TEMA delega ao pool e NÃO lê canonical_services flat.
const TAX = 'src/core/events/event-taxonomy.service.ts';
const tax = read(TAX);
if (!tax) failures.push(`${TAX}: ausente.`);
else {
  if (!/searchSubjectConcepts/.test(tax)) failures.push(`${TAX}: searchThemes não delega ao pool (searchSubjectConcepts).`);
  if (/FROM\s+canonical_services/.test(tax)) failures.push(`${TAX}: voltou a ler canonical_services flat como autoridade de tema.`);
}

// (C) INTERESSE lê o pool (endpoint de busca). Mutation: remover → picker dependeria só de categoria.
const IROUTES = 'src/core/profile/interest-c1/interest-c1.routes.ts';
const ir = read(IROUTES);
if (!ir) failures.push(`${IROUTES}: ausente.`);
else if (!/searchSubjectConcepts/.test(ir)) failures.push(`${IROUTES}: picker de interesse não lê o pool (searchSubjectConcepts) — dependeria só de categoria.`);

// (D) Frontend: picker de interesse usa a busca no pool (não só árvore de categoria).
const FEFORM = 'components/ProfilePhysicalForm.tsx';
const feform = read(FEFORM, FE);
const felogic = read('components/ProfilePhysical.tsx', FE);
if (!feform || !felogic) failures.push('frontend: ProfilePhysical(Form) ausente.');
else if (!/addSubjectInterest/.test(feform) || !/searchInterestConceptsC1/.test(felogic)) {
  failures.push('frontend: picker de interesse perdeu a busca no pool (addSubjectInterest/searchInterestConceptsC1) — dependeria só de categoria/local.');
}

// (E) Serviço/capability/demanda NÃO podem ler shared_subject_concepts.
for (const rel of [
  'src/core/catalog/canonical/canonical-service.service.ts',
  'src/core/profile/professional-c1/professional-c1.service.ts',
  'src/modules/demands/demand.routes.ts',
]) {
  const code = read(rel);
  if (code && /shared_subject_concepts/.test(code)) failures.push(`${rel}: trilho de serviço/capability/demanda lê shared_subject_concepts — proibido (separação de trilhos).`);
}

// (F) concept_offer_kinds NÃO pode receber 'subject' (nem const, nem migration).
const vocab = read('src/core/catalog/vehicle-catalog.service.ts');
if (vocab && /CONCEPT_OFFER_KINDS\s*=\s*\[[^\]]*'subject'/.test(vocab)) failures.push("vehicle-catalog.service.ts: CONCEPT_OFFER_KINDS ganhou 'subject' — assunto não é offer_kind.");

if (failures.length > 0) {
  console.error('GATE FAIL [shared-subject-pool]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [shared-subject-pool] — pool de assunto autoridade; tema/interesse lêem o pool; serviço não lê o pool; concept_offer_kinds sem subject; canonical_services só rótulo. SSOT = concepts.concept_id.');
process.exit(0);
