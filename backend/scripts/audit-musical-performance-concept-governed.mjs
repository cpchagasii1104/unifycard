#!/usr/bin/env node
// Guard estrutural — EVENT-ENGINE-COMPLETION · C1a: o concept-oferta `apresentacao-musical` é GOVERNADO e
// ÚNICO. Habilita performer (banda/artista) a publicar oferta contratável REUSANDO o trilho selado
// service_offering. O concept nasce em domain='servicos' com offer_kind='service' (mesmo padrão selado dos
// service-concepts de evento, 20260708350000 + gate 20260708330000).
//
// MORDE (regressão) se, varrendo migrations/*.sql:
//   (A) NENHUMA migration semeia o concept 'apresentacao-musical' (o trilho sumiu);
//   (B) MAIS DE UMA migration insere o slug em `concepts` (duplicação — quebra UNIQUE(domain,slug) e o
//       dedup governado);
//   (C) a migration semeadora não o coloca em domain='servicos';
//   (D) a migration semeadora não lhe dá offer_kind='service' (sem isso o createService/gate não o enxerga);
//   (E) alguma migration DELETA/DROPA o concept ou seu offer_kind (remoção do trilho).
// Estático (varre SQL, comment-stripped). NÃO altera runtime. Em regression-guards.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'migrations');
const SLUG = 'apresentacao-musical';
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));

// Migrations que INSEREM o slug em `concepts`.
const seeders = [];
let hasServico = false;
let hasOfferKindService = false;
for (const f of files) {
  const src = stripSql(readFileSync(join(DIR, f), 'utf-8'));
  const insertsConcept = /INSERT\s+INTO\s+concepts\b/i.test(src) && src.includes(`'${SLUG}'`);
  if (insertsConcept) {
    seeders.push(f);
    if (/'servicos'/.test(src)) hasServico = true;
    // offer_kind='service' para o slug: a migration semeadora referencia o slug e insere offer_kind service.
    if (/INSERT\s+INTO\s+concept_offer_kinds\b/i.test(src) && /'service'/.test(src)) hasOfferKindService = true;
  }
  // (E) remoção do trilho.
  if (/DELETE\s+FROM\s+concepts\b/i.test(src) && src.includes(`'${SLUG}'`))
    failures.push(`${f}: DELETE FROM concepts referencia '${SLUG}' — remoção do trilho C1a.`);
  if (/DROP\s+/i.test(src) && new RegExp(`concepts[\\s\\S]{0,120}${SLUG}`).test(src))
    failures.push(`${f}: DROP referenciando concept '${SLUG}'.`);
}

if (seeders.length === 0) failures.push(`(A) nenhuma migration semeia o concept '${SLUG}' — trilho C1a ausente.`);
if (seeders.length > 1) failures.push(`(B) '${SLUG}' inserido em ${seeders.length} migrations (${seeders.join(', ')}) — duplicação proibida.`);
if (seeders.length >= 1 && !hasServico) failures.push(`(C) concept '${SLUG}' não nasce em domain='servicos'.`);
if (seeders.length >= 1 && !hasOfferKindService) failures.push(`(D) concept '${SLUG}' sem offer_kind='service' na migration semeadora.`);

if (failures.length > 0) {
  console.error('GATE FAIL [musical-performance-concept-governed]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [musical-performance-concept-governed] — concept '${SLUG}' governado e único: 1 migration semeadora (${seeders[0]}), domain='servicos', offer_kind='service', sem remoção/duplicação. Performer reusa o trilho selado service_offering (C1a).`);
