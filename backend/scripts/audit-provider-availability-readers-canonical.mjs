#!/usr/bin/env node
// Guard estrutural — F-SERVICE-AVAILABILITY-PROVIDER-READERS-CONTAINMENT-SLICE-A2E
// (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduos R4/R5).
//
// pending-responsibilities e impact-overview NÃO podem resolver ownership/contagem do prestador pelo escopo
// legado owner_type='service'→services.owner_actor_id (coluna morta). Devem usar o SSOT canônico
// (owner_type='service_offering' + service_offerings.provider_actor_id). MORDE se: reaparecer
// owner_type = 'service' (SQL), owner_actor_id / s.title (coluna morta), sumir o predicado canônico
// (service_offerings + provider_actor_id), os branches user/group forem removidos, services.metadata.availability
// virar autoridade, ou o enum SERVICE for removido. Comment-stripped (// , /* */ e -- SQL). Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
// strip //-comment, /* */-comment e --sql-comment (dentro de template literals dos readers)
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\n]*/g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const FILES = [
  'src/core/profile/pending-responsibilities.routes.ts',
  'src/core/profile/impact-overview.routes.ts',
];
for (const rel of FILES) {
  const src = read(rel);
  if (src === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
  // (1) sem escopo legado owner_type='service' (word-boundary p/ não bater em service_offering)
  if (/owner_type\s*=\s*'service'(?!_)/.test(src)) failures.push(`${rel}: reapareceu owner_type='service' (escopo legado) no SQL.`);
  // (2) sem coluna morta
  if (/owner_actor_id/.test(src)) failures.push(`${rel}: reapareceu owner_actor_id (coluna inexistente em services).`);
  if (/s\.title\b/.test(src)) failures.push(`${rel}: reapareceu s.title (coluna inexistente em services).`);
  // (3) predicado canônico presente
  if (!/service_offerings/.test(src)) failures.push(`${rel}: não consulta service_offerings (SSOT canônico ausente).`);
  if (!/provider_actor_id/.test(src)) failures.push(`${rel}: não resolve ownership por provider_actor_id (SSOT canônico).`);
  if (!/owner_type\s*=\s*'service_offering'/.test(src)) failures.push(`${rel}: não usa owner_type='service_offering' (SSOT canônico).`);
  // (4) branches legítimos preservados
  if (!/owner_type\s*=\s*'user'/.test(src)) failures.push(`${rel}: branch owner_type='user' removido indevidamente.`);
  if (!/owner_type\s*=\s*'group'/.test(src)) failures.push(`${rel}: branch owner_type='group' removido indevidamente.`);
  // (5) metadata.availability não é autoridade
  if (/metadata\.availability/.test(src)) failures.push(`${rel}: services.metadata.availability não pode virar autoridade.`);
  // (6) RFQ intocado por estes readers
  if (/event-rfq|acceptQuote/.test(src)) failures.push(`${rel}: readers de perfil não podem referenciar RFQ (fora de escopo).`);
}

// enum owner_type='service' preservado (contenção ≠ deleção)
const TYPES = 'src/core/availability/unified-availability.types.ts';
const types = read(TYPES);
if (types === null) { failures.push(`arquivo ausente: ${TYPES}`); }
else if (!/SERVICE\s*=\s*['"]service['"]/.test(types)) {
  failures.push(`${TYPES}: enum AvailabilityOwnerType.SERVICE removido — contenção NÃO deve deletar o enum.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [provider-availability-readers-canonical]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [provider-availability-readers-canonical] — pending-responsibilities + impact-overview resolvem ownership do prestador por service_offering→provider_actor_id (SSOT), sem owner_type=service/owner_actor_id/title; branches user/group preservados; enum preservado. DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT (R4/R5) blindada.');
