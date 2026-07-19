#!/usr/bin/env node
// Guard estrutural — F-0113-AUTHORITY-FACADE-BOUNDARY-SEAL + F-R2-GUARD-SAFE-SUBJECT-RECOGNITION.
//
// Sela a fronteira da DECISION-0113: actorId/objeto-de-ator DECLARADO pelo CLIENTE é
// HINT, nunca prova. Inclui formalmente o 6º CANAL revelado pelo P0 dispute reversal:
//   body.actor · body.actor.actorId · body.actor.kind · authoritySource vindo do body ·
//   actor.kind vindo do body.
// Qualquer rota que LÊ um canal de ator client-declared para AGIR deve provar o binding
// server-side por authority.service / canActAs / canRepresentActor (ou caller sistêmico real)
// — OU, para readers/admin-filters, provar que o SUBJECT da permissão vem de req.user
// server-side (FATIA A; ver SAFE_SUBJECT_READERS / safeSubjectProof abaixo).
//
// Hierarquia normativa vigente (documentada em DECISION-0113 + STATUS):
//   porta normativa  → authorizationService (authority.service)
//   resolvedor       → canActAs
//   representabilidade→ canRepresentActor
//   PJ membership SSOT→ company_users
//   RBAC V2          → NÃO soberano (FASE 6 / dormente-divergente)
//   CNAE             → evidência fiscal, não autorização
//
// MODELO: BASELINE EXPLÍCITO. Este guard NÃO corrige os fluxos — congela o estado
// conhecido (BASELINE) e FALHA em QUALQUER rota NOVA que use um canal client-declared
// SEM helper de binding no arquivo. Heurística file-level (não AST): um arquivo com
// canal + binding helper passa; falso-negativo possível por handler — por isso o guard
// é uma CERCA DE REGRESSÃO, não prova de correção total. Violações conhecidas têm DT
// vinculada (ver REMEDIATION_DT_LOG). Integrado em validate:regression-guards.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const SRC = join(process.cwd(), 'src');

// Canais de ator DECLARADO pelo cliente (hints; exigem binding server-side).
// B1f (F-0113-CANAL1-ACTIONCONTEXT-TRANSVERSAL-LOCK, 2026-06-15): incluído o canal-1 da DECISION-0113
// — `actionContext.actorId` (o x-action-context é client-declared). É o canal que faltava: o princípio
// transversal "cliente declara intenção, servidor decide autoridade" agora cobre TODOS os 5 canais.
const CLIENT_ACTOR_CHANNELS = [
  { key: 'body.actor-object',     re: /parseActor\(\s*req\.body|req\.body\??\.actor\??\.(kind|actorId|actor_id)|req\.body\??\.actor\b(?!_)/ },
  { key: 'body.actorId',          re: /req\.body\??\.(actorId|actor_id)\b/ },
  { key: 'authoritySource:system',re: /authoritySource:\s*['"]system['"]/ },
  { key: 'params.actorId',        re: /req\.params\??\.actorId\b/ },
  { key: 'query.actorId',         re: /req\.query\??\.actorId\b/ },
  { key: 'header.x-actor-id',     re: /['"]x-actor-id['"]/ },
  { key: 'metadata.serviceId',    re: /metadata\.serviceId\b/ },
  { key: 'actionContext.actorId', re: /actionContext\??\.\s*actorId\b/ },
];
// Canais que requirePermission([ NÃO vincula (declaram um ator DIFERENTE do que o canal-1 verifica).
// requirePermission resolve a capability do `actionContext.actorId` (canal-1) via canPerformAction→canActAs,
// ligando req.user→actor declarado. NÃO liga body/params/query/x-actor-id (ator distinto). Por isso o
// clearing por requirePermission só vale quando o ÚNICO canal do arquivo é o actionContext.actorId.
const STRICT_CHANNELS = new Set(['body.actor-object', 'body.actorId', 'authoritySource:system', 'params.actorId', 'query.actorId', 'header.x-actor-id', 'metadata.serviceId']);
const REQUIRE_PERMISSION_PREHANDLER = /\brequirePermission\(\s*\[/;

// Helpers de binding server-side (a presença NO ARQUIVO satisfaz a heurística file-level).
// DECISION-0189 (F3): authorizeActorFinancialRead/hasActorFinancialReadAuthority são a fachada
// TERMINAL de leitura financeira por actor (self OU company_users.can_view_financial, lock FOR
// SHARE) — binding server-side MAIS forte que canRepresentActor para reads financeiros.
const BINDING_HELPERS = /\bcanActAs\b|\bcanRepresentActor\b|\bcanPerformAction\b|\brequireRepresentable\b|\brequireRepresentableActor\b|\bauthorityActorOf\b|\brepresentsAvailabilityOwner\b|\bcanManageCompany\b|\bauthorizeActorFinancialRead\b|\bhasActorFinancialReadAuthority\b/;

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── FATIA A (F-R2-GUARD-SAFE-SUBJECT-RECOGNITION) ─────────────────────────────────────────
// PROVA DE SUBJECT SERVER-SIDE (DECISION-0113): o SUBJECT da autorização é derivado server-side
// de req.user, NUNCA de um canal de ator client-declared (params/query/body/actionContext).
// Duas formas reconhecidas:
//   Forma A — fastify.requirePermission([...]) preHandler: o rbac.plugin resolve o subject a
//             partir de req.user (ESTRUTURAL — o decorator nunca aceita subject client-declared).
//   Forma B — businessAuthorizationService.requirePermission(tenantId, <subj>, <target>, ...)
//             onde <subj> é uma const local ligada a req.user.userId/req.user.id E subj !== target.
//   Forma C — R2 company-scoped: companiesService.canUserPerformCompanyCapability(tenantId, <subj>, '<can_*>',
//             {companyId}) COM prova de company-scope (resolveCompanyIdForActor) no arquivo. <subj> = const
//             local ligada a req.user.userId/req.user.id. Autoridade = company_users.can_* (per-empresa,
//             fail-closed sem companyId). O actorId client-declared nunca é subject.
//   Forma D — R2 tenant-level: companiesService.canUserPerformTenantCapability(tenantId, <subj>, '<can_tenant_*>')
//             onde <subj> = const local ligada a req.user.userId/req.user.id. Autoridade = tenant_operator_grants
//             .can_* (TENANT-LEVEL, DECISION-0126; tenant-scoped por construção, sem actorId/company/company_users;
//             grant em tenant A não vale tenant B). NÃO é Bank/payout/trust (esses seguem baselineados).
// Retorna string de prova (truthy) ou null. Recebe código bruto OU já sem comentários — strip interno.
// É PROIBIDO reconhecer subject vindo de req.actionContext.actorId / req.params.* / req.query.* /
// req.body.* (não são server-side); e subject == target SEMPRE falha (ver SUBJECT_EQUALS_TARGET).
function safeSubjectProof(rawCode) {
  const code = stripComments(rawCode);
  // Forma A — preHandler decorator fastify.requirePermission(['key', ...]).
  if (/\brequirePermission\(\s*\[/.test(code)) {
    return 'A:fastify.requirePermission([...]) preHandler — subject=req.user via rbac.plugin (estrutural)';
  }
  // Forma B — subject = const local derivada DIRETAMENTE de req.user.userId/req.user.id.
  const serverSubjectVars = new Set();
  // Aceita `req.user.id`/`req.user?.id`/`req.user.userId` (com ou sem optional chaining) — todos server-side.
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*req\.user\??\.(?:userId|id)(?:\s*\?\?\s*req\.user\??\.(?:userId|id))?\s*;/g)) {
    serverSubjectVars.add(m[1]);
  }
  if (serverSubjectVars.size === 0) return null;
  // requirePermission E checkPermission (mesma família businessAuthorizationService(tenantId, userId, actorId, action)):
  // o 2º arg é o SUBJECT (userId server-side), o 3º é o actor/org ALVO. R8L incluiu checkPermission (read-sensitive).
  for (const m of code.matchAll(/\b(?:requirePermission|checkPermission)\(\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$.]*)\s*,/g)) {
    const subj = m[1].trim();
    const target = m[2].trim();
    if (serverSubjectVars.has(subj) && subj !== target) {
      return `B:requirePermission/checkPermission(tenantId, ${subj}=req.user, ${target}) — subject server-side, subj!=target`;
    }
  }
  // Forma C — canUserPerformCompanyCapability(tenantId, <subj=req.user var>, '<can_*>', { companyId })
  // COM prova de COMPANY-SCOPE server-side no arquivo (resolveCompanyIdForActor). O 2º arg é o SUBJECT
  // (req.user, não o alvo). O primitivo é fail-closed sem companyId (grant per-empresa, nunca tenant-wide,
  // DECISION-0125 §escopo) — reconhecer Forma C exige a prova de escopo company para não maquiar tenant-wide.
  const hasCompanyScopeProof = /\bresolveCompanyIdForActor\s*\(/.test(code);
  if (hasCompanyScopeProof) {
    for (const m of code.matchAll(/\bcanUserPerformCompanyCapability\(\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*,/g)) {
      const subj = m[1].trim();
      if (serverSubjectVars.has(subj)) {
        return `C:canUserPerformCompanyCapability(tenantId, ${subj}=req.user, can_*, {companyId}) + resolveCompanyIdForActor — subject server-side, company-scoped (fail-closed sem companyId)`;
      }
    }
  }
  // Forma D — canUserPerformTenantCapability(tenantId, <subj=req.user var>, '<can_tenant_*>'): autoridade
  // material em tenant_operator_grants.can_* (TENANT-LEVEL, DECISION-0126). Subject server-side; tenant-scoped
  // por construção (NÃO usa actorId/company/company_users). Grant em tenant A não vale tenant B.
  for (const m of code.matchAll(/\bcanUserPerformTenantCapability\(\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*,/g)) {
    const subj = m[1].trim();
    if (serverSubjectVars.has(subj)) {
      return `D:canUserPerformTenantCapability(tenantId, ${subj}=req.user, can_tenant_*) — subject server-side, autoridade=tenant_operator_grants.can_* (tenant-scoped)`;
    }
  }
  // Forma E — reader bank: actorCapabilitiesService.resolveForUser(tenantId, <targetActorId>, <subj=req.user var>).
  // O 3º arg é o SUBJECT (req.user server-side); o 2º é o actorId ALVO (filtro client-declared). Capability
  // checada server-side (caps.capabilities), sem writer move-money no caminho. Reconhece o reader GET /balance
  // de bank-http (F-BANK-HTTP-AUTHORITY-BINDING) sem maquiar: a prova some se o subject deixar de vir de req.user.
  for (const m of code.matchAll(/\bactorCapabilitiesService\.resolveForUser\(\s*[^,()]+,\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    const subj = m[1].trim();
    if (serverSubjectVars.has(subj)) {
      return `E:actorCapabilitiesService.resolveForUser(tenantId, targetActorId, ${subj}=req.user) — subject server-side, actorId=alvo (reader bank)`;
    }
  }
  return null;
}

// READERS/ADMIN-FILTERS AUDITADOS HUMANAMENTE em F-R2-GUARD-SAFE-SUBJECT-RECOGNITION (2026-06-13).
// Cada um é rota de LEITURA/filtro-admin cujo SUBJECT de autorização vem server-side (req.user); o
// actorId client-declared é apenas FILTRO/ALVO de leitura — sem writer/move-money e sem subject==target.
// O guard só remove o arquivo do escopo se a PROVA (safeSubjectProof) AINDA estiver presente em runtime:
// se alguém reverter o subject para client-declared, a prova some, o arquivo volta a flaggar e (não
// estando no BASELINE) FALHA. NÃO inclui payout/bank-http (move-money HARD STOP), policy-engine
// (mutations mixed — per-actor binding R2 DECISION_REQUIRED) nem trust (requireRole interino R2.4):
// esses PERMANECEM no BASELINE com justificativa material própria. Ver DECISION-0124 + DT-0113-CLASSIC.
// F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE (2026-06-14): escopo corrigido. As rotas tenant-wide são
// FAIL-CLOSED (company_scope_required); as rotas ACTOR-SCOPED resolvem actors.company_id e exigem o grant
// NAQUELA empresa (Forma C company-scoped). reporting saiu do allowlist: virou 100% fail-closed e teve o
// `actorId` morto removido ⇒ não casa mais canal client-declared (fora do escopo do guard). Os 3 abaixo
// mantêm canal (query/params.actorId como ALVO) + Forma C com prova de company-scope (resolveCompanyIdForActor).
const SAFE_SUBJECT_READERS = {
  // F-AUTHORITY-Z2-R8L (2026-06-19): GET /business-permissions/check (leitura sensível de permissão p/ UI).
  // BIND: subject = req.user.id (server-side, const subjectUserId); query.actorId = CONTEXTO org (alvo de leitura);
  // checkPermission(tenantId, subjectUserId, orgActorId, action) → getUserRole resolve só o papel REAL do caller
  // naquela org (revela o que é dele). Forma B (subject server-side, subj!=target). actionContext.actorId NÃO
  // governa mais a checagem. Guard dedicado: audit-business-authorization-read-authority.mjs. A prova some se o
  // subject voltar a ser client-declared → re-flagga (fora do BASELINE) → FALHA.
  'core/authorization/business-authorization.routes.ts':
    'READ-SENSITIVE. GET /business-permissions/check: subject=req.user.id (subjectUserId, Forma B checkPermission), query.actorId = contexto org (alvo), revela só o papel do próprio caller via getUserRole; actionContext.actorId não é mais autoridade. Zero write, zero bank_*.',
// F-R2-TENANT-LEVEL-OPERATOR-GRANTS (2026-06-14, DECISION-0126): as rotas tenant-wide deixaram de ser
// fail-closed e passaram a abrir por GRANT TENANT-LEVEL (tenant_operator_grants.can_*, Forma D) — NUNCA por
// company_users. As rotas actor-scoped seguem company-scoped (Forma C). reporting usa só Forma D e não tem
// canal client-declared (fora do escopo do guard).
  'modules/business-audit/business-audit.routes.ts':
    'MISTA. GET /business-audit-logs?actorId resolvível → company-scoped (Forma C, can_view_audit_logs); sem actor resolvível ou GET /:logId → tenant-level (Forma D, can_view_tenant_audit_logs). query.actorId = alvo (repo FILTRA por actor_id), nunca subject. Zero write.',
  'modules/risk-command-center/risk-dashboard.routes.ts':
    'MISTA. GET /actors/:actorId[/timeline] → company-scoped (Forma C, can_view_risk). /overview e /actors (lista) → tenant-level (Forma D, can_view_tenant_risk). params.actorId = alvo. Spoof subject==target CLOSED. Sem write.',
  'modules/policy-engine/policy.routes.ts':
    'MISTA. GET /policies/evaluate/:actorId e /policy-decisions/actor/:actorId/active → company-scoped (Forma C, can_manage_policy). Listar/criar/ativar/decisões/apply/revoke → tenant-level (Forma D, can_manage_tenant_policy; estado de política interno, sem efeito financeiro). params/query.actorId = alvo, nunca subject.',
  'modules/trust/trust.routes.ts':
    'TENANT-LEVEL (R2.4 UNFREEZE, DECISION-0127). Compliance/risco tenant-scoped. Reads (GET /trust/profile/:actorId, /profiles, /events, POST /can-proceed) → Forma D can_view_tenant_trust; mutations (POST /trust/events, /recalculate/:actorId) → Forma D can_manage_tenant_trust. requireRole(admin) REMOVIDO. params/query.actorId = alvo, nunca subject. Sem dinheiro (dispute_* = tipos de evento de score).',
  'core/unifybank/bank-http.routes.ts':
    'READER + REQUEST-ONLY (F-BANK-HTTP-AUTHORITY-BINDING, DECISION-0128). GET /balance: subject server-side (userId=req.user.id) + actorCapabilitiesService.resolveForUser (Forma E); query.actorId = ALVO de leitura, nunca subject; sem write/move-money (getUserBalance/getActorBalance = leitura). POST /transactions/simple|split: NÃO executam mais Bank — REQUEST-ONLY (createFinancialApprovalRequest no Core; sem bank_transaction/bank_ledger/split). Os writers usam só req.user.id (sem canal client-declared). Guard cercado por audit-bank-http-authority-binding.mjs.',
  'modules/payout/payout.routes.ts':
    'READER + FAIL-CLOSED (F-ACTOR-WALLET-PAYOUT-WIRING, DECISION-0128). GET /payouts/orders[?actorId]/batches: gateados por requirePayoutPermission → businessAuthorizationService.requirePermission(tenantId, userId=req.user.id, actor.actor_id, financial:execute_payout) = Forma B (subject server-side, subj!=target); query.actorId = FILTRO de leitura do operador, nunca subject. POST /payouts/batches, /orders/:id/execute-manual, /orders/:id/fail: FAIL-CLOSED (403 PAYOUT_HTTP_EXECUTION_DISABLED) — NÃO executam payout, NÃO chamam payoutService executor, NÃO movem dinheiro/settlement. Guard cercado por audit-payout-authority-binding.mjs.',
};

// ── F-AUTHORITY-Z2-R8B-PROFILE-C1-BASELINE-RECONCILIATION (2026-06-18) ───────────────────────
// Os 4 trilhos profile-c1 (interest/learning/professional/lifestyle) são WRITERS actor-keyed cujo SUBJECT é
// server-side (`req.user.userId` via requireContext) e cujo BINDING (`canRepresentActor`) vive no SERVICE
// (resolveActorGuarded), chamado ANTES de todo sink. O detector é file-level: a ROTA casa o canal
// actionContext.actorId, mas o binding está no SERVICE. Reconhecidos aqui com PROVA cross-file verificada em
// runtime (rota deriva subject de req.user E o service tem canRepresentActor). Se a prova sumir (rota deixa de
// threadar req.user OU service perde canRepresentActor) o arquivo volta a flaggar e, FORA do BASELINE, FALHA.
// Guard dedicado material: audit-profile-c1-actor-binding.mjs. NÃO mascara: prova viva, não allowlist cega.
const SERVICE_BOUND_WRITERS = {
  'core/profile/interest-c1/interest-c1.routes.ts': 'core/profile/interest-c1/interest-c1.service.ts',
  'core/profile/learning-c1/learning-c1.routes.ts': 'core/profile/learning-c1/learning-c1.service.ts',
  'core/profile/professional-c1/professional-c1.routes.ts': 'core/profile/professional-c1/professional-c1.service.ts',
  'core/profile/lifestyle/lifestyle.routes.ts': 'core/profile/lifestyle/lifestyle.service.ts',
};

// Prova cross-file: a ROTA deriva o subject de req.user (server-side) E o SERVICE correspondente prova
// canRepresentActor (resolveActorGuarded). Retorna string de prova (truthy) ou null. Recebe código bruto da rota.
function serviceBoundProof(rel, rawRouteCode) {
  const svcRel = SERVICE_BOUND_WRITERS[rel];
  if (!svcRel) return null;
  const routeCode = stripComments(rawRouteCode);
  // Subject server-side: a rota deriva userId de req.user (requireContext) — nunca de canal client-declared.
  if (!/req\.user\??\.userId/.test(routeCode)) return null;
  let svcCode;
  try { svcCode = stripComments(readFileSync(join(SRC, svcRel), 'utf-8')); } catch { return null; }
  // Binding no service: canRepresentActor(tenantId, userId, actorId) (resolveActorGuarded).
  if (!/canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*actorId\s*\)/.test(svcCode)) return null;
  return `service-bound writer: rota subject=req.user.userId (actionContext.actorId=alvo) + ${svcRel} canRepresentActor(tenantId,userId,actorId) em resolveActorGuarded ANTES do sink`;
}

// ── F-AUTHORITY-Z2-R8F (plan) — SELF-BOUND WRITERS (2026-06-19) ───────────────────────────────
// Rotas cujo WRITE é per-user do PRÓPRIO caller (self-only): o SUBJECT deriva de `req.user.userId`
// (findByUserId), o actionContext.actorId declarado é NEUTRALIZADO, e há 403 de privilégio ANTES do sink.
// É o análogo "self" do SERVICE_BOUND_WRITERS: reconhecidas com PROVA verificada em runtime (subject de
// req.user). Se a prova sumir (subject volta a vir do actionContext), o arquivo re-flagga e, FORA do baseline,
// FALHA. Rigor de ordering/sink vive no guard dedicado audit-plan-self-bound.mjs.
const SELF_BOUND_WRITERS = {
  'core/plan/plan.routes.ts': 'PUT /plan self-only (DECISION-0113 fatia 5.1): subject=req.user.userId via findByUserId→callerActor.actor_id; 403 de privilégio ANTES do UPDATE users; sink mira userRow.user_id do caller. actionContext.actorId neutralizado. Guard: audit-plan-self-bound.mjs.',
};

// Prova: a rota deriva o subject de req.user.userId (findByUserId) — server-side, não client-declared.
function selfBoundProof(rel, rawCode) {
  if (!(rel in SELF_BOUND_WRITERS)) return null;
  const code = stripComments(rawCode);
  if (!/findByUserId\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*\)/.test(code)) return null;
  return `self-bound writer: subject=req.user.userId (findByUserId); actionContext.actorId neutralizado — ${SELF_BOUND_WRITERS[rel]}`;
}

// ── F-AUTHORITY-Z2-R8G — NON-AUTHORITY READ-ONLY (2026-06-19) ─────────────────────────────────
// Rotas read-only onde o actionContext.actorId é PURE PRESENCE-GATE (400-if-missing), nunca threadado a service
// e sem write sink — NÃO governa nada material (H_FALSE_POSITIVE). Reconhecidas com PROVA verificada em runtime
// (sem write + actorId só em presence-gate `!`). Se a prova sumir (write aparece OU actorId vira valor/arg), o
// arquivo re-flagga e, FORA do baseline, FALHA. Guard dedicado: audit-feed-plugin-not-authority.mjs.
const NON_AUTHORITY_READONLY = {
  'core/feed/feed-plugin.routes.ts': 'orquestrador visual read-only (BLINDAGEM): actionContext.actorId só presence-gate (400-if-missing), nunca threadado a feedPluginService, sem write/DB. Guard: audit-feed-plugin-not-authority.mjs.',
  'modules/services/services-discovery.routes.ts': 'F-SERVICE-DISCOVERY-REQUEST-TRACK-RETIREMENT (DECISION-0156 D5+D6, 2026-07-02): as 8 rotas do trilho paralelo (offers/metrics/search/my-requests/provider-requests/request/respond/request/:id/request) foram APOSENTADAS INCONDICIONALMENTE — nenhuma delas mais referencia actionContext.actorId (handlers recebem _req, não lido). A ÚNICA ocorrência restante no arquivo é a rota viva /search-by-term, presence-gate (400-if-missing), nunca threadada a service com escrita (searchByTerm é read-only, chama discoverServices via outro arquivo). Guard dedicado: audit-services-discovery-actor-bind.mjs (morde se as 8 rotas deixarem de estar retiradas, ou se /search-by-term ganhar write/authority).',
};

// Prova: sem write sink + toda ocorrência de actionContext.actorId está em presence-gate (`!`).
function notAuthorityReadonlyProof(rel, rawCode) {
  if (!(rel in NON_AUTHORITY_READONLY)) return null;
  const code = stripComments(rawCode);
  if (/\bINSERT\b|\bUPDATE\b|\bDELETE\b|runQueryWithTenant|runQueriesWithTenant|pool\.query|\.create\(|\.update\(|\.delete\(|\.insert\(/i.test(code)) return null;
  for (const line of code.split('\n')) {
    if (/actionContext\s*\.\s*actorId/.test(line) && !/!\s*req\.actionContext|!\s*actionContext/.test(line)) return null;
  }
  return `not-authority read-only: sem write/DB; actionContext.actorId só presence-gate — ${NON_AUTHORITY_READONLY[rel]}`;
}

// ── BASELINE EXPLÍCITO (estado conhecido; cada item tem DT vinculada) ──
// Arquivo (rel a src/) → canais usados sem binding no arquivo + nota/DT. NOVOS arquivos
// fora desta lista (e fora de SAFE_SUBJECT_READERS) que casem um canal sem binding = FALHA.
// B1f (2026-06-15): nota compartilhada do canal-1 congelado. Debt PRÉ-EXISTENTE (esses arquivos já liam
// actionContext.actorId sem binding ANTES do B1f; o canal-1 só não era detectado). Congelado, NÃO corrigido.
const C1 = 'canal-1 actionContext.actorId (DECISION-0113) lido p/ agir/filtrar SEM binding server-side; debt PRÉ-EXISTENTE congelado por B1f. Convergência = vincular (requirePermission/canRepresentActor) por subsistema, frente própria. Ver DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.';
const C1_MONEY = 'canal-1 actionContext.actorId SEM binding em superfície MONEY-ADJACENT (settlement/payment-request/accounts) — debt PRÉ-EXISTENTE congelado por B1f; PRIORIDADE de convergência. Ver DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.';
// R7a EVENT-RFQ ACTING-USER-GATE (2026-06-18): as escritas W1-W5 (createRFQ/closeRFQ/createQuote/from-spec/
// dispatch) foram VINCULADAS server-side (canRepresentActor / assertCanReadEventMoney, fail-closed 403
// EVENT_RFQ_ACTOR_NOT_REPRESENTABLE) — guard próprio audit-event-rfq-actor-binding.mjs. O arquivo PERMANECE
// no baseline porque W6 acceptQuote (POST .../quotes/:quoteId/accept) segue UNBOUND e é MONEY-ADJACENT
// (cria availability+booking+service_booking_decision+service_payment_request PENDING) → frente própria R7b.
// O baseline é file-level e não isola W6; remover mascararia W6 como resolvido (proibido).
const C1_RFQ_W6 = 'canal-1 actionContext.actorId — W1-W5 VINCULADAS por R7a (guard audit-event-rfq-actor-binding); RESTA W6 acceptQuote UNBOUND + MONEY-ADJACENT (R7b, decisão pendente). Mantido no baseline para NÃO mascarar W6. Ver DT-AUTHORITY-Z2-EVENT-RFQ-ACTOR-BINDING-UNBOUND + DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.';
const BASELINE = {
  // ── B1f canal-1 (actionContext.actorId) — 31 rotas com debt 0113 PRÉ-EXISTENTE, congeladas ──
  // (NÃO corrigidas; o B1f só TORNOU VISÍVEL + travou regressão. Cada subsistema converge em frente própria.)
  // business-authorization.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8L, 2026-06-19): GET
  // /business-permissions/check BOUND — subject = req.user.id (server-side); query.actorId = contexto org (alvo);
  // checkPermission revela só o papel do próprio caller (getUserRole). actionContext.actorId não governa mais.
  // Reconhecido por safeSubjectProof Forma B (checkPermission) + entrada em SAFE_SUBJECT_READERS; guard dedicado
  // audit-business-authorization-read-authority.mjs (morde se subject voltar a client-declared / sumir o 401 /
  // tocar bank_*). Se a prova sumir, re-flagga. DT-AUTHORITY-Z2-BUSINESS-AUTHORIZATION-READ-SENSITIVE.
  // core/feed/feed-plugin.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8G-NON-MONEY-READ-NOT-AUTHORITY-WAVE,
  // 2026-06-19): orquestrador VISUAL read-only — actionContext.actorId é PURE PRESENCE-GATE (400-if-missing), nunca
  // threadado a feedPluginService, sem write/DB → H_FALSE_POSITIVE (não governa nada material). Reconhecido por
  // NON_AUTHORITY_READONLY (prova runtime: sem write + actorId só presence-gate) + guard dedicado
  // audit-feed-plugin-not-authority.mjs. Se a prova sumir (write/arg), re-flagga e FALHA.
  // DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // core/intent/intent-execute.routes.ts REMOVIDO do baseline (F-AUTHORITY-Z2-R5-INTENT-EXECUTE-BUYER-ACTOR-BINDING):
  // POST /intent/execute passou a exigir representabilidade server-side do buyer actor via
  // canRepresentActor(tenantId, req.user.userId, buyerActorId) fail-closed (403 BUYER_ACTOR_NOT_REPRESENTABLE)
  // ANTES de criar order/itens/reserva/saga. O actionContext.actorId vira HINT vinculado. Guard próprio:
  // audit-intent-execute-buyer-actor-binding.mjs. DT-AUTHORITY-Z2-INTENT-EXECUTE-BUYER-ACTOR-UNBOUND.
  // core/plan/plan.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8F-NON-MONEY-REMAINING-CANAL1-WAVE,
  // 2026-06-19): PUT /plan é self-only (DECISION-0113 fatia 5.1) — subject=req.user.userId (findByUserId→
  // callerActor.actor_id), actionContext.actorId NEUTRALIZADO, 403 de privilégio ANTES do UPDATE users (mira
  // userRow.user_id do caller). NÃO é money (users.plan = feature-flag). Reconhecido por SELF_BOUND_WRITERS
  // (prova subject=req.user em runtime) + guard dedicado audit-plan-self-bound.mjs. Se a prova sumir, re-flagga
  // e FALHA. DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // core/profile/{interest-c1,learning-c1,professional-c1,lifestyle}.routes.ts REMOVIDOS do baseline canal-1
  // (F-AUTHORITY-Z2-R8B-PROFILE-C1-BASELINE-RECONCILIATION, 2026-06-18): os 4 trilhos profile-c1 são WRITERS
  // actor-keyed com SUBJECT server-side (req.user.userId via requireContext) e BINDING no SERVICE
  // (resolveActorGuarded → canRepresentActor(tenantId, userId, actorId), fail-closed 403, ANTES de todo sink).
  // Reconhecidos por SERVICE_BOUND_WRITERS (prova cross-file verificada em runtime); guard dedicado material:
  // audit-profile-c1-actor-binding.mjs (+ human-journey §7 cobre lifestyle). Se a prova sumir, voltam a flaggar
  // e FALHAM (fora do baseline). DT-AUTHORITY-Z2-PROFILE-C1-BASELINE-RECONCILIATION.
  // automation.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8N, 2026-06-19): SCHEMA-GHOST — tabelas
  // alerts/scheduled_actions ausentes (to_regclass=null). As 9 rotas de dados foram CONTIDAS (501
  // AUTOMATION_SCHEMA_GHOST_CONTAINED) antes de qualquer service/sink → o canal-1 (actionContext.actorId em
  // POST/PATCH alerts + POST/cancel schedule) sumiu do arquivo. run-due preserva 403 AUTOMATION_RUN_DUE_HTTP_DISABLED
  // (guard R18). Guard dedicado: audit-automation-human-mvp-ghost-containment.mjs. scheduledActionService intocado
  // (dead; sem worker vivo). Se a contenção sumir, o guard falha E o arquivo re-flagga. DT-AUTHORITY-Z2-AUTOMATION-SCHEMA-GHOST.
  // organizers/organizers.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8O, 2026-06-19): event-organizer
  // authority BOUND — create/add-member/link-event derivam o subject de req.user server-side (resolveRequesterGlobalUserId
  // → resolveGlobalUserId(req.user.id) → requesterGlobalUserId); hasPermission (owner_global_user_id / member role)
  // gateia; actionContext.actorId não é mais autoridade. Billing schema-ghost (R8K) preservado (5×501 + webhook no-op);
  // event-settlement intocado (linkEvent só seta events.organizer_id, não events.actor_id). Guard dedicado:
  // audit-organizers-actor-authority-bind.mjs (morde se actionContext voltar / subject deixar de ser req.user /
  // billing reabrir / tocar events.actor_id / bank_*). Se a proteção sumir, re-flagga. DT-AUTHORITY-Z2-ORGANIZER-EVENT-AUTHORITY.
  // event-rfq.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8I-MONEY-STALE-RECONCILE-WAVE, 2026-06-19):
  // STALE — W1-W5 BOUND (R7a, canRepresentActor/assertCanReadEventMoney) e W6 acceptQuote CONTIDO (R7b, hard-stop
  // 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED antes de availability/booking/decision/payment_request). Guards dedicados
  // wired+GREEN: audit-event-rfq-actor-binding.mjs + audit-event-rfq-acceptquote-containment.mjs (+ negative-proofs
  // que mordem se W6 reativar / W1-W5 perderem binding). Sem bank_* no arquivo. Reconcile de baseline (não-money-
  // movement); se a proteção sumir, o guard dedicado falha E o arquivo re-flagga. DECISION (redesign acceptQuote)
  // segue OPEN. DT-AUTHORITY-Z2-EVENT-RFQ-* + DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // organizers.routes.ts: billing/subscription CONTIDO em R8K (5×501 + webhook no-op) e event-organizer authority
  // (create/add-member/link-event) BOUND em R8O (subject=req.user→global_user_id) → arquivo FORA do baseline (ver
  // bloco R8O acima). _(Histórico: PERMANECEU PARTIAL após R8K até o bind R8O.)_
  // human-mvp.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8N, 2026-06-19): SCHEMA-GHOST — todas as
  // tabelas human_mvp_*/skills/service_offers/opportunities ausentes (to_regclass=null); NÃO é a vertical G10 viva
  // (sem frontend caller; protótipo registrado sob /n). As 5 rotas POST foram CONTIDAS (501
  // HUMAN_MVP_SCHEMA_GHOST_CONTAINED) antes de qualquer service/sink → o canal-1 (actionContext.actorId em
  // POST /skills) sumiu do arquivo. Guard dedicado: audit-automation-human-mvp-ghost-containment.mjs. Services
  // intocados (dead). Reabrir como produto vivo exige schema + decisão G10 + binding. Se a contenção sumir, o guard
  // falha E o arquivo re-flagga. DT-AUTHORITY-Z2-HUMAN-MVP-SCHEMA-GHOST.
  // accounts-payable.routes.ts + accounts-receivable.routes.ts REMOVIDOS do baseline canal-1
  // (F-AUTHORITY-Z2-R8H-AP-AR-REACTIVATION-TRAP-CONTAINMENT, 2026-06-19): AP/AR migrados para o Bank (service =
  // Proxy reject-all; tabelas accounts_payable/accounts_receivable schema-ghost, to_regclass=null). As rotas
  // públicas foram CONTIDAS fail-closed (403 ACCOUNTS_PAYABLE_DISABLED / ACCOUNTS_RECEIVABLE_DISABLED) ANTES de
  // ler actionContext.actorId/query.actorId ou chamar o service → o canal-1 DESAPARECEU dos arquivos. Guard
  // anti-reactivation: audit-ap-ar-reactivation-trap.mjs (rotas contidas + services mantêm o Proxy reject-all =
  // repo não reativável sem frente própria). NÃO toca Bank/ledger (não-mascaramento; DECISION-0114 D5 segue OPEN).
  // DT-AUTHORITY-Z2-AP-AR-REACTIVATION-TRAP + DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // business-segment.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE,
  // 2026-06-18): a tabela `business_segments` é SCHEMA-GHOST (CREATE TABLE só em migrations_archive/0048; ausente
  // do schema canônico e de unificard_dev — to_regclass=null) e zero caller. As 3 rotas (POST/GET/PATCH) foram
  // CONTIDAS fail-closed (501 BUSINESS_SEGMENT_SCHEMA_GHOST_CONTAINED) ANTES de qualquer service/DB — o canal-1
  // (actionContext.actorId) DESAPARECEU do arquivo. Guard: audit-canal1-ghost-wave-r8e-containment.mjs.
  // contact.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8F-NON-MONEY-REMAINING-CANAL1-WAVE,
  // 2026-06-19): a tabela `contacts` é SCHEMA-GHOST (CREATE TABLE só em migrations_archive/0065; ausente do
  // schema canônico e de unificard_dev). Write já contido no SERVICE (assertContactsFeatureAvailable 501); R8F
  // elevou a contenção à BORDA — as 6 rotas retornam 501 CONTACTS_SCHEMA_GHOST_CONTAINED ANTES de ler
  // actionContext.actorId/chamar contactService → o canal-1 DESAPARECEU do arquivo. Guard: audit-contacts-
  // schema-ghost-containment.mjs (seção route-level). DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // purchase-order.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8I-MONEY-STALE-RECONCILE-WAVE,
  // 2026-06-19): STALE — writes vivos exigem representar o owner empresarial (canRepresentActor; created_by_actor_id/
  // supplier_id/tenant_id NÃO autorizam) e /receive está CONTIDO (hard-stop 403; receivePOContainedImpl preservado
  // mas inalcançável). Guards dedicados wired+GREEN: audit-po-owner-authority.mjs + audit-po-receive-containment.mjs
  // (+ negative-proofs que mordem se /receive reativar / writes perderem owner). Sem bank_* no arquivo; não toca
  // ledger. Reconcile de baseline; se a proteção sumir, o guard dedicado falha E o arquivo re-flagga.
  // DT-AUTHORITY-Z2-PURCHASE-ORDER-* + DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // settlement.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT):
  // as 3 rotas money-latent de mutação (settle/credit/debit) foram REDUZIDAS a 403 fail-closed e não
  // leem mais actionContext.actorId — o canal-1 desapareceu do arquivo. Guard próprio:
  // audit-marketplace-money-latent-containment.mjs. DT-AUTHORITY-Z2-MARKETPLACE-MONEY-LATENT-ACTORID-UNBOUND.
  // store-onboarding.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8K, 2026-06-19): catálogo non-money
  // BOUND — o write de product_offers (merchant_id) agora exige canRepresentActor(tenantId, req.user, storeActorId)
  // fail-closed 403 STORE_ONBOARDING_ACTOR_AUTHORITY_REQUIRED ANTES da escrita; data.actorId (body) é só HINT
  // validado. requirePermission (papel) preservado; category guard DECISION-0108 preservado; price_cents BIGINT;
  // zero bank_*. Guard dedicado: audit-store-onboarding-actor-bind.mjs (morde se canRepresentActor/subject=req.user/
  // fail-closed sumir). Se a proteção sumir, o guard falha E o arquivo re-flagga. DT-AUTHORITY-Z2-STORE-ONBOARDING-
  // CATALOG-ACTOR-UNBOUND + DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // tax-profile.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE,
  // 2026-06-18): a tabela `tax_profiles` é SCHEMA-GHOST (CREATE TABLE só em migrations_archive/0072; ausente do
  // schema canônico e de unificard_dev — to_regclass=null) e zero caller; tax-profile é metadado fiscal, NÃO
  // money-movement. As 3 rotas (POST/GET/PATCH) foram CONTIDAS fail-closed (501 TAX_PROFILE_SCHEMA_GHOST_CONTAINED)
  // ANTES de qualquer service/DB — o canal-1 (actionContext.actorId) DESAPARECEU do arquivo. Guard:
  // audit-canal1-ghost-wave-r8e-containment.mjs.
  // supplier.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE, 2026-06-18):
  // entrada STALE — o arquivo já carrega o binding helper (canRepresentActor) e os writes de supplier estão
  // vinculados ao owner via guard dedicado audit-supplier-owner-authority.mjs (em validate:regression-guards).
  // O detector file-level já o eximia (stale_baseline). Removido como higiene honesta — se o binding sumir, o
  // guard dedicado falha. DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // unifycard-method.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8Q, 2026-06-19): ÚLTIMA entrada do
  // baseline → baseline canal-1 ZERA. MONEY-DEFERRED + SCHEMA-GHOST: tabela unifycard_payment_methods + enum
  // unifycard_method_type só em migrations_archive/0142 (to_regclass/to_regtype=NULL no schema vivo) + defeito de
  // unidade de fee não decidido (bps §4.8). As 3 rotas foram CONTIDAS (501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED)
  // antes de qualquer service/sink → o canal-1 (actionContext.actorId no POST) sumiu do arquivo. Guard dedicado:
  // audit-unifycard-method-money-containment.mjs. Service/resolveFee/payment-execution/settlement INTOCADOS (dormant).
  // NÃO corrige fee, NÃO migra bps (DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION OPEN). Se a contenção sumir, o guard
  // falha E o arquivo re-flagga. DT-AUTHORITY-Z2-UNIFYCARD-METHOD-M5-MONEY-CONTAINMENT.
  // unifycard.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT):
  // as 3 rotas money-latent (authorize/capture/settle) foram REDUZIDAS a 403 fail-closed e não leem
  // mais actionContext.actorId. Guard próprio: audit-marketplace-money-latent-containment.mjs.
  // DT-AUTHORITY-Z2-MARKETPLACE-MONEY-LATENT-ACTORID-UNBOUND.
  // service-bundle.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE,
  // 2026-06-18): entrada STALE — o arquivo já carrega o binding helper (canRepresentActor) e a autoria dos writes
  // de bundle está vinculada ao actor representável via guard dedicado audit-service-bundle-write-authorship-
  // binding.mjs (em validate:regression-guards). Detector já o eximia (stale_baseline). Higiene honesta — se o
  // binding sumir, o guard dedicado falha. DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // service-payment-request.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8I-MONEY-STALE-RECONCILE-WAVE,
  // 2026-06-19): STALE — Opção A selada: receiver derivado server-side (service.actor_id), payer/receiver
  // server-side, body ignorado p/ autoridade, canRepresentActor(receiver) antes do sink, amount_cents BIGINT,
  // idempotência ON CONFLICT(booking_id), firewall SERVICE_FINANCIAL_RUNTIME_ENABLED nos callers vivos. Guards
  // dedicados wired+GREEN: audit-spr-read-authority.mjs + audit-service-payment-amount-cents.mjs (+ negative-proof
  // que morde se body governar payer/receiver / perder canRepresentActor). Sem bank_* no arquivo; não toca ledger.
  // Reconcile de baseline; se a proteção sumir, o guard dedicado falha E o arquivo re-flagga.
  // DT-SERVICE-PAYMENT-REQUEST-* + DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // services-discovery.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8P, 2026-06-19): rotas não-money
  // BOUND — /offers, /request, /request/respond, /my-requests, /provider-requests, /request/:requestId exigem
  // assertActorRepresentable → canRepresentActor(req.tenant.id, req.user.id, actionContext.actorId) fail-closed
  // 403 SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED ANTES de qualquer write/leitura actor-scoped. /request/pay segue
  // RETIRED (R8J, 403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110 + firewall); /metrics e /search usam
  // actionContext só como presence-gate (tenant-wide/category, não authority). Guard dedicado:
  // audit-services-discovery-actor-bind.mjs (morde se algum dos 6 binds regredir / direct-pay reabrir / bank_*).
  // Sem bank_* no arquivo; não toca payAcceptedRequest/settlement. DT-AUTHORITY-Z2-SERVICES-DISCOVERY-NON-MONEY-AUTHORITY.
  // services.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R6.1-SERVICES-ACTOR-BINDING):
  // POST /services e PUT /services/:id passaram a exigir representação server-side do actor dono via
  // canRepresentActor(req.tenant.id, req.user.userId, ownerActorId) fail-closed (403
  // SERVICE_ACTOR_NOT_REPRESENTABLE) ANTES do write; o check fraco (actor.user_id !== userId &&
  // actor_type !== 'user') foi substituído pelo primitivo canônico. Guard próprio:
  // audit-services-actor-binding.mjs. DT-AUTHORITY-Z2-SERVICES-ACTOR-BINDING-UNBOUND.
  // social-marketplace-ref.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8D-SOCIAL-MARKETPLACE-REF-
  // BIND-OR-CONTAIN, 2026-06-18): a tabela `social_marketplace_refs` é SCHEMA-GHOST (CREATE TABLE só em
  // migrations_archive/0759; ausente do schema canônico e de unificard_dev — to_regclass=null). As 3 rotas
  // (POST /marketplace-ref · GET /:postId · GET /details/:refId) foram CONTIDAS fail-closed (501
  // SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED) ANTES de qualquer service/DB — o canal-1 (actionContext.actorId,
  // que era breadcrumb de auditoria; o write nunca recebia o actor) DESAPARECEU do arquivo. Guard próprio:
  // audit-social-marketplace-ref-schema-ghost-containment.mjs. DT-AUTHORITY-Z2-SOCIAL-MARKETPLACE-REF.
  // social.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE, 2026-06-18):
  // entrada STALE — pós R8A a rota legada POST /social/posts/create está CONTIDA (501) e o canal-1 só sobrevive em
  // COMENTÁRIO (comment-stripped: sem actionContext.actorId, sem binding helper → não casa canal). Guard dedicado:
  // audit-social-legacy-post-create-containment.mjs. Higiene honesta — se a contenção regredir, o guard falha.
  // DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // system-notification.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8C-SYSTEM-NOTIFICATION-READ-STATE-
  // AUTHORITY, 2026-06-18): a tabela `system_notifications` é SCHEMA-GHOST (migration 257 arquivada em
  // migrations_archive/0921; ausente do schema canônico e de unificard_dev — to_regclass=null). Todas as rotas
  // (list/unread-count/:id/read/mark-all-read) foram CONTIDAS fail-closed (501 SYSTEM_NOTIFICATION_SCHEMA_GHOST_
  // CONTAINED) ANTES de qualquer service/DB — o canal-1 (actionContext.actorId/recipientActorId) DESAPARECEU do
  // arquivo. Guard próprio: audit-system-notification-schema-ghost-containment.mjs.
  // DT-AUTHORITY-Z2-SYSTEM-NOTIFICATION-READ-STATE.
  // votes.routes.ts REMOVIDO do baseline canal-1 (F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE, 2026-06-18):
  // entrada STALE — os 4 writes de votes estão CONTIDOS fail-closed (501 VOTES_WRITES_CONTAINED) e o arquivo NÃO
  // referencia mais actionContext.actorId (comment-stripped: zero canal). Guard dedicado:
  // audit-votes-writes-containment.mjs. Higiene honesta — se a contenção regredir, o guard falha.
  // DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE.
  // 6º CANAL (body.actor) — alvo normativo:
  // reconciliation-dispute.routes.ts REMOVIDO do baseline (2026-06-13): /reversal contido
  // (403 DISPUTE_REVERSAL_HTTP_DISABLED) + irmãs from-discrepancy/to-review/resolve contidas
  // (403 DISPUTE_MUTATION_HTTP_DISABLED) — parseActor/req.body.actor eliminados; guard não mais
  // detecta canal. DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY → P1 CONTAINED.
  // core/events/event.routes.ts REMOVIDO do baseline (2026-06-13, F-0113-EVENT-ACTOR-BODY-BINDING):
  // todos os handlers que liam actor do body passaram a exigir representabilidade server-side via
  // canRepresentActor (req.user.userId → actor), fail-closed. DT-0113-EVENT-ACTOR-BODY-BINDING → CLOSED.
  // F-0113-CLASSIC-CHANNEL-READERS-BINDING (2026-06-13): public-profiles + marketplace-categories REMOVIDOS
  // (binding canRepresentActor). F-R2-GUARD-SAFE-SUBJECT-RECOGNITION (2026-06-13): reporting + business-audit +
  // risk-dashboard REMOVIDOS do baseline — reconhecidos por SAFE_SUBJECT_READERS (subject server-side provado).
  // F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION (2026-06-13): policy-engine REMOVIDO. F-R2-TRUST-TENANT-GRANTS-
  // R24-UNFREEZE (2026-06-14): trust REMOVIDO — requireRole(admin) interino substituído por grant tenant-level
  // (Forma D, can_view/manage_tenant_trust). F-BANK-HTTP-AUTHORITY-BINDING (2026-06-14): bank-http REMOVIDO —
  // writers REQUEST-ONLY + GET /balance Forma E. F-ACTOR-WALLET-PAYOUT-WIRING (2026-06-14): payout REMOVIDO —
  // writers (batches/execute-manual/fail) FAIL-CLOSED (403 PAYOUT_HTTP_EXECUTION_DISABLED, sem executor) e GET
  // readers reconhecidos por Forma B (requirePermission com subject server-side) → SAFE_SUBJECT_READERS.
  // **BASELINE 0113 = 0** — os 2 resíduos financeiros (bank-http, payout) fechados. Execução real de Bank/payout
  // = frente futura (F-PAYOUT-EXECUTION-SEAL). Ver DECISION-0128 + audit-payout-authority-binding.mjs.
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (extname(full) === '.ts' && full.endsWith('.routes.ts')) {
      files.push(full);
    }
  }
  return files;
}

// 🔴 ANTIPADRÃO DURO (F-RISK-DASHBOARD-PERMISSION-SPOOF-CONTAINMENT): subject == target em chamada de
// autorização — ex.: requirePermission(tenantId, actorId, actorId, ...) onde o 2º arg (subject/userId)
// e o 3º (target/actor) são o MESMO identificador (geralmente derivado de actionContext/params/query).
// O SUBJECT da permissão deve vir SERVER-SIDE de req.user; nunca do alvo. SEMPRE FALHA (não baselineável).
const SUBJECT_EQUALS_TARGET = /requirePermission\(\s*[^,]+,\s*([A-Za-z_$][\w$]*)\s*,\s*\1\s*,/;

function runGuard() {
  const flagged = [];          // arquivos que casam canal sem binding e sem safe-subject (estado atual)
  const newViolations = [];
  const safeRecognized = [];   // readers reconhecidos por subject server-side (FATIA A)
  const acRecognized = [];     // B1f canal-1: actionContext.actorId vinculado por requirePermission([ (Forma A)
  const serviceBoundRecognized = []; // R8B: writers profile-c1 bound no SERVICE (prova cross-file runtime)
  const selfBoundRecognized = [];    // R8F: writers self-only bound a req.user.userId (prova runtime)
  const notAuthorityRecognized = []; // R8G: read-only not-authority (actorId presence-gate, sem write)

  for (const file of walk(SRC)) {
    const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    const raw = readFileSync(file, 'utf-8');
    const code = stripComments(raw);
    const channels = CLIENT_ACTOR_CHANNELS.filter((c) => c.re.test(code)).map((c) => c.key);
    if (channels.length === 0) continue;
    const hasBinding = BINDING_HELPERS.test(code);
    if (hasBinding) continue; // binding presente no arquivo → fora do escopo do guard (heurística)
    // FATIA A: reader/admin-filter AUDITADO + prova de subject server-side AINDA presente → reconhecido.
    if (rel in SAFE_SUBJECT_READERS) {
      const proof = safeSubjectProof(raw);
      if (proof) {
        safeRecognized.push({ rel, channels, proof });
        continue;
      }
      // estava no allowlist mas perdeu a prova → cai como violação (não está no BASELINE).
    }
    // R8B: writer profile-c1 bound no SERVICE (prova cross-file AINDA presente) → reconhecido.
    if (rel in SERVICE_BOUND_WRITERS) {
      const proof = serviceBoundProof(rel, raw);
      if (proof) {
        serviceBoundRecognized.push({ rel, channels, proof });
        continue;
      }
      // estava no mapa mas perdeu a prova (binding removido) → cai como violação (não está no BASELINE).
    }
    // R8F: writer self-only bound a req.user.userId (prova AINDA presente) → reconhecido.
    if (rel in SELF_BOUND_WRITERS) {
      const proof = selfBoundProof(rel, raw);
      if (proof) {
        selfBoundRecognized.push({ rel, channels, proof });
        continue;
      }
      // estava no mapa mas perdeu a prova (subject voltou ao actionContext) → cai como violação (fora do BASELINE).
    }
    // R8G: read-only not-authority (actorId presence-gate, sem write — prova AINDA presente) → reconhecido.
    if (rel in NON_AUTHORITY_READONLY) {
      const proof = notAuthorityReadonlyProof(rel, raw);
      if (proof) {
        notAuthorityRecognized.push({ rel, channels, proof });
        continue;
      }
      // perdeu a prova (write apareceu OU actorId virou valor/arg) → cai como violação (fora do BASELINE).
    }
    // B1f canal-1 (Forma A): se o ÚNICO canal é actionContext.actorId e há requirePermission([ preHandler,
    // o canal-1 está VINCULADO (requirePermission→canPerformAction→canActAs liga req.user→actor declarado).
    // NÃO vale se o arquivo também casa um canal STRICT (esse declara outro ator, que requirePermission não liga).
    const onlyActionContext = channels.length > 0 && channels.every((k) => !STRICT_CHANNELS.has(k));
    if (onlyActionContext && REQUIRE_PERMISSION_PREHANDLER.test(code)) {
      acRecognized.push({ rel, channels });
      continue;
    }
    flagged.push({ rel, channels });
    if (!(rel in BASELINE)) {
      newViolations.push({ rel, channels });
    }
  }

  const subjectSpoof = [];
  for (const file of walk(SRC)) {
    const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    if (SUBJECT_EQUALS_TARGET.test(stripComments(readFileSync(file, 'utf-8')))) subjectSpoof.push(rel);
  }

  // Baseline pode listar arquivos que hoje JÁ TÊM binding — não é erro; reportamos baseline órfão
  // como informativo (drift de limpeza), nunca FAIL.
  const flaggedRels = new Set(flagged.map((f) => f.rel));
  const staleBaseline = Object.keys(BASELINE).filter((b) => !flaggedRels.has(b));
  // Allowlist de safe-subject órfão (entrada que não foi exercida nem reconhecida) → informativo.
  const recognizedRels = new Set(safeRecognized.map((f) => f.rel));
  const staleSafeReaders = Object.keys(SAFE_SUBJECT_READERS).filter((r) => !recognizedRels.has(r) && !flaggedRels.has(r));
  // R8B: SERVICE_BOUND_WRITERS órfão (entrada que não foi exercida nem reconhecida) → informativo.
  const sbRecognizedRels = new Set(serviceBoundRecognized.map((f) => f.rel));
  const staleServiceBound = Object.keys(SERVICE_BOUND_WRITERS).filter((r) => !sbRecognizedRels.has(r) && !flaggedRels.has(r));
  // R8F: SELF_BOUND_WRITERS órfão (sem canal/sem uso) → informativo.
  const selfBoundRels = new Set(selfBoundRecognized.map((f) => f.rel));
  const staleSelfBound = Object.keys(SELF_BOUND_WRITERS).filter((r) => !selfBoundRels.has(r) && !flaggedRels.has(r));
  // R8G: NON_AUTHORITY_READONLY órfão → informativo.
  const naRels = new Set(notAuthorityRecognized.map((f) => f.rel));
  const staleNonAuthority = Object.keys(NON_AUTHORITY_READONLY).filter((r) => !naRels.has(r) && !flaggedRels.has(r));

  console.log(`[actor-authority-boundary] flagged=${flagged.length} baseline=${Object.keys(BASELINE).length} new=${newViolations.length} stale_baseline=${staleBaseline.length} safe_subject_recognized=${safeRecognized.length} service_bound_recognized=${serviceBoundRecognized.length} self_bound_recognized=${selfBoundRecognized.length} not_authority_recognized=${notAuthorityRecognized.length} canal1_bound_by_requirePermission=${acRecognized.length}`);
  if (notAuthorityRecognized.length > 0) {
    console.log('  ✅ read-only not-authority reconhecido (R8G — fora do baseline, prova verificada em runtime):');
    notAuthorityRecognized.forEach((s) => console.log(`     - ${s.rel}  [${s.channels.join(', ')}]  → ${s.proof}`));
  }
  if (staleNonAuthority.length > 0) {
    console.log('  ℹ️  NON_AUTHORITY_READONLY órfão (sem canal/sem uso — revisar numa futura limpeza):');
    staleNonAuthority.forEach((r) => console.log(`     - ${r}`));
  }
  if (selfBoundRecognized.length > 0) {
    console.log('  ✅ writer self-only bound a req.user reconhecido (R8F — fora do baseline, prova verificada em runtime):');
    selfBoundRecognized.forEach((s) => console.log(`     - ${s.rel}  [${s.channels.join(', ')}]  → ${s.proof}`));
  }
  if (staleSelfBound.length > 0) {
    console.log('  ℹ️  SELF_BOUND_WRITERS órfão (sem canal/sem uso — revisar numa futura limpeza):');
    staleSelfBound.forEach((r) => console.log(`     - ${r}`));
  }
  if (safeRecognized.length > 0) {
    console.log('  ✅ subject server-side reconhecido (FATIA A — fora do baseline, prova verificada em runtime):');
    safeRecognized.forEach((s) => console.log(`     - ${s.rel}  [${s.channels.join(', ')}]  → ${s.proof}`));
  }
  if (serviceBoundRecognized.length > 0) {
    console.log('  ✅ writer profile-c1 bound no SERVICE reconhecido (R8B — fora do baseline, prova cross-file verificada em runtime):');
    serviceBoundRecognized.forEach((s) => console.log(`     - ${s.rel}  [${s.channels.join(', ')}]  → ${s.proof}`));
  }
  if (staleServiceBound.length > 0) {
    console.log('  ℹ️  SERVICE_BOUND_WRITERS órfão (sem canal/sem uso — revisar numa futura limpeza):');
    staleServiceBound.forEach((r) => console.log(`     - ${r}`));
  }
  if (staleBaseline.length > 0) {
    console.log('  ℹ️  baseline já não casa (binding adicionado/arquivo limpo — pode ser removido do baseline numa futura limpeza):');
    staleBaseline.forEach((b) => console.log(`     - ${b}`));
  }
  if (staleSafeReaders.length > 0) {
    console.log('  ℹ️  SAFE_SUBJECT_READERS órfão (sem canal/sem uso — revisar numa futura limpeza):');
    staleSafeReaders.forEach((r) => console.log(`     - ${r}`));
  }

  if (subjectSpoof.length > 0) {
    console.error('GATE FAIL [actor-authority-boundary]: SUBJECT==TARGET client-declared em requirePermission (spoof de autoridade — F-RISK-DASHBOARD-PERMISSION-SPOOF). O subject deve vir de req.user server-side, nunca do alvo:');
    subjectSpoof.forEach((f) => console.error(`  ❌ ${f}  — requirePermission(tenantId, X, X, ...) com mesmo identificador; use req.user como subject (ex.: requirePermission(tenantId, req.user.id, targetActorId, ...)).`));
    process.exit(1);
  }

  if (newViolations.length > 0) {
    console.error('GATE FAIL [actor-authority-boundary]: NOVA rota lê canal de ator CLIENT-DECLARED sem binding server-side (DECISION-0113):');
    newViolations.forEach((v) => console.error(`  ❌ ${v.rel}  [${v.channels.join(', ')}]  — vincule via authorityService.canActAs/canRepresentActor, OU (reader/admin-filter) prove subject=req.user e adicione a SAFE_SUBJECT_READERS, OU adicione ao BASELINE com DT.`));
    process.exit(1);
  }

  console.log('GATE OK [actor-authority-boundary] — 6º canal body.actor registrado; safe-subject (FATIA A) reconhecido; nenhuma NOVA violação client-declared sem binding fora do baseline.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  runGuard();
}

export { safeSubjectProof, serviceBoundProof, selfBoundProof, notAuthorityReadonlyProof, runGuard, SAFE_SUBJECT_READERS, SERVICE_BOUND_WRITERS, SELF_BOUND_WRITERS, NON_AUTHORITY_READONLY, BASELINE, CLIENT_ACTOR_CHANNELS, BINDING_HELPERS };
