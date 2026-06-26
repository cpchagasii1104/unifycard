#!/usr/bin/env node
// Gate estrutural — F-EVENTS-ASSIGNSTAFF-SESSIONREAD-SCHEMA-DRIFT (correção funcional).
// Fecha o drift de assignStaff (writer) e do reader getEventWithDetails contra o schema vivo:
//   - assignStaff INSERT em event_staff grava tenant_id + responsible_actor_id + responsible_actor_type (NOT NULL);
//   - responsible_actor_id vem de um actor RESOLVIDO por ensureUserActor, NÃO global_user_id cru;
//   - o gate de quarentena (assertGlobalUserNotQuarantined do assigner) segue ANTES do insert;
//   - getEventWithDetails NÃO seleciona name/start_time/end_time de event_sessions; usa title/starts_at/ends_at (alias);
//   - addSession/checkIn (15ª fatia) não regridem.
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
  failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: events.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // assignStaff: INSERT alinhado (tenant_id + responsible_actor_id + responsible_actor_type) + actor resolvido + gate
  {
    checked++;
    const body = sliceMethod(code, 'async assignStaff(');
    const insertMatch = body.match(/INSERT\s+INTO\s+event_staff\s*\(([^)]*)\)/i);
    if (!insertMatch) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: assignStaff perdeu o INSERT INTO event_staff.');
    else {
      const cols = insertMatch[1];
      if (!/\btenant_id\b/.test(cols)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: assignStaff INSERT não grava tenant_id (NOT NULL).');
      if (!/\bresponsible_actor_id\b/.test(cols)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: assignStaff INSERT não grava responsible_actor_id (NOT NULL).');
      if (!/\bresponsible_actor_type\b/.test(cols)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: assignStaff INSERT não grava responsible_actor_type (NOT NULL).');
    }
    // actor resolvido por ensureUserActor; responsible_actor_id = staffActor.actor_id (não global_user_id cru)
    if (!/ensureUserActor\s*\(\s*tenantId,\s*staffUser\.user_id\s*\)/.test(body)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: assignStaff não resolve o actor do staff via ensureUserActor.');
    if (/responsible_actor_id[\s\S]{0,40}?,\s*globalUserId\b/.test(body) || /\[\s*tenantId,\s*eventId,\s*globalUserId\b/.test(body)) {
      failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: assignStaff usa global_user_id CRU como responsible_actor_id.');
    }
    // gate preservado (assigner)
    if (!/this\.assertGlobalUserNotQuarantined\(tenantId,\s*assignedByGlobalUserId\)/.test(body)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: gate de quarentena de assignStaff regrediu.');
  }

  // getEventWithDetails: reader de sessões alinhado
  {
    checked++;
    const body = sliceMethod(code, 'async getEventWithDetails(');
    const sessSel = body.match(/SELECT[\s\S]*?FROM\s+event_sessions/i);
    if (!sessSel) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: getEventWithDetails perdeu o SELECT de event_sessions.');
    else {
      const sel = sessSel[0];
      if (/\bstart_time\b(?!\s+AS)|\bend_time\b(?!\s+AS)/.test(sel) || /SELECT[^]*?\bname\b(?!\s)/.test(sel) === false && /,\s*name\b/.test(sel)) {
        // checagem direta abaixo
      }
      if (/FROM\s+event_sessions/i.test(sel) && /,\s*name\b/.test(sel) && !/title\s+AS\s+name/i.test(sel)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: reader seleciona `name` de event_sessions (vivo é title; use title AS name).');
      if (/\bstart_time\b/.test(sel) && !/starts_at\s+AS\s+start_time/i.test(sel)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: reader seleciona `start_time` (vivo é starts_at).');
      if (/\bend_time\b/.test(sel) && !/ends_at\s+AS\s+end_time/i.test(sel)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: reader seleciona `end_time` (vivo é ends_at).');
      if (!/title\s+AS\s+name/i.test(sel) || !/starts_at\s+AS\s+start_time/i.test(sel) || !/ends_at\s+AS\s+end_time/i.test(sel)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: reader não usa os aliases vivos (title/starts_at/ends_at).');
    }
  }

  // addSession/checkIn (15ª fatia) não regrediram
  {
    checked++;
    const add = sliceMethod(code, 'async addSession(');
    if (!/INSERT\s+INTO\s+event_sessions\s*\([^)]*\btenant_id\b[^)]*\btitle\b/i.test(add)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: addSession (15ª fatia) regrediu (tenant_id/title).');
    const ci = sliceMethod(code, 'async checkIn(');
    if (!/INSERT\s+INTO\s+event_attendees\s*\([^)]*\btenant_id\b/i.test(ci)) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: checkIn (15ª fatia) regrediu (tenant_id).');
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('ASSIGNSTAFF_SESSIONREAD_DRIFT_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[events-assignstaff-sessionread-schema-drift] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [events-assignstaff-sessionread-schema-drift]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [events-assignstaff-sessionread-schema-drift] — assignStaff(tenant_id/responsible_actor_id/responsible_actor_type, actor resolvido) e reader getEventWithDetails(title/starts_at/ends_at) alinhados ao schema vivo; gate preservado; canRepresentActor puro.');
