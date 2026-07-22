#!/usr/bin/env node
// Guard estrutural — F-EVENT-ENGINE-COUPLING · F0-GRUPO (vínculo GOVERNADO evento↔grupo).
//
// O writer format-first (core/events/event.service.ts) grava group_events SÓ dentro de
// createEventBoundToGroup, e SÓ depois de: (1) materializar o group-actor via findOrCreateGroupActor
// (lazy-heal §4.8.1); (2) provar canRepresentActor(actingUserId, groupActorId, client) transaction-aware
// ANTES do INSERT (§4.9.5, fail-closed). group_events usa SÓ as 3 colunas reais do schema vivo.
//
// MORDE (regressão) se, dentro de createEventBoundToGroup:
//   (A) o INSERT INTO group_events perder o canRepresentActor que o precede;
//   (B) perder a chamada findOrCreateGroupActor (materialização governada do group-actor);
//   (C) o INSERT group_events referenciar colunas fora do schema vivo (title/starts_at/created_by/...).
// Ancorado POR REGIÃO do método (padrão addendum-2). Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'core', 'events', 'event.service.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf-8'));
  const mStart = src.indexOf('private async createEventBoundToGroup(');
  if (mStart < 0) {
    failures.push('createEventBoundToGroup não encontrado — o writer governado de vínculo evento↔grupo sumiu.');
  } else {
    // Região do método: do início até o próximo método privado/async de classe.
    const nextMethod = src.indexOf('\n  private async ', mStart + 1);
    const nextAsync = src.indexOf('\n  async ', mStart + 1);
    const ends = [nextMethod, nextAsync].filter((i) => i > mStart);
    const region = src.slice(mStart, ends.length ? Math.min(...ends) : src.length);

    const healIdx = region.search(/findOrCreateGroupActor\s*\(/);
    const repIdx = region.search(/canRepresentActor\s*\([^)]*client\s*\)/);
    const insertIdx = region.search(/INSERT INTO group_events/);

    // (B) heal presente e ANTES do insert
    if (healIdx < 0) {
      failures.push('createEventBoundToGroup: findOrCreateGroupActor ausente — group-actor não materializado (§4.8.1).');
    }
    // (A) canRepresentActor transaction-aware presente e ANTES do insert
    if (repIdx < 0) {
      failures.push('createEventBoundToGroup: canRepresentActor(...client) ausente — autoridade transaction-aware perdida (§4.9.5/§4.9.8).');
    }
    if (insertIdx < 0) {
      failures.push('createEventBoundToGroup: INSERT INTO group_events ausente — o vínculo governado sumiu.');
    }
    if (repIdx >= 0 && insertIdx >= 0 && repIdx > insertIdx) {
      failures.push('createEventBoundToGroup: canRepresentActor roda DEPOIS do INSERT group_events — autoridade deve PRECEDER a escrita (fail-closed).');
    }
    if (healIdx >= 0 && insertIdx >= 0 && healIdx > insertIdx) {
      failures.push('createEventBoundToGroup: findOrCreateGroupActor roda DEPOIS do INSERT group_events — materialização deve preceder.');
    }
    // (C) INSERT group_events só com as 3 colunas reais (tenant_id, group_id, event_id)
    const insBlock = insertIdx >= 0 ? region.slice(insertIdx, insertIdx + 200) : '';
    if (/title|starts_at|ends_at|created_by|description/.test(insBlock)) {
      failures.push('createEventBoundToGroup: INSERT group_events referencia colunas FORA do schema vivo (5 col: id/tenant_id/group_id/event_id/created_at).');
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-group-binding-authority]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-group-binding-authority] — vínculo evento↔grupo governado: findOrCreateGroupActor (heal §4.8.1) + canRepresentActor(...client) (§4.9.5/§4.9.8) PRECEDEM o INSERT group_events (3 colunas reais), atômico. F0-grupo blindada.');
