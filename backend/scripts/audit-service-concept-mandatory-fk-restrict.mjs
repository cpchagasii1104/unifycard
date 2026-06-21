#!/usr/bin/env node
// Guard estrutural — F-OFFER-2A (DECISION-0144): a migration que torna o `service` concept-mandatory
// e fortalece as FKs de declaração/publicação para ON DELETE RESTRICT deve existir e conter seus invariantes.
//
// MORDE se: a migration f_offer_2a sumir/duplicar; perder `services.canonical_service_id SET NOT NULL`;
// perder o RESTRICT em actor_professional_concepts/company_concept_publications.concept_id->concepts;
// perder o preflight fail-closed (RAISE EXCEPTION); ou usar DROP ... CASCADE (proibido).
// Estático (lê o arquivo de migration; não conecta no banco). Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIG_DIR = join(ROOT, 'migrations');
const failures = [];

const files = existsSync(MIG_DIR)
  ? readdirSync(MIG_DIR).filter((f) => /f_offer_2a/i.test(f) && f.endsWith('.sql'))
  : [];

if (files.length !== 1) {
  failures.push(`esperado exatamente 1 migration f_offer_2a (.sql), achou ${files.length}: [${files.join(', ')}]`);
} else {
  const sql = readFileSync(join(MIG_DIR, files[0]), 'utf-8');
  if (!/ALTER\s+TABLE\s+services\s+ALTER\s+COLUMN\s+canonical_service_id\s+SET\s+NOT\s+NULL/i.test(sql))
    failures.push('migration nao impoe services.canonical_service_id SET NOT NULL (service concept-less voltaria a ser permitido).');
  if (!/ADD\s+CONSTRAINT\s+actor_professional_concepts_concept_id_fkey\s+FOREIGN\s+KEY\s*\(concept_id\)\s+REFERENCES\s+concepts\(concept_id\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql))
    failures.push('migration nao recria FK actor_professional_concepts.concept_id -> concepts(concept_id) ON DELETE RESTRICT.');
  if (!/ADD\s+CONSTRAINT\s+company_concept_publications_concept_id_fkey\s+FOREIGN\s+KEY\s*\(concept_id\)\s+REFERENCES\s+concepts\(concept_id\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql))
    failures.push('migration nao recria FK company_concept_publications.concept_id -> concepts(concept_id) ON DELETE RESTRICT.');
  if (!/RAISE\s+EXCEPTION/i.test(sql))
    failures.push('migration sem preflight fail-closed (RAISE EXCEPTION) — DDL confiante demais.');
  if (/DROP\s+CONSTRAINT[^\n;]*CASCADE/i.test(sql))
    failures.push('migration usa DROP ... CASCADE (proibido pela DECISION-0144).');
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-concept-mandatory-fk-restrict]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-concept-mandatory-fk-restrict] — F-OFFER-2A: services.canonical_service_id SET NOT NULL + FK concept_id->concepts ON DELETE RESTRICT (apc/ccp) + preflight fail-closed; sem DROP CASCADE. Chao semantico do service blindado (DECISION-0144).');
