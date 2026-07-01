#!/usr/bin/env node
// Guard estrutural — F-SERVICE-DISCOVERY-HAS-AVAILABILITY-CANONICAL-FILTER-SLICE-A2D
// (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduo R1).
//
// O filtro `has_availability=true` da descoberta deve medir disponibilidade pelo SSOT CANÔNICO
// (service_offering ativa + availability owner_type='service_offering' com janela futura end>now), NUNCA pelo
// escopo legado owner_type='service'. MORDE se: o gate do filtro (services.service.ts) voltar a depender do
// `hasAvailability` legado para serviço canônico (em vez do predicado canônico); o predicado canônico do
// repositório sumir/deixar de exigir owner_type='service_offering'+end>now; o filtro usar metadata.availability;
// ou o enum SERVICE for removido. Estático, comment-stripped. Em regression-guards (via agregador).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

// ── repository: predicado canônico existe e exige service_offering + janela futura ──
const REPO = 'src/modules/services/services.repository.ts';
const repo = read(REPO);
if (repo === null) { failures.push(`arquivo ausente: ${REPO}`); }
else {
  const mStart = repo.indexOf('hasCanonicalOfferingFutureAvailability');
  if (mStart < 0) { failures.push(`${REPO}: método hasCanonicalOfferingFutureAvailability ausente (predicado canônico do filtro).`); }
  else {
    const method = repo.slice(mStart, mStart + 1400);
    if (!/from\s+service_offerings/i.test(method)) failures.push(`${REPO}: predicado não consulta service_offerings (SSOT canônico da oferta).`);
    if (!/owner_type\s*=\s*'service_offering'/.test(method)) failures.push(`${REPO}: predicado não exige availability owner_type='service_offering'.`);
    if (!/end_datetime\s*>\s*now\(\)/.test(method)) failures.push(`${REPO}: predicado não exige janela FUTURA (end_datetime > now()).`);
    if (/owner_type\s*=\s*'service'/.test(method)) failures.push(`${REPO}: predicado canônico NÃO pode consultar owner_type='service' (escopo legado).`);
    if (/metadata\.availability/.test(method)) failures.push(`${REPO}: predicado canônico não pode usar services.metadata.availability.`);
  }
}

// ── service: o gate do filtro usa o predicado canônico para serviço canônico-bound ──
const SVC = 'src/modules/services/services.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  const mStart = svc.indexOf('async discoverServices');
  const method = mStart >= 0 ? svc.slice(mStart, svc.indexOf('\n  async ', mStart + 10) > mStart ? svc.indexOf('\n  async ', mStart + 10) : undefined) : '';
  if (!method) { failures.push(`${SVC}: método discoverServices ausente.`); }
  else {
    // o gate do filtro deve delegar ao predicado canônico quando canonicalServiceId presente.
    const gateOk = /filters\.hasAvailability\s*===\s*true/.test(method)
      && /hasCanonicalOfferingFutureAvailability/.test(method)
      && /canonicalServiceId/.test(method);
    if (!gateOk) failures.push(`${SVC}: o gate has_availability=true não delega ao predicado canônico (hasCanonicalOfferingFutureAvailability) para serviço canônico-bound.`);
  }
}

// enum owner_type='service' preservado (contenção ≠ deleção)
const TYPES = 'src/core/availability/unified-availability.types.ts';
const types = read(TYPES);
if (types === null) { failures.push(`arquivo ausente: ${TYPES}`); }
else if (!/SERVICE\s*=\s*['"]service['"]/.test(types)) {
  failures.push(`${TYPES}: enum AvailabilityOwnerType.SERVICE removido — contenção NÃO deve deletar o enum.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [discovery-has-availability-canonical-filter]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [discovery-has-availability-canonical-filter] — has_availability=true mede por service_offering ativa + janela futura (SSOT), não por owner_type=service; enum preservado. DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT (R1) blindada.');
