#!/usr/bin/env node
// Guard estrutural — F-EVENTS-GHOST-CONTAINMENT (2026-06-25).
// reputation_scores e event_locations são schema GHOST (ausentes no schema vivo; vivem só em
// migrations_archive). Decisão da direção: CONTER, NÃO materializar. Este guard prova a contenção:
//   (A) assignStaff NÃO hard-faila por reputation_scores: nenhum `throw 'reputação suficiente'`;
//       a chamada a getScoreByGlobalUserId é CONTIDA por isMissingRelation (42P01) e o gate aspiracional
//       NÃO bloqueia a designação.
//   (B) assignStaff preserva as travas REAIS: gate de quarentena ANTES da reputação/insert; INSERT
//       actor-keyed (tenant_id + responsible_actor_id + responsible_actor_type) com actor resolvido por
//       ensureUserActor (não global_user_id cru).
//   (C) getEventWithDetails CONTÉM event_locations ghost: try/catch isMissingRelation → locations=[] (não crasha);
//       reader de sessões segue alinhado (title/starts_at/ends_at).
//   (D) rotas hard-fail de reputação (identity GET reputation + GET /reputation/:type/:id) NÃO vazam 500 bruto
//       por ghost: contêm 42P01 → 501 semântico (REPUTATION_SOURCE_UNAVAILABLE).
//   (E) o módulo social (actor_reputation) NÃO foi usado como substituto: events.service não importa o
//       reputation.service do módulo social.
//   (F) nenhuma migration viva cria reputation_scores nem event_locations (gênese/decisão de modelo = futura).
//   (G) acceptQuote segue no freezer R7b (EVENT_RFQ_ACCEPT_QUOTE_CONTAINED) — não tocado.
//   (H) canRepresentActor segue PURA (sem checar quarentena).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SVC = join(ROOT, 'src/modules/events/events.service.ts');
const AUTHZ = join(ROOT, 'src/core/authorization/authorization.service.ts');
const IDENTITY_ROUTES = join(ROOT, 'src/core/identity/identity.routes.ts');
const REP_ROUTES = join(ROOT, 'src/core/reputation/reputation.routes.ts');
const RFQ_ROUTES = join(ROOT, 'src/modules/events/event-rfq.routes.ts');
const MIGRATIONS = join(ROOT, 'migrations');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

const raw = read(SVC);
if (!raw) {
  failures.push('REPUTATION_LOCATIONS_GHOST_CONTAINMENT: events.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper de contenção presente
  checked++;
  must(/function isMissingRelation\(/.test(code) && /'42P01'/.test(code),
    'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: events.service perdeu o helper isMissingRelation (42P01).');

  // (A)+(B) assignStaff: sem hard-fail de reputação + contenção + travas reais ──────────────────
  {
    checked++;
    const body = sliceMethod(code, 'async assignStaff(');
    must(!!body, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff sumiu.');
    // (A) NÃO pode reintroduzir o hard-fail aspiracional
    must(!/reputação suficiente/.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff voltou a hard-failar por reputação ("reputação suficiente").');
    // contenção: a chamada (se existir) está sob try/catch isMissingRelation
    if (/getScoreByGlobalUserId/.test(body)) {
      must(/catch\s*\([\s\S]{0,400}?isMissingRelation/.test(body),
        'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff chama getScoreByGlobalUserId sem contenção isMissingRelation.');
    }
    // (B) gate de quarentena preservado E antes do INSERT
    must(/this\.assertGlobalUserNotQuarantined\(tenantId,\s*assignedByGlobalUserId\)/.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: gate de quarentena de assignStaff regrediu.');
    const idxGate = body.indexOf('assertGlobalUserNotQuarantined');
    const idxInsert = body.search(/INSERT\s+INTO\s+event_staff/i);
    must(idxGate >= 0 && idxInsert >= 0 && idxGate < idxInsert,
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: gate de quarentena deve vir ANTES do INSERT event_staff.');
    // (B) INSERT actor-keyed
    const insertMatch = body.match(/INSERT\s+INTO\s+event_staff\s*\(([^)]*)\)/i);
    if (!insertMatch) failures.push('REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff perdeu o INSERT INTO event_staff.');
    else {
      const cols = insertMatch[1];
      must(/\btenant_id\b/.test(cols), 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff INSERT não grava tenant_id.');
      must(/\bresponsible_actor_id\b/.test(cols), 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff INSERT não grava responsible_actor_id.');
      must(/\bresponsible_actor_type\b/.test(cols), 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff INSERT não grava responsible_actor_type.');
    }
    must(/ensureUserActor\s*\(\s*tenantId,\s*staffUser\.user_id\s*\)/.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff não resolve o actor do staff via ensureUserActor.');
    must(!/\[\s*tenantId,\s*eventId,\s*globalUserId\b/.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: assignStaff usa global_user_id CRU como responsible_actor_id.');
  }

  // (C) getEventWithDetails: event_locations contido + reader de sessões alinhado ────────────────
  {
    checked++;
    const body = sliceMethod(code, 'async getEventWithDetails(');
    must(!!body, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: getEventWithDetails sumiu.');
    // contenção do ghost: a query de event_locations sob try/catch isMissingRelation com fallback []
    must(/FROM\s+event_locations/i.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: getEventWithDetails perdeu a query de event_locations.');
    must(/locationsRows\s*=\s*\[\]/.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: getEventWithDetails não tem fallback locations=[] (contenção removida).');
    must(/catch\s*\([\s\S]{0,500}?isMissingRelation/.test(body),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: query de event_locations não está contida por isMissingRelation.');
    // reader de sessões alinhado (não regrediu)
    const sessSel = body.match(/SELECT[\s\S]*?FROM\s+event_sessions/i);
    must(!!sessSel, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: getEventWithDetails perdeu o SELECT de event_sessions.');
    if (sessSel) {
      const sel = sessSel[0];
      must(/title\s+AS\s+name/i.test(sel) && /starts_at\s+AS\s+start_time/i.test(sel) && /ends_at\s+AS\s+end_time/i.test(sel),
        'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: reader de sessões regrediu (deve usar title/starts_at/ends_at).');
    }
  }

  // (E) social actor_reputation NÃO foi usado como substituto em events.service ──────────────────
  checked++;
  must(!/modules\/social\/reputation/.test(raw) && !/\bactor_reputation\b/.test(code),
    'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: events.service passou a usar o reputation social/actor_reputation (substituição sem decisão).');
}

// (D) rotas hard-fail de reputação contêm 42P01 → 501, sem vazar 500 bruto ──────────────────────
{
  checked++;
  const idRoutes = read(IDENTITY_ROUTES);
  must(!!idRoutes, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: identity.routes.ts ausente.');
  if (idRoutes) {
    const stripped = stripTs(idRoutes);
    // a chamada a getScoreByGlobalUserId deve ter contenção 42P01 → 501 REPUTATION_SOURCE_UNAVAILABLE
    must(/REPUTATION_SOURCE_UNAVAILABLE/.test(stripped) && /'42P01'/.test(stripped) && /status\(\s*501\s*\)/.test(stripped),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: identity reputation route não contém 42P01 → 501 (REPUTATION_SOURCE_UNAVAILABLE).');
  }

  const repRoutes = read(REP_ROUTES);
  must(!!repRoutes, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: reputation.routes.ts ausente.');
  if (repRoutes) {
    const stripped = stripTs(repRoutes);
    must(/REPUTATION_SOURCE_UNAVAILABLE/.test(stripped) && /'42P01'/.test(stripped) && /status\(\s*501\s*\)/.test(stripped),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: GET /reputation/:type/:id não contém 42P01 → 501 (vaza 500 bruto).');
  }
}

// (F) nenhuma migration viva cria reputation_scores nem event_locations ──────────────────────────
{
  checked++;
  const migs = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
  let createdRep = false;
  let createdLoc = false;
  for (const f of migs) {
    if (!/\.sql$/.test(f)) continue;
    const sql = read(join(MIGRATIONS, f)) || '';
    if (/CREATE TABLE (IF NOT EXISTS )?reputation_scores\b/i.test(sql)) createdRep = true;
    if (/CREATE TABLE (IF NOT EXISTS )?event_locations\b/i.test(sql)) createdLoc = true;
  }
  must(!createdRep, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: migration viva cria reputation_scores (decisão de modelo é futura, NÃO esta contenção).');
  must(!createdLoc, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: migration viva cria event_locations (decisão de modelo é futura, NÃO esta contenção).');
}

// (G) acceptQuote freezer R7b intacto ─────────────────────────────────────────────────────────────
{
  checked++;
  const rfq = read(RFQ_ROUTES);
  must(!!rfq, 'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: event-rfq.routes.ts ausente.');
  if (rfq) {
    must(/EVENT_RFQ_ACCEPT_QUOTE_CONTAINED/.test(rfq),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: acceptQuote perdeu o containment R7b (EVENT_RFQ_ACCEPT_QUOTE_CONTAINED).');
  }
}

// (H) canRepresentActor PURA ──────────────────────────────────────────────────────────────────────
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    must(!(m && /isActorEffectivelyBlocked/.test(m[0])),
      'REPUTATION_LOCATIONS_GHOST_CONTAINMENT: canRepresentActor passou a checar quarentena — deve ficar PURA.');
  }
}

console.log(`[events-reputation-locations-ghost-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [events-reputation-locations-ghost-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [events-reputation-locations-ghost-containment] — reputation_scores e event_locations contidos (não materializados); assignStaff sem hard-fail de reputação, quarentena+actor-keyed preservados; getEventWithDetails locations=[] em ghost; rotas de reputação 42P01→501; social actor_reputation não usado como substituto; acceptQuote R7b intacto; canRepresentActor puro.');
