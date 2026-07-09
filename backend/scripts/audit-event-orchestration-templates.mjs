#!/usr/bin/env node
// Guard — F-EVENT-ORCHESTRATION-PHASE-B (2026-07-08). Protege o substrato de orquestração de evento:
// necessidade operacional = CONCEPT com aplicabilidade explícita; autoridade por format_concept_id (NUNCA
// orchestration_template_key string, NUNCA event_type legado); need é offer_kind='service' na v1 (enforcement
// MATERIAL por FK composta a concept_offer_kinds). fulfillment_kind governado. Δbank=0.
// MORDE (mutation): remover 'service' do vocab · remover a FK composta da migration · a sugestão passar a
// usar event_type/orchestration_template_key como chave · a rota perder a autoridade. Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const strip = (s) => (s || '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// (1) Vocabulário governado EVENT_NEED_FULFILLMENT_KINDS contém 'service'.
const types = read('src/core/events/event.types.ts');
if (!types) failures.push('event.types.ts ausente.');
else if (!/EVENT_NEED_FULFILLMENT_KINDS\s*=\s*\[[^\]]*'service'/.test(types)) {
  failures.push("event.types.ts: EVENT_NEED_FULFILLMENT_KINDS não inclui 'service'.");
}

// (2) Migration do substrato mantém a FK composta (need é service materialmente) + CHECK do fulfillment.
const migs = readdirSync(join(ROOT, 'migrations')).filter((f) => f.includes('event_orchestration_substrate'));
if (!migs.length) failures.push('migration event_orchestration_substrate ausente.');
else {
  const mig = readFileSync(join(ROOT, 'migrations', migs[0]), 'utf-8');
  if (!/REFERENCES\s+concept_offer_kinds\s*\(\s*concept_id\s*,\s*offer_kind\s*\)/.test(mig)) {
    failures.push(`${migs[0]}: perdeu a FK composta (need_concept_id, fulfillment_kind)→concept_offer_kinds — need deixaria de ser materialmente service.`);
  }
  if (!/fulfillment_kind\s+IN\s*\(\s*'service'\s*\)/.test(mig)) {
    failures.push(`${migs[0]}: CHECK de fulfillment_kind ausente/alterado.`);
  }
}

// (3) A sugestão usa event_orchestration_template_items por format_concept_id; NÃO usa event_type nem
// orchestration_template_key como autoridade.
const tax = strip(read('src/core/events/event-taxonomy.service.ts'));
if (!tax) failures.push('event-taxonomy.service.ts ausente.');
else {
  const fn = tax.slice(tax.indexOf('listOrchestrationSuggestions'));
  const body = fn.slice(0, fn.indexOf('\n  }') + 4) || fn;
  if (!/event_orchestration_template_items/.test(body)) failures.push('listOrchestrationSuggestions: não lê event_orchestration_template_items.');
  if (!/event_format_concept_id/.test(body)) failures.push('listOrchestrationSuggestions: não usa format_concept_id como chave.');
  if (/\bevent_type\b/.test(body)) failures.push('listOrchestrationSuggestions: usa event_type legado como chave — proibido.');
  if (/orchestration_template_key/.test(body)) failures.push('listOrchestrationSuggestions: usa orchestration_template_key string como autoridade — proibido.');
}

// (4) A rota é organizer-gated (assertRepresentsEventOwner).
const routes = strip(read('src/core/events/event.routes.ts'));
if (routes && /orchestration-suggestions/.test(routes)) {
  const idx = routes.indexOf('orchestration-suggestions');
  const around = routes.slice(idx - 400, idx + 400);
  if (!/assertRepresentsEventOwner/.test(around)) failures.push('rota orchestration-suggestions sem assertRepresentsEventOwner (autoridade).');
} else if (routes) {
  failures.push('rota orchestration-suggestions ausente em event.routes.ts.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-orchestration-templates]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-orchestration-templates] — need=CONCEPT service (FK composta), autoridade por format_concept_id, sem event_type/template_key string, rota organizer-gated, fulfillment_kind governado.');
process.exit(0);
