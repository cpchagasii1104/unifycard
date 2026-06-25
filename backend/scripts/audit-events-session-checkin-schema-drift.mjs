#!/usr/bin/env node
// Gate estrutural — F-EVENTS-SESSION-CHECKIN-SCHEMA-DRIFT (correção funcional).
// Fecha o drift dos WRITERS addSession/checkIn contra o schema vivo (alinhamento de colunas; sem mudar quarentena):
//   - addSession INSERT usa event_sessions(tenant_id, event_id, title, starts_at, ends_at) — NÃO name/start_time/end_time;
//   - addSession grava tenant_id (NOT NULL);
//   - checkIn INSERT usa event_attendees(tenant_id, ..., check_in_time) — NÃO checked_in_at-coluna; grava tenant_id (NOT NULL);
//   - os gates de quarentena (assertGlobalUserNotQuarantined) seguem ANTES das escritas (8ª fatia preservada);
//   - createEvent gate (scope+acting) preservado.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/events/events.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const raw = read(SVC);
if (!raw) {
  failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: events.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // addSession: INSERT alinhado ao schema vivo + gate preservado
  {
    checked++;
    const body = sliceMethod(code, 'async addSession(');
    const insertMatch = body.match(/INSERT\s+INTO\s+event_sessions\s*\(([^)]*)\)/i);
    if (!insertMatch) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession perdeu o INSERT INTO event_sessions.');
    else {
      const cols = insertMatch[1];
      if (/\bname\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession volta a inserir coluna `name` (schema vivo é `title`).');
      if (/\bstart_time\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession volta a inserir `start_time` (schema vivo é `starts_at`).');
      if (/\bend_time\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession volta a inserir `end_time` (schema vivo é `ends_at`).');
      if (!/\btenant_id\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession INSERT não grava tenant_id (NOT NULL).');
      if (!/\btitle\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession INSERT não usa `title`.');
      if (!/\bstarts_at\b/.test(cols) || !/\bends_at\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: addSession INSERT não usa starts_at/ends_at.');
    }
    // gate preservado
    if (!/this\.assertGlobalUserNotQuarantined\(tenantId,\s*actingGlobalUserId\)/.test(body)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: gate de quarentena de addSession regrediu.');
  }

  // checkIn: o drift era a OMISSÃO de tenant_id (NOT NULL → 23502); a coluna checked_in_at é a viva (renomeada de
  // check_in_time). Trava: INSERT grava tenant_id; gate preservado.
  {
    checked++;
    const body = sliceMethod(code, 'async checkIn(');
    const insertMatch = body.match(/INSERT\s+INTO\s+event_attendees\s*\(([^)]*)\)/i);
    if (!insertMatch) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: checkIn perdeu o INSERT INTO event_attendees.');
    else {
      const cols = insertMatch[1];
      if (!/\btenant_id\b/.test(cols)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: checkIn INSERT não grava tenant_id (NOT NULL → 23502).');
    }
    // coluna de check-in é checked_in_at (viva); check_in_time NÃO existe no schema vivo (foi renomeada)
    if (/\bcheck_in_time\b/.test(body)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: checkIn usa `check_in_time` (coluna foi renomeada p/ checked_in_at na migration 20260530151000).');
    // gate preservado
    if (!/this\.assertGlobalUserNotQuarantined\(tenantId,\s*globalUserId\)/.test(body)) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: gate de quarentena de checkIn regrediu.');
  }

  // createEvent gate (scope+acting) preservado
  {
    checked++;
    const ce = sliceMethod(code, 'async createEvent(');
    if (ce.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorIdForEvent\)/) < 0) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: gate de scope do createEvent regrediu.');
    if (ce.search(/this\.assertGlobalUserNotQuarantined\(tenantId,\s*createdByGlobalUserId\)/) < 0) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: gate de acting do createEvent regrediu.');
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('SESSION_CHECKIN_DRIFT_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[events-session-checkin-schema-drift] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [events-session-checkin-schema-drift]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [events-session-checkin-schema-drift] — addSession(title/starts_at/ends_at/tenant_id) e checkIn(tenant_id; checked_in_at vivo) alinhados ao schema vivo; gates de quarentena preservados ANTES da escrita; canRepresentActor puro.');
