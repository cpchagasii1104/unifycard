#!/usr/bin/env node
// Guard estrutural — F-SERVICE-AVAILABILITY-LEGACY-PUBLIC-ENDPOINT-CONTAINMENT-SLICE-A2B
// (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduo R2).
//
// O endpoint público GET /services/:serviceId/availability NÃO pode voltar a expor janelas `owner_type='service'`
// como agenda reservável verdadeira para serviço canônico-bound: deve conter (getService→canonicalServiceId →
// terminal honesto + vazio controlado) ANTES de qualquer listagem crua. MORDE se: o sentinela de contenção
// (SERVICE_LEVEL_AVAILABILITY_LEGACY_CONTAINED) sumir da rota; a checagem de canonicalServiceId sumir; a rota
// passar a usar `services.metadata.availability` como autoridade; ou o enum `AvailabilityOwnerType.SERVICE` for
// removido (contenção ≠ deleção). Estático, comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const ROUTES = 'src/modules/services/services.routes.ts';
const routes = read(ROUTES);
if (routes === null) { failures.push(`arquivo ausente: ${ROUTES}`); }
else {
  // Escopo: o handler do GET /:serviceId/availability (entre a rota GET e a próxima rota PUT).
  const getIdx = routes.indexOf("'/:serviceId/availability'");
  const putIdx = routes.indexOf("'/:serviceId/availability/:availabilityId'");
  const getHandler = getIdx >= 0
    ? routes.slice(getIdx, putIdx > getIdx ? putIdx : getIdx + 1600)
    : '';
  if (!getHandler) failures.push(`${ROUTES}: rota GET /:serviceId/availability ausente (escopo do guard não encontrado).`);
  else {
    if (!/SERVICE_LEVEL_AVAILABILITY_LEGACY_CONTAINED/.test(getHandler)) failures.push(`${ROUTES}: GET /:serviceId/availability perdeu o terminal de contenção (SERVICE_LEVEL_AVAILABILITY_LEGACY_CONTAINED) — o endpoint voltaria a expor owner_type='service' cru.`);
    if (!/canonicalServiceId/.test(getHandler)) failures.push(`${ROUTES}: GET /:serviceId/availability não checa canonicalServiceId antes de listar (contenção do reader legado ausente).`);
    if (!/contained:\s*true/.test(getHandler)) failures.push(`${ROUTES}: GET /:serviceId/availability não retorna resposta contida (contained:true) para serviço canônico.`);
    if (/metadata\.availability/.test(getHandler)) failures.push(`${ROUTES}: GET /:serviceId/availability não pode usar services.metadata.availability como autoridade.`);
  }
}

// enum owner_type='service' preservado (contenção ≠ deleção)
const TYPES = 'src/core/availability/unified-availability.types.ts';
const types = read(TYPES);
if (types === null) { failures.push(`arquivo ausente: ${TYPES}`); }
else if (!/SERVICE\s*=\s*['"]service['"]/.test(types)) {
  failures.push(`${TYPES}: enum AvailabilityOwnerType.SERVICE removido — contenção NÃO deve deletar o enum (compat/history/policy).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [legacy-service-availability-endpoint-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [legacy-service-availability-endpoint-containment] — GET /services/:id/availability contém owner_type=service para serviço canônico (terminal honesto + vazio); SSOT reservável na oferta; enum preservado. DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT (R2) blindada.');
