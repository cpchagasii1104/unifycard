#!/usr/bin/env node
// Guard estrutural — EVENT-ENGINE-COMPLETION · C1c-a: o facet de EQUIPAMENTO da oferta só liga
// service_offering ↔ concept de equipamento GOVERNADO (pool produtos-e-comercio + offer_kind='rentable').
// Espelha o guard selado de C1b (genre facet). Equipamento = concept do catálogo governado (seed C1a-style);
// "equipamento solto" (free-text) impedido pela FK→concepts; a pertinência ao pool é validada no writer.
//
// MORDE (regressão) se:
//   (A) a migration do facet sumir;
//   (B) o facet não referenciar service_offerings (FK da oferta — elo sem dono);
//   (C) o facet não referenciar concepts (FK — equipamento solto/free-text liberado);
//   (D) o facet perder a PK/UNIQUE (offering, concept) — idempotência quebrada;
//   (E) o writer tagOfferingEquipment perder canRepresentActor (autoridade), a checagem do pool
//       (produtos-e-comercio + offer_kind 'rentable'), ou o código 422 SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED;
//   (F) a validação de capacidade de público (assertAudienceCapacity / SERVICE_OFFERING_CAPACITY_INVALID) sumir.
// Estático (varre a migration + o writer, comment-stripped). NÃO altera runtime. Em regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const TABLE = 'service_offering_equipment_facets';
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

// (A) migration do facet.
const migDir = join(ROOT, 'migrations');
let migSrc = null;
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql'))) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (new RegExp(`CREATE TABLE[\\s\\S]{0,40}${TABLE}\\b`, 'i').test(src)) { migSrc = src; break; }
}
if (migSrc === null) {
  failures.push(`(A) migration de ${TABLE} ausente — facet de equipamento sumiu.`);
} else {
  const m = migSrc.match(new RegExp(`CREATE TABLE[\\s\\S]{0,40}${TABLE}[\\s\\S]*?\\);`, 'i'));
  const ddl = m ? m[0] : migSrc;
  if (!/service_offering_id[\s\S]{0,80}REFERENCES\s+service_offerings\b/i.test(ddl))
    failures.push('(B) facet sem FK service_offering_id → service_offerings (elo sem dono).');
  if (!/equipment_concept_id[\s\S]{0,80}REFERENCES\s+concepts\b/i.test(ddl))
    failures.push('(C) facet sem FK equipment_concept_id → concepts (equipamento solto/free-text liberado).');
  if (!/PRIMARY KEY\s*\(\s*service_offering_id\s*,\s*equipment_concept_id\s*\)/i.test(ddl) &&
      !/UNIQUE\s*\(\s*service_offering_id\s*,\s*equipment_concept_id\s*\)/i.test(ddl))
    failures.push('(D) facet sem PK/UNIQUE (service_offering_id, equipment_concept_id) — idempotência quebrada.');
}

// (E)/(F) writer contido: autoridade + governança do pool + capacidade.
const WRITER = 'src/modules/services/service-offering.service.ts';
const wp = join(ROOT, WRITER);
if (!existsSync(wp)) {
  failures.push(`writer ausente: ${WRITER}`);
} else {
  const w = stripTs(readFileSync(wp, 'utf-8'));
  const mm = w.match(/async tagOfferingEquipment\s*\([\s\S]*?\n {2}\},/);
  const body = mm ? mm[0] : '';
  if (!body) failures.push('(E) método tagOfferingEquipment ausente no writer.');
  else {
    if (!/canRepresentActor\s*\(/.test(body))
      failures.push('(E) tagOfferingEquipment sem canRepresentActor — autoridade do provider não fail-closed.');
    // Anchor no PREDICADO SQL (não em palavra solta / mensagem de erro): a query precisa filtrar o pool.
    if (!/domain\s*=\s*'produtos-e-comercio'/.test(body) || !/offer_kind\s*=\s*'rentable'/.test(body))
      failures.push("(E) tagOfferingEquipment não valida o pool no SQL (domain='produtos-e-comercio' + offer_kind='rentable').");
    if (!/SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED/.test(body))
      failures.push('(E) falta rejeição controlada SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED.');
  }
  if (!/function assertAudienceCapacity/.test(w) || !/SERVICE_OFFERING_CAPACITY_INVALID/.test(w))
    failures.push('(F) validação de capacidade de público (assertAudienceCapacity / SERVICE_OFFERING_CAPACITY_INVALID) ausente.');
  if (!/assertAudienceCapacity\s*\(\s*input\.conditions\s*\)/.test(w))
    failures.push('(F) createOffering não chama assertAudienceCapacity(input.conditions) — capacidade não validada na serialização de conditions.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [offering-equipment-facet-governed]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [offering-equipment-facet-governed] — ${TABLE} liga oferta↔equipamento governado (FK service_offerings + concepts, PK/UNIQUE idempotente); writer tagOfferingEquipment fail-closed (canRepresentActor + pool produtos-e-comercio/rentable + 422); capacidade de público validada em conditions (assertAudienceCapacity). Sem equipamento solto nem vocabulário paralelo (C1c-a).`);
