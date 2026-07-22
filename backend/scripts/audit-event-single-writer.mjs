#!/usr/bin/env node
// Guard estrutural — EVENT-ENGINE-COMPLETION · A1c (WRITER ÚNICO de evento, §2/§4.8).
//
// UMA tabela `events`. O ÚNICO writer de criação alcançável é core/events/event.service.ts createEvent
// (via createDraftEvent /v2/create + createEventBoundToGroup F0-grupo). Os writers LEGADOS foram CONTIDOS:
//   · rotas: POST /api/events/ ('/'), POST /api/events/create, sprint76 POST /api/events/events →
//     501 EVENT_LEGACY_WRITER_CONVERGED ANTES da chamada ao writer;
//   · métodos: modules/events/events.service.ts createEvent + modules/events/event.repository.ts createEvent
//     → throw EVENT_LEGACY_WRITER_CONVERGED como PRIMEIRA instrução, ANTES do INSERT INTO events.
//
// MORDE (regressão / revival de writer paralelo) se:
//   (A) core/events/event.service.ts perder o createEvent (o writer canônico);
//   (B) o método legado events.service.ts createEvent tiver INSERT INTO events ALCANÇÁVEL (throw removido
//       ou depois do INSERT);
//   (C) o método legado event.repository.ts createEvent tiver INSERT INTO events ALCANÇÁVEL;
//   (D) alguma das 3 rotas legadas perder a contenção 501 EVENT_LEGACY_WRITER_CONVERGED antes do sink.
// Ancorado por região (padrão addendum-2). Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

// (A) writer canônico existe.
const core = read('src/core/events/event.service.ts');
if (core === null) failures.push('core/events/event.service.ts ausente.');
else if (!/async createEvent\s*\(/.test(core)) failures.push('core/events/event.service.ts: createEvent (writer canônico) sumiu.');

// helper: dentro do método `sig`, o throw de contenção precede o INSERT INTO events.
function containedMethod(src, file, sig) {
  if (src === null) { failures.push(`arquivo ausente: ${file}`); return; }
  const mStart = src.indexOf(sig);
  if (mStart < 0) { failures.push(`${file}: método ${sig} não encontrado.`); return; }
  const nextAsync = src.indexOf('\n  async ', mStart + 1);
  const region = src.slice(mStart, nextAsync > mStart ? nextAsync : src.length);
  const throwIdx = region.indexOf('EVENT_LEGACY_WRITER_CONVERGED');
  const insertIdx = region.search(/INSERT INTO events\b/);
  if (insertIdx >= 0 && (throwIdx < 0 || throwIdx > insertIdx)) {
    failures.push(`${file} :: ${sig}: INSERT INTO events ALCANÇÁVEL (throw EVENT_LEGACY_WRITER_CONVERGED ausente ou depois do INSERT) — writer paralelo revivido.`);
  }
  if (throwIdx < 0) {
    failures.push(`${file} :: ${sig}: contenção EVENT_LEGACY_WRITER_CONVERGED ausente.`);
  }
}

// (B) events.service.ts createEvent contido.
containedMethod(read('src/modules/events/events.service.ts'), 'modules/events/events.service.ts', 'async createEvent(');
// (C) event.repository.ts createEvent contido.
containedMethod(read('src/modules/events/event.repository.ts'), 'modules/events/event.repository.ts', 'async createEvent(');

// (D) rotas legadas contidas: a contenção 501 precede o sink do writer legado na REGIÃO do handler.
function containedRouteBeforeSink(src, file, handlerAnchor, sinkNeedle) {
  if (src === null) { failures.push(`arquivo ausente: ${file}`); return; }
  const hStart = src.indexOf(handlerAnchor);
  if (hStart < 0) { failures.push(`${file}: handler ${handlerAnchor} não encontrado.`); return; }
  const contIdx = src.indexOf('EVENT_LEGACY_WRITER_CONVERGED', hStart);
  const sinkIdx = src.indexOf(sinkNeedle, hStart);
  if (contIdx < 0 || sinkIdx < 0 || contIdx > sinkIdx) {
    failures.push(`${file}: contenção 501 EVENT_LEGACY_WRITER_CONVERGED não precede o sink ${sinkNeedle} na rota ${handlerAnchor}.`);
  }
}
// W1 rota '/' (core routes) — âncora = a required-array única da rota '/' (precede a contenção);
// sink = eventService.createEvent(req.tenant.id, toCreateEventInput
containedRouteBeforeSink(read('src/core/events/event.routes.ts'), 'src/core/events/event.routes.ts',
  "'actor_type', 'event_type', 'title'", 'eventService.createEvent(req.tenant.id, toCreateEventInput');
// W2 rota /create — sink = eventsService.createEvent(
containedRouteBeforeSink(read('src/modules/events/events.routes.ts'), 'src/modules/events/events.routes.ts',
  "'/create'", 'eventsService.createEvent(');
// W3 rota sprint76 /events — sink = eventRepository.createEvent(
containedRouteBeforeSink(read('src/modules/events/events-sprint76.routes.ts'), 'src/modules/events/events-sprint76.routes.ts',
  "'/events'", 'eventRepository.createEvent(');

if (failures.length > 0) {
  console.error('GATE FAIL [event-single-writer]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-single-writer] — writer único de evento: core/events/event.service.ts createEvent é o único alcançável; writers legados (events.service/event.repository) throw-contidos ANTES do INSERT; as 3 rotas legadas (/, /create, sprint76 /events) 501 EVENT_LEGACY_WRITER_CONVERGED antes do sink. Nenhum INSERT INTO events paralelo executável (§2/§4.8).');
