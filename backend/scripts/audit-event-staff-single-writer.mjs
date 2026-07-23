#!/usr/bin/env node
// Guard estrutural — EVENT-ENGINE-COMPLETION · C2b (WRITER ÚNICO do vínculo actor↔evento, §2/§4.8).
//
// UMA entidade de vínculo (event_staff/OperationalCommitment). O ÚNICO writer de vínculo alcançável é
// core/events/operational-commitments.service.ts createCommitment (actor-first, gate DUAL, via
// POST /events/:id/v2/commitments). O writer LEGADO user-only foi CONTIDO:
//   · rota: POST /events/:eventId/assign-staff → 501 EVENT_ASSIGN_STAFF_CONVERGED ANTES do sink;
//   · método: modules/events/events.service.ts assignStaff → throw EVENT_ASSIGN_STAFF_CONVERGED como
//     PRIMEIRA instrução, ANTES do INSERT INTO event_staff.
//
// MORDE (regressão / revival) se:
//   (A) createCommitment perder seu INSERT INTO event_staff (o writer canônico);
//   (B) assignStaff tiver INSERT INTO event_staff ALCANÇÁVEL (throw removido ou depois do INSERT);
//   (C) a rota assign-staff perder a contenção 501 antes do sink eventsService.assignStaff;
//   (D) aparecer INSERT INTO event_staff em QUALQUER arquivo fora de operational-commitments.service
//       (canônico) e events.service.ts (contido) — writer paralelo novo.
// Ancorado por região (padrão audit-event-single-writer). Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const CANON = 'src/core/events/operational-commitments.service.ts';
const LEGACY = 'src/modules/events/events.service.ts';
const ROUTE = 'src/modules/events/events.routes.ts';

// (A) writer canônico existe (createCommitment com INSERT INTO event_staff).
const canon = read(CANON);
if (canon === null) failures.push(`${CANON} ausente.`);
else {
  const mStart = canon.indexOf('async createCommitment');
  const region = mStart >= 0 ? canon.slice(mStart) : '';
  if (mStart < 0) failures.push(`${CANON}: createCommitment (writer canônico) sumiu.`);
  else if (!/INSERT INTO event_staff\b/.test(region.slice(0, region.indexOf('\n  async ') > 0 ? region.indexOf('\n  async ', 1) : region.length)))
    failures.push(`${CANON}: createCommitment sem INSERT INTO event_staff (writer canônico quebrado).`);
}

// (B) método legado assignStaff contido: throw precede o INSERT INTO event_staff.
const legacy = read(LEGACY);
if (legacy === null) failures.push(`${LEGACY} ausente.`);
else {
  const mStart = legacy.indexOf('async assignStaff(');
  if (mStart < 0) failures.push(`${LEGACY}: método assignStaff não encontrado.`);
  else {
    const nextAsync = legacy.indexOf('\n  async ', mStart + 1);
    const region = legacy.slice(mStart, nextAsync > mStart ? nextAsync : legacy.length);
    const throwIdx = region.indexOf('EVENT_ASSIGN_STAFF_CONVERGED');
    const insertIdx = region.search(/INSERT INTO event_staff\b/);
    if (insertIdx >= 0 && (throwIdx < 0 || throwIdx > insertIdx))
      failures.push(`${LEGACY} :: assignStaff: INSERT INTO event_staff ALCANÇÁVEL (throw EVENT_ASSIGN_STAFF_CONVERGED ausente ou depois do INSERT) — writer legado revivido.`);
    if (throwIdx < 0) failures.push(`${LEGACY} :: assignStaff: contenção EVENT_ASSIGN_STAFF_CONVERGED ausente.`);
  }
}

// (C) rota assign-staff contida: 501 EVENT_ASSIGN_STAFF_CONVERGED precede o sink eventsService.assignStaff.
const route = read(ROUTE);
if (route === null) failures.push(`${ROUTE} ausente.`);
else {
  const hStart = route.indexOf("'/:eventId/assign-staff'");
  if (hStart < 0) failures.push(`${ROUTE}: rota /:eventId/assign-staff não encontrada.`);
  else {
    const contIdx = route.indexOf('EVENT_ASSIGN_STAFF_CONVERGED', hStart);
    const sinkIdx = route.indexOf('eventsService.assignStaff(', hStart);
    if (contIdx < 0 || sinkIdx < 0 || contIdx > sinkIdx)
      failures.push(`${ROUTE}: contenção 501 EVENT_ASSIGN_STAFF_CONVERGED não precede o sink eventsService.assignStaff na rota assign-staff.`);
  }
}

// (D) universo: nenhum INSERT INTO event_staff fora dos 2 arquivos conhecidos.
const ALLOWED = new Set([CANON.replace(/\//g, '\\'), LEGACY.replace(/\//g, '\\'), CANON, LEGACY]);
function walk(dir, acc) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules' && e !== 'scripts') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}
const srcDir = join(ROOT, 'src');
if (existsSync(srcDir)) {
  for (const p of walk(srcDir, [])) {
    const rel = p.slice(ROOT.length + 1).replace(/\\/g, '/');
    if (rel === CANON || rel === LEGACY) continue;
    const src = stripTs(readFileSync(p, 'utf-8'));
    if (/INSERT INTO event_staff\b/.test(src))
      failures.push(`${rel}: INSERT INTO event_staff fora dos writers conhecidos — writer paralelo novo (§2/§4.8).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-staff-single-writer]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-staff-single-writer] — writer único do vínculo actor↔evento: createCommitment (operational-commitments.service) é o único INSERT INTO event_staff alcançável; assignStaff legado throw-contido ANTES do INSERT; rota assign-staff 501 EVENT_ASSIGN_STAFF_CONVERGED antes do sink; nenhum INSERT paralelo em outro arquivo (§2/§4.8).');
