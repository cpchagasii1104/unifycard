#!/usr/bin/env node
// Guard estrutural — EVENT-ENGINE-COMPLETION · C1b: o facet de gênero da oferta só liga
// service_offering ↔ subject-concept GOVERNADO. Habilita "achar banda POR GÊNERO" reusando o padrão
// selado event_theme_links; gênero = subject-concept do pool neutro (shared_subject_concepts).
//
// MORDE (regressão) se:
//   (A) a migration do facet sumir;
//   (B) o facet não referenciar service_offerings (FK da oferta — elo sem dono);
//   (C) o facet não referenciar shared_subject_concepts (FK de governança — "gênero solto" liberado);
//   (D) o facet perder a UNIQUE/PK (offering, concept) — duplicação/idempotência quebrada;
//   (E) o writer tagOfferingGenres perder o canRepresentActor (autoridade) OU a checagem de
//       shared_subject_concepts (governança do gênero).
// Estático (varre a migration + o writer, comment-stripped). NÃO altera runtime. Em regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const TABLE = 'service_offering_genre_facets';
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

// (A) migration semeadora do facet.
const migDir = join(ROOT, 'migrations');
let migSrc = null;
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql'))) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (new RegExp(`CREATE TABLE[\\s\\S]{0,40}${TABLE}\\b`, 'i').test(src)) { migSrc = src; break; }
}
if (migSrc === null) {
  failures.push(`(A) migration de ${TABLE} ausente — facet de gênero sumiu.`);
} else {
  // Região da definição da tabela.
  const m = migSrc.match(new RegExp(`CREATE TABLE[\\s\\S]{0,40}${TABLE}[\\s\\S]*?\\);`, 'i'));
  const ddl = m ? m[0] : migSrc;
  if (!/service_offering_id[\s\S]{0,80}REFERENCES\s+service_offerings\b/i.test(ddl))
    failures.push('(B) facet sem FK service_offering_id → service_offerings (elo sem dono).');
  if (!/subject_concept_id[\s\S]{0,80}REFERENCES\s+shared_subject_concepts\b/i.test(ddl))
    failures.push('(C) facet sem FK subject_concept_id → shared_subject_concepts (gênero solto liberado).');
  if (!/PRIMARY KEY\s*\(\s*service_offering_id\s*,\s*subject_concept_id\s*\)/i.test(ddl) &&
      !/UNIQUE\s*\(\s*service_offering_id\s*,\s*subject_concept_id\s*\)/i.test(ddl))
    failures.push('(D) facet sem PK/UNIQUE (service_offering_id, subject_concept_id) — idempotência quebrada.');
}

// (E) writer contido: autoridade + governança do gênero.
const WRITER = 'src/modules/services/service-offering.service.ts';
const wp = join(ROOT, WRITER);
if (!existsSync(wp)) {
  failures.push(`writer ausente: ${WRITER}`);
} else {
  const w = stripTs(readFileSync(wp, 'utf-8'));
  const mm = w.match(/async tagOfferingGenres\s*\([\s\S]*?\n {2}\},/);
  const body = mm ? mm[0] : '';
  if (!body) failures.push('(E) método tagOfferingGenres ausente no writer.');
  else {
    if (!/canRepresentActor\s*\(/.test(body))
      failures.push('(E) tagOfferingGenres sem canRepresentActor — autoridade do provider não fail-closed.');
    if (!/shared_subject_concepts/.test(body))
      failures.push('(E) tagOfferingGenres não valida shared_subject_concepts — gênero não-governado passaria.');
    if (!/SERVICE_OFFERING_GENRE_NOT_GOVERNED/.test(body))
      failures.push('(E) falta rejeição controlada SERVICE_OFFERING_GENRE_NOT_GOVERNED.');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [offering-genre-facet-governed]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [offering-genre-facet-governed] — ${TABLE} liga oferta↔subject-concept governado (FK service_offerings + shared_subject_concepts, PK/UNIQUE idempotente); writer tagOfferingGenres fail-closed (canRepresentActor + governança shared_subject_concepts). Sem gênero solto (C1b).`);
