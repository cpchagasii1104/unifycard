#!/usr/bin/env node
// Guard estrutural — F-SERVICE-AVAILABILITY-LEGACY-FEED-BADGE-CONTAINMENT-SLICE-A2C
// (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduo R3).
//
// O feed de serviços NÃO pode voltar a habilitar a ação BOOK a partir do sinal legado `owner_type='service'`:
// o predicado `hasAvailability` (que gate `FeedAction.BOOK`) deve, para serviço canônico-bound, retornar false
// ANTES da leitura legada. MORDE se: a checagem de canonicalServiceId com retorno false sumir de hasAvailability;
// o predicado deixar de consultar o serviço (canonical) antes do owner_type='service'; a plugin passar a usar
// `services.metadata.availability` como autoridade; ou o enum `AvailabilityOwnerType.SERVICE` for removido
// (contenção ≠ deleção). Estático, comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const PLUGIN = 'src/modules/services/service-feed.plugin.ts';
const plugin = read(PLUGIN);
if (plugin === null) { failures.push(`arquivo ausente: ${PLUGIN}`); }
else {
  const mStart = plugin.indexOf('private async hasAvailability');
  if (mStart < 0) { failures.push(`${PLUGIN}: método hasAvailability ausente (sinal do FeedAction.BOOK).`); }
  else {
    const mEnd = plugin.indexOf('\n  private ', mStart + 10);
    const method = mEnd > mStart ? plugin.slice(mStart, mEnd) : plugin.slice(mStart);
    // Contenção: para serviço canônico-bound, retorna false antes da leitura legada.
    const hasCanonicalGate = /canonicalServiceId/.test(method) && /return\s+false/.test(method);
    if (!hasCanonicalGate) failures.push(`${PLUGIN}: hasAvailability não contém a checagem de canonicalServiceId com retorno false (o feed voltaria a habilitar BOOK por owner_type='service').`);
    // A checagem de canonical deve vir ANTES da query legada owner_type='service'.
    const idxCanonical = method.search(/canonicalServiceId/);
    const idxLegacyQuery = method.search(/owner_type\s*=\s*'service'/);
    if (idxLegacyQuery >= 0 && (idxCanonical < 0 || idxCanonical > idxLegacyQuery)) {
      failures.push(`${PLUGIN}: a contenção (canonicalServiceId) deve preceder a leitura legada owner_type='service' em hasAvailability.`);
    }
    if (/metadata\.availability/.test(method)) failures.push(`${PLUGIN}: hasAvailability não pode usar services.metadata.availability como autoridade.`);
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
  console.error('GATE FAIL [legacy-service-availability-feed-badge-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [legacy-service-availability-feed-badge-containment] — feed hasAvailability contém owner_type=service para serviço canônico (BOOK não deriva do sinal legado); SSOT na oferta; enum preservado. DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT (R3) blindada.');
