#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8O-ORGANIZERS-REMAINDER-EVENT-ORGANIZER-AUTHORITY (DECISION-0113 / Z2).
//
// As rotas de event-organizer (create/add-member/link-event) tinham o subject de autoridade vindo de
// actionContext.actorId (client-declared) passado como requesterGlobalUserId — spoofável. BIND: o subject é o
// utilizador AUTENTICADO (req.user) resolvido server-side para global_user_id via resolveRequesterGlobalUserId →
// resolveGlobalUserId(req.user.id). hasPermission (owner_global_user_id / member role) gateia. MORDE se: voltar
// actionContext.actorId como autoridade; sumir o helper/subject derivado de req.user; o billing schema-ghost
// (R8K) for reaberto (perder os 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED ou o webhook no-op); aparecer bank_*;
// ou linkEvent passar a tocar events.actor_id (event-settlement). Comment-stripped. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/events/organizers/organizers.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [organizers-actor-authority-bind]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) subject server-side: helper que resolve global_user_id a partir de req.user.
if (!/resolveRequesterGlobalUserId\s*=/.test(code) || !/resolveGlobalUserId\(\s*req\.user\??\.\s*id\b/.test(code)) {
  failures.push(`${REL}: subject deve ser derivado de req.user server-side (resolveRequesterGlobalUserId → resolveGlobalUserId(req.user.id, ...)).`);
}
// 2) as 3 escritas devem usar requesterGlobalUserId, NÃO actionContext.actorId.
for (const m of [/createOrganizer\([\s\S]{0,80}requesterGlobalUserId/, /addMember\([\s\S]{0,120}requesterGlobalUserId/, /linkEvent\([\s\S]{0,160}requesterGlobalUserId/]) {
  if (!m.test(code)) failures.push(`${REL}: write não recebe requesterGlobalUserId (subject server-side) — ${m}.`);
}
// 3) actionContext.actorId NÃO pode governar autoridade (comment-stripped já remove o comentário).
if (/actionContext\s*\.\s*actorId/.test(code)) {
  failures.push(`${REL}: voltou a referenciar actionContext.actorId — não pode ser autoridade de event-organizer.`);
}
// 4) o 401 nomeado do bind.
if (!/ORGANIZER_ACTOR_AUTHORITY_REQUIRED/.test(code)) {
  failures.push(`${REL}: perdeu o 401 nomeado ORGANIZER_ACTOR_AUTHORITY_REQUIRED.`);
}
// 5) billing schema-ghost (R8K) PRESERVADO: 5 rotas enviam o corpo ORGANIZER_BILLING_GHOST_BODY (501) + webhook no-op.
const billing501 = (code.match(/reply\.status\(\s*501\s*\)\.send\(\s*ORGANIZER_BILLING_GHOST_BODY\s*\)/g) || []).length;
if (billing501 < 5) failures.push(`${REL}: billing schema-ghost (R8K) enfraquecido — esperado >= 5 rotas 501 ORGANIZER_BILLING_GHOST_BODY, achadas ${billing501}.`);
if (!/contained:\s*'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED'/.test(code)) failures.push(`${REL}: webhook no-op contained (R8K) removido.`);
if (/organizerBillingService\s*\.|stripeService\s*\./.test(code)) failures.push(`${REL}: billing service reaberto (R8K reabertura proibida).`);
// 6) event-settlement intocado: linkEvent NÃO pode tocar events.actor_id aqui.
if (/events\.actor_id|event_settlements|markAsSettled/.test(code)) {
  failures.push(`${REL}: tocou events.actor_id/event-settlement — proibido (event-settlement canônico intocado).`);
}
// 7) zero bank_*.
if (/bank_ledger|bank_transactions|bank_splits/.test(code)) {
  failures.push(`${REL}: referencia bank_ledger/transactions/splits — proibido.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [organizers-actor-authority-bind]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [organizers-actor-authority-bind] — create/add-member/link-event: subject=req.user→global_user_id (resolveRequesterGlobalUserId); actionContext.actorId não é autoridade; 401 ORGANIZER_ACTOR_AUTHORITY_REQUIRED; billing schema-ghost (R8K) preservado (501 + webhook no-op); event-settlement intocado; zero bank_*. Event-organizer authority bound.');
