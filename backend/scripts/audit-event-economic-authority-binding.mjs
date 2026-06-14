#!/usr/bin/env node
// Guard estrutural — B2f (F-EVENT-ECONOMIC-AUTHORITY-BINDING / DECISION-0131 §B7 / 0113).
//
// As rotas econômicas v2 que CRIAM estado (POST .../economic/v2/custody e .../economic/v2/split) liam
// actor declarado no body (economic_owner_id / parts[].target_id) e chamavam o service SEM binding
// server-side → autoria spoofável. Agora ambas exigem `userRepresentsActor(..., event.actorId)` ANTES
// do side-effect (autoridade é sobre o EVENTO, via canRepresentActor; o owner/targets são DADO).
// FALHA (exit 1) se, em src/core/events/event.routes.ts:
//   (a) `eventCustodyService.createCustody(` ou `eventSplitDeclarativeService.calculateSplit(` for
//       chamado SEM um `userRepresentsActor(` + `event.actorId` + 403 PERMISSION_DENIED imediatamente antes
//       (mesmo handler, janela curta);
//   (b) sumir o helper `userRepresentsActor` (binding canônico) do arquivo.
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'core', 'events', 'event.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const GUARDED_CALLS = [
  { sym: 'eventCustodyService.createCustody', label: 'custody' },
  { sym: 'eventSplitDeclarativeService.calculateSplit', label: 'split' },
];

function runGuard() {
  const failures = [];
  if (!existsSync(FILE)) { console.error('GATE FAIL [event-economic-authority-binding]: event.routes.ts ausente.'); process.exit(1); }
  const code = stripComments(readFileSync(FILE, 'utf8'));

  if (!/function\s+userRepresentsActor\s*\(/.test(code) || !/canRepresentActor/.test(code)) {
    failures.push('helper userRepresentsActor/canRepresentActor sumiu — binding canônico ausente.');
  }

  for (const { sym, label } of GUARDED_CALLS) {
    const re = new RegExp(sym.replace('.', '\\.') + '\\s*\\(', 'g');
    let m;
    let found = 0;
    while ((m = re.exec(code)) !== null) {
      found += 1;
      const window = code.slice(Math.max(0, m.index - 900), m.index);
      const bound =
        /userRepresentsActor\s*\([^)]*event\.actorId/.test(window) &&
        /PERMISSION_DENIED/.test(window) &&
        /\beventService\.getEvent\s*\(/.test(window);
      if (!bound) {
        failures.push(`${label}: ${sym} chamado SEM binding server-side (userRepresentsActor(..., event.actorId) + 403 PERMISSION_DENIED + getEvent) imediatamente antes.`);
      }
    }
    if (found === 0) {
      failures.push(`${label}: chamada ${sym} não encontrada — rota econômica sumiu (guard precisa revisão).`);
    }
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [event-economic-authority-binding]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[event-economic-authority-binding] custody/split exigem userRepresentsActor(event.actorId) + 403 PERMISSION_DENIED antes do side-effect; binding canônico presente.');
  console.log('GATE OK [event-economic-authority-binding] — rotas econômicas v2 vinculam autoridade ao dono do evento (sem spoof por actor declarado no body).');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
