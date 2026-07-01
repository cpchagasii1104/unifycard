#!/usr/bin/env node
// Guard estrutural — F-SERVICE-AVAILABILITY-LEGACY-SERVICE-OWNER-READER-CONTAINMENT-SLICE-A2
// (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT).
//
// O reader de descoberta NÃO pode voltar a apresentar o summary legado `owner_type='service'` como agenda
// reservável verdadeira: em `discoverServices`, o `availability_summary` deve ser SUPRIMIDO para serviço
// canônico-bound (SSOT temporal reservável = a OFERTA `service_offering`). MORDE se: `discoverServices` sumir;
// a supressão condicionada a `canonicalServiceId` sumir do retorno; ou o enum `AvailabilityOwnerType.SERVICE`
// for removido (contenção ≠ deleção — compat/history preservados). Estático, comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

// ── serviço: discoverServices suprime o summary legado para serviço canônico-bound ──
const SVC = 'src/modules/services/services.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  const mStart = svc.indexOf('async discoverServices');
  if (mStart < 0) { failures.push(`${SVC}: método discoverServices ausente (reader de descoberta).`); }
  else {
    const mEnd = svc.indexOf('\n  async ', mStart + 10);
    const method = mEnd > mStart ? svc.slice(mStart, mEnd) : svc.slice(mStart);
    // A supressão: availability_summary condicionado a canonicalServiceId (canônico → não expõe summary legado).
    const suppresses = /availability_summary\s*:\s*[\s\S]{0,80}canonicalServiceId\s*[\s\S]{0,40}\?\s*undefined/.test(method)
      || /service\.canonicalServiceId\s*[\s\S]{0,20}\?\s*undefined\s*:\s*\{[\s\S]{0,120}has_availability/.test(method);
    if (!suppresses) failures.push(`${SVC}: discoverServices não suprime availability_summary para serviço canônico-bound (o reader legado owner_type='service' voltaria a mentir agenda reservável).`);
  }
}

// ── tipos: o enum owner_type='service' segue existindo (contenção ≠ remoção do enum; compat/history) ──
const TYPES = 'src/core/availability/unified-availability.types.ts';
const types = read(TYPES);
if (types === null) { failures.push(`arquivo ausente: ${TYPES}`); }
else if (!/SERVICE\s*=\s*['"]service['"]/.test(types)) {
  failures.push(`${TYPES}: enum AvailabilityOwnerType.SERVICE removido — contenção NÃO deve deletar o enum (compat/history/policy dependem dele).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [legacy-service-availability-reader-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [legacy-service-availability-reader-containment] — discoverServices suprime o availability_summary legado (owner_type=service) para serviço canônico-bound; SSOT reservável segue na oferta; enum preservado (contenção ≠ deleção). DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT blindada.');
