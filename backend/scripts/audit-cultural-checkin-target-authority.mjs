#!/usr/bin/env node
// Guard estrutural — F-CULTURAL-CHECKIN-TARGET-AUTHORITY-BINDING-SLICE-A (DECISION-0113 residual · B1).
//
// POST /cultural/events/:eventId/check-in aceita target_actor_id/target_actor_type do body e grava presença
// em cultural_event_checkins. AUTO/QR_CODE NÃO podem gravar em nome de actor alheio declarado no body:
//   • self permitido; actor representável permitido (canRepresentActor server-side a partir de req.user.id);
//   • alheio não representável → 403 fail-closed ANTES da escrita.
//   • MANUAL é preservado — o gate de validador/portaria (canValidateCheckIn) vive no service.
//
// MORDE (regressão real) se o handler de check-in:
//   (A) deixar de chamar canRepresentActor no caminho AUTO/QR_CODE;
//   (B) o gate não for fail-closed 403 (code CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE);
//   (C) o gate rodar DEPOIS do sink culturalEventService.checkIn( (bind tem de preceder a escrita);
//   (D) o service perder o gate MANUAL canValidateCheckIn (autoridade da portaria).
// Heurística textual comment-stripped (não AST). Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const ROUTES = 'src/modules/cultural/cultural.routes.ts';
const SERVICE = 'src/modules/cultural/cultural-event.service.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const failures = [];

// ── Handler POST .../check-in (segmento até o próximo fastify.<verb> ou fim) ──
const routes = read(ROUTES);
if (routes === null) {
  failures.push(`arquivo ausente: ${ROUTES}`);
} else {
  const marks = [];
  const re = /fastify\.(post|get|put|delete)<[\s\S]*?>\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(routes)) !== null) marks.push({ path: m[2], start: m.index });
  const idx = marks.findIndex((mk) => /\/check-in$/.test(mk.path));
  if (idx < 0) {
    failures.push(`${ROUTES}: handler POST .../check-in não encontrado (rota renomeada/removida?).`);
  } else {
    const body = routes.slice(marks[idx].start, idx + 1 < marks.length ? marks[idx + 1].start : routes.length);

    const gateIdx = body.search(/canRepresentActor\s*\(/);
    const methodGate = /method\s*===\s*'AUTO'[\s\S]*?method\s*===\s*'QR_CODE'|method\s*===\s*'QR_CODE'[\s\S]*?method\s*===\s*'AUTO'/.test(body);
    const forbid403 = /return\s+reply\.status\(\s*403\s*\)[\s\S]*?CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE/;
    const has403 = forbid403.test(body);
    const sinkIdx = body.search(/culturalEventService\.checkIn\s*\(/);

    // (A) gate presente
    if (gateIdx < 0) failures.push(`${ROUTES} check-in: canRepresentActor ausente — AUTO/QR_CODE gravaria presença de actor alheio declarado no body.`);
    // (B) fail-closed 403 com code
    if (!has403) failures.push(`${ROUTES} check-in: hard-stop 403 CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE ausente (bind deve ser fail-closed).`);
    // método gate: só AUTO/QR_CODE (não MANUAL) passam pelo canRepresentActor
    if (!methodGate) failures.push(`${ROUTES} check-in: o bind não está condicionado a method AUTO/QR_CODE — MANUAL não pode cair no gate de representação (é fluxo de validador/portaria).`);
    // (C) gate precede o sink
    if (gateIdx >= 0 && sinkIdx >= 0 && gateIdx > sinkIdx) {
      failures.push(`${ROUTES} check-in: canRepresentActor roda DEPOIS de culturalEventService.checkIn (gate@${gateIdx} sink@${sinkIdx}) — bind deve preceder a escrita.`);
    }
    if (sinkIdx < 0) failures.push(`${ROUTES} check-in: sink culturalEventService.checkIn( não encontrado (mudou de forma?).`);
    // o gate usa req.user.id (server-side), não o target cru como autoridade
    if (gateIdx >= 0 && !/canRepresentActor\s*\(\s*req\.tenant\.id\s*,\s*req\.user\.id\s*,/.test(body)) {
      failures.push(`${ROUTES} check-in: canRepresentActor deve receber req.user.id (subject server-side), nunca o target/actorType do body como autoridade.`);
    }
  }
}

// ── MANUAL gate preservado no service ──
const service = read(SERVICE);
if (service === null) {
  failures.push(`arquivo ausente: ${SERVICE}`);
} else {
  if (!/canValidateCheckIn\s*\(/.test(service)) {
    failures.push(`${SERVICE}: canValidateCheckIn removido — o gate de validador/portaria do fluxo MANUAL não pode desaparecer.`);
  }
  if (!/method\s*===\s*'MANUAL'/.test(service)) {
    failures.push(`${SERVICE}: ramo method === 'MANUAL' ausente — o fluxo de validador deixaria de ser distinguido.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [cultural-checkin-target-authority]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [cultural-checkin-target-authority] — check-in AUTO/QR_CODE exige self OU canRepresentActor(req.user.id) sobre o target, fail-closed 403 antes do sink; MANUAL preserva canValidateCheckIn (validador/portaria). DECISION-0113 residual B1 blindado.');
