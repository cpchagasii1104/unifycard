#!/usr/bin/env node
// audit-event-feed-exact-permission.mjs — DECISION-0189A (YALA CLOSEOUT, Etapa B) GUARD
//
// Prova estruturalmente que feed e eventos decidem por CHAVE EXATA (D3/D4) e que a
// representação NÃO sombreia o gate fino (Findings A/B da YALA):
//   1. social-2.0 create-post: decisão = canActAs('publish_feed') sobre o AUTOR declarado;
//      SEM pre-gate canRepresentActor sobre validated.actor_id; SEM requirePermission no
//      actor do actionContext para o post.
//   2. event.routes: criações (POST / · /v2/create · /v2/draft) contêm gate create_events;
//      writers de evento existente contêm manage_events; administração de participantes
//      contém manage_attendees; nenhum writer decide SÓ por representação.
//   3. company.post (projeção) não participa de Authority.
//   4. create_events NÃO volta a mapear can_publish_feed (errata R10 preservada).

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (msg) => { console.error(`❌ [audit-event-feed-exact-permission] ${msg}`); process.exit(1); };
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── 1. social-2.0 create-post ──
const social = read('src/modules/social/social-2.0.routes.ts');
if (!/canActAs\(\s*\n?\s*req\.tenant\.id,\s*\n?\s*req\.user\.userId,\s*\n?\s*validated\.actor_id,\s*\n?\s*'publish_feed'/m.test(social.replace(/\r/g, ''))) {
  fail('create-post sem decisão canActAs(publish_feed) sobre o AUTOR declarado (Finding B)');
}
if (/canRepresentActor\(req\.tenant\.id, req\.user\.userId, validated\.actor_id\)/.test(social)) {
  fail('pre-gate canRepresentActor sobre o autor REINTRODUZIDO no create-post (sombra do grant fino — Finding B)');
}
if (/requirePermission\('publish_feed'\)/.test(social)) {
  fail("requirePermission('publish_feed') sobre actionContext reintroduzido no create-post (actor errado — Finding B)");
}

// ── 2. event.routes gates exatos ──
const ev = read('src/core/events/event.routes.ts');
const count = (re) => (ev.match(re) || []).length;
if (count(/userCanActOnActor\([^)]*'create_events'\)/g) < 3) {
  fail('menos de 3 gates create_events nas criações de evento (POST / · /v2/create · /v2/draft) — Finding A');
}
const manageEventsGates =
  count(/assertEventExactAuthority\([^)]*'manage_events'\)/g) +
  count(/assertRepresentsEventOwner\([^)]*'manage_events'\)/g) +
  count(/userCanActOnActor\([^)]*'manage_events'\)/g);
if (manageEventsGates < 12) {
  fail(`writers de evento existente com gate manage_events insuficientes (${manageEventsGates} < 12)`);
}
const attendeesGates =
  count(/assertEventExactAuthority\([^)]*'manage_attendees'\)/g) +
  count(/assertRepresentsEventOwner\([^)]*'manage_attendees'\)/g);
if (attendeesGates < 4) {
  fail(`administração de participantes com gate manage_attendees insuficiente (${attendeesGates} < 4)`);
}
// nenhum writer decide SÓ por representação: assertRepresentsEventOwner SEM chave só pode
// sobrar em leituras administrativas do organizador (2) e no caminho econômico selado (1).
const bareOwnerAsserts = count(/assertRepresentsEventOwner\((?:[^;](?!manage_))*?\);/gs) -
  count(/assertRepresentsEventOwner\([^;]*'manage_(events|attendees)'\);/gs);
const bareAllowed = 3; // 2 GETs de sugestões/needs (leitura do organizador) + payment/revoke (econômico selado)
if (bareOwnerAsserts > bareAllowed) {
  fail(`assertRepresentsEventOwner SEM chave exata em ${bareOwnerAsserts} sites (> ${bareAllowed} permitidos: leituras administrativas + econômico selado)`);
}

// ── 3. company.post fora de Authority ──
for (const f of ['src/core/authorization/authorization.service.ts', 'src/core/authorization/company-policy-registry.ts', 'src/core/events/event.routes.ts', 'src/modules/social/social-2.0.routes.ts']) {
  const src = read(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  if (/company\.post/.test(src)) {
    fail(`${f} usa company.post (projeção) em caminho de decisão`);
  }
}

// ── 3b. ETAPA D (R19 — DECISION-0189A §5) ──
{
  const registry = read('src/core/authorization/company-policy-registry.ts');
  for (const k of ['financial:view_all_ledger', 'marketplace_execute_payouts', 'marketplace_manage_splits']) {
    if (!new RegExp(`PORTA_HOLD_KEYS[\\s\\S]{0,400}'${k.replace(/[:]/g, '[:]')}'`).test(registry)) {
      fail(`${k} fora de PORTA_HOLD_KEYS (D7 — money-path sensível sem fail-closed estrutural)`);
    }
  }
  if (/marketplace_execute_payouts:\s*legacy\(\)|marketplace_manage_splits:\s*legacy\(\)/.test(registry)) {
    fail('payouts/splits voltaram a legacy_ownership_contained (D7 proíbe)');
  }
  const authz = read('src/core/authorization/authorization.service.ts');
  if (!/PORTA_HOLD_KEYS\.includes\(permissionKey\)/.test(authz)) {
    fail('canActAs sem curto-circuito PORTA_HOLD (deny estrutural sumiu)');
  }
  const biz = read('src/core/authorization/business-authorization.service.ts');
  if (!/PORTA_HOLD_KEYS/.test(biz)) {
    fail('caminho legado (businessAuthorization) sem deny estrutural PORTA_HOLD — voltou a depender de tabela fantasma');
  }
  const overview = read('src/modules/economy/economic-overview.routes.ts');
  if (!/authorizeActorFinancialRead/.test(overview) || !/hasActorFinancialReadAuthority/.test(overview)) {
    fail('economic-overview sem a fachada financeira terminal (D7.A)');
  }
  if (!/no-store/.test(overview) || !/recordFinancialAudit/.test(overview)) {
    fail('economic-overview sem no-store/audit antes do disclosure (R18)');
  }
  const inv = read('src/modules/invoicing/invoice.routes.ts');
  if (!/hasActorFinancialReadAuthority/.test(inv)) {
    fail('invoices sem a fachada financeira por PARTE (D7.B — canRepresentActor não autoriza)');
  }
  if (!/EXPLICIT_PARTY_FILTER_REQUIRED/.test(inv)) {
    fail('listagem de invoices sem escopo-antes-da-query (D7.B.7 — tenant-wide proibido)');
  }
  if (!/recordFinancialAudit/.test(inv)) {
    fail('invoices sem audit antes do disclosure (R18)');
  }
}

// ── 4. errata preservada ──
const pk = read('src/core/authorization/permission-keys.ts');
if (!/create_events:\s*'can_create_events'/.test(pk)) {
  fail('create_events voltou a depender de can_publish_feed (errata R10 revertida)');
}

console.log(`✅ audit-event-feed-exact-permission: gates exatos vivos (publish_feed no AUTOR sem sombra; create_events×3; manage_events×${manageEventsGates}; manage_attendees×${attendeesGates}; representação nunca decide writer).`);
