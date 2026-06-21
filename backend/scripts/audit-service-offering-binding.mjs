#!/usr/bin/env node
// Guard estrutural — F-OFFER-3 (DECISION-0145): vínculo service→service_offering.
//
// A oferta nasce amarrada a um `service` válido (mesmo provider+concept), herdando a elegibilidade da 0144;
// company_id derivado server-side; status nasce draft; service_id mandatório no schema. MORDE se: o writer
// parar de resolver/exigir o service; voltar a usar company_id/professional_actor_id do body; voltar a nascer
// 'active'; ou a migration perder NOT NULL/RESTRICT do service_id.
// Estático (lê o writer + a migration). Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

// ── WRITER: service-offering.service.ts ──
const W = 'src/modules/services/service-offering.service.ts';
const wp = join(ROOT, W);
if (!existsSync(wp)) {
  failures.push(`arquivo ausente: ${W}`);
} else {
  const src = stripTs(readFileSync(wp, 'utf-8'));
  if (!/FROM\s+services\s+WHERE[\s\S]{0,200}actor_id[\s\S]{0,200}canonical_service_id/i.test(src))
    failures.push('createOffering não resolve o service por (actor_id + canonical_service_id).');
  if (!/SERVICE_OFFERING_REQUIRES_SERVICE/.test(src))
    failures.push('createOffering não exige service (code SERVICE_OFFERING_REQUIRES_SERVICE ausente).');
  if (!/INSERT\s+INTO\s+service_offerings[\s\S]{0,300}\bservice_id\b/i.test(src))
    failures.push('INSERT em service_offerings não popula service_id.');
  if (!/SELECT\s+company_id\s+FROM\s+actors/i.test(src))
    failures.push('company_id não é derivado server-side do provider (SELECT company_id FROM actors ausente).');
  if (/input\.companyId/.test(src))
    failures.push('createOffering usa input.companyId — body NÃO pode definir company (G4).');
  if (/input\.professionalActorId/.test(src))
    failures.push('createOffering usa input.professionalActorId — body NÃO pode carimbar professional (G4).');
  // status nasce draft no INSERT da oferta; o hardcode 'active' não pode voltar no INSERT.
  const insMatch = src.match(/INSERT\s+INTO\s+service_offerings[\s\S]*?RETURNING/i);
  const insBlock = insMatch ? insMatch[0] : '';
  if (!/'draft'/.test(insBlock))
    failures.push("INSERT em service_offerings não nasce status 'draft' (D-F3-3).");
  if (/'active'/.test(insBlock))
    failures.push("INSERT em service_offerings ainda crava 'active' (D-F3-3: nasce draft, ativação é fatia própria).");
}

// ── SCHEMA: migration f_offer_3 ──
const MIG_DIR = join(ROOT, 'migrations');
const migs = existsSync(MIG_DIR)
  ? readdirSync(MIG_DIR).filter((f) => /f_offer_3_/i.test(f) && f.endsWith('.sql'))
  : [];
if (migs.length !== 1) {
  failures.push(`esperado exatamente 1 migration f_offer_3 (.sql), achou ${migs.length}: [${migs.join(', ')}]`);
} else {
  const sql = readFileSync(join(MIG_DIR, migs[0]), 'utf-8');
  if (!/ALTER\s+TABLE\s+service_offerings\s+ALTER\s+COLUMN\s+service_id\s+SET\s+NOT\s+NULL/i.test(sql))
    failures.push('migration não impõe service_offerings.service_id SET NOT NULL.');
  if (!/ADD\s+CONSTRAINT\s+service_offerings_service_id_fkey\s+FOREIGN\s+KEY\s*\(service_id\)\s+REFERENCES\s+services\(service_id\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql))
    failures.push('migration não recria FK service_offerings.service_id -> services(service_id) ON DELETE RESTRICT.');
  if (!/RAISE\s+EXCEPTION/i.test(sql))
    failures.push('migration sem preflight fail-closed (RAISE EXCEPTION).');
  if (/DROP\s+CONSTRAINT[^\n;]*CASCADE/i.test(sql))
    failures.push('migration usa DROP ... CASCADE (proibido).');
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-offering-binding]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-offering-binding] — F-OFFER-3: createOffering exige/resolve service (mesmo provider+canonical), popula service_id, deriva company_id server-side (body não autoriza), nasce draft; schema service_id NOT NULL + FK RESTRICT. Vínculo service→offering blindado (DECISION-0145).');
