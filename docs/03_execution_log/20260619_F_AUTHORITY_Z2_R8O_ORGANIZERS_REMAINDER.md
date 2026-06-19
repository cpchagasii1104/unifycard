# 2026-06-19 — R8O ORGANIZERS REMAINDER EVENT-ORGANIZER AUTHORITY BIND (cirúrgico)

Bind canal-1 das rotas remanescentes de event-organizer authority (create/add-member/link-event) — o "PARTIAL"
deixado por R8K (DECISION-0113 / Z2). **NÃO reabre billing, NÃO toca event-settlement/services-discovery/
unifycard-method/Bank/ledger, NÃO decide SaaS-vs-split, NÃO cria migration.**

## Anchor / Pré-flight

HEAD inicial `6cc1b731` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · working tree material limpo. Parent canal-1 OPEN baseline 3; DT-mãe 0113 OPEN.

## READ-FIRST — prova material

- **Rotas remanescentes (canal-1):** POST /create, POST /:id/add-member, POST /link-event/:eventId (writes). GET
  / GET /:id GET /plans = reads (sem actionContext authority). Billing (subscribe/cancel/subscribe-stripe/plan/
  subscription + webhook) já CONTIDO em R8K (5×501 + webhook no-op) — fora de escopo, preservado.
- **Modelo de autoridade:** `event_organizers.owner_global_user_id` + `event_organizer_members.global_user_id`+role,
  via `organizersService.hasPermission(tenantId, organizerId, globalUserId, ['owner','admin'])`. `createOrganizer`
  seta owner = `ownerGlobalUserId`; `addMember`/`linkEvent` gateiam por `hasPermission(requesterGlobalUserId)`.
  **`event_organizers.actor_id` é órfão/não usado** pelo modelo (a autoridade real é o global_user_id).
- **Defeito (canal-1):** as 3 rotas passavam `actionContext.actorId` (client-declared actor id) como
  `ownerGlobalUserId`/`requesterGlobalUserId` — spoofável + semanticamente errado (actor id != global user id).
- **link-event:** só faz `UPDATE events SET organizer_id` — **NÃO toca `events.actor_id`** (eixo de autoridade do
  event-settlement canônico). event-settlement INTOCADO. `bank_refs`=NONE.

## Classificação + Decisão por rota

Todas **B_BIND_LOCAL** — as REGRAS de autoridade já existem (hasPermission); o único defeito era a FONTE do subject.
Nenhum STOP acionado: owner não-ambíguo (create = self; add/link = hasPermission por global_user_id), regras de
member/link já definidas no service, sem money/settlement, sem schema.

- **create:** subject = req.user → global_user_id server-side (`resolveRequesterGlobalUserId` →
  `resolveGlobalUserId(req.user.id, tenantId)`); organizer nasce owned pelo caller autenticado.
- **add-member:** subject = req.user → global_user_id; `addMember` gateia via `hasPermission(owner/admin)`.
- **link-event:** subject = req.user → global_user_id; `linkEvent` gateia via `hasPermission(organizer)` + criador
  do evento; só seta `events.organizer_id`.

## Fix cirúrgico (route-only)

Helper `resolveRequesterGlobalUserId(req, reply)` (401 `ORGANIZER_ACTOR_AUTHORITY_REQUIRED` se sem req.user; resolve
`global_user_id` de `req.user.id`). As 3 rotas: `const requesterGlobalUserId = await resolveRequesterGlobalUserId(...)`
e passam `requesterGlobalUserId` ao service. Removida toda governança por `actionContext.actorId` (inclusive a
presença-gate V2). Billing (R8K) e service intocados.

## Baseline canal-1 — 3 → 2

`organizers.routes.ts` **REMOVIDO do baseline** — após o bind, o arquivo não casa mais nenhum canal
client-declared (actionContext.actorId removido; query/body não-actorId). Detector: **flagged 2 · baseline 2 ·
new=0 · stale 0 · safe_subject 7**. GATE OK. Restantes: services-discovery [PARTIAL], unifycard-method [M5 money].

## Prova material — guard + negative-proof + E2E

- E2E DB-free `validate-pipeline-e2e-organizers-actor-bind.ts` → **7/7**: create/add-member/link-event SEM req.user
  (só actionContext spoofado) → **401 ORGANIZER_ACTOR_AUTHORITY_REQUIRED** (prova que actionContext.actorId NÃO
  autoriza); billing /:id/subscribe → 501 (R8K preservado); webhook → 200 {contained}; guards + baseline verdes.
  (Fail-closed ocorre antes de resolveGlobalUserId/service/DB → DB-free.)
- Guard `audit-organizers-actor-authority-bind.mjs` (wired): subject=req.user→global_user_id; 3 writes recebem
  requesterGlobalUserId; PROÍBE actionContext.actorId autoridade; exige billing R8K preservado (5×501 + webhook
  no-op); proíbe events.actor_id/event-settlement + bank_*.
- **Negative-proof versionado** `negative-proof-organizers-actor-authority-bind.ps1` (ASCII/sem-BOM, pwsh 7 + WPS
  5.1): (1) subject volta a actionContext.actorId → GATE FAIL; (2) subject derivado de query.actorId em vez de
  req.user → GATE FAIL; cada um restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo; organizer-billing-
ghost R8K preservado) · actor-authority-boundary **new=0** (baseline 3→2) · arch `--strict` **critical_new=0**
(warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**.

## Escopo negativo

NÃO reabriu billing (5×501 + webhook no-op intactos) · NÃO decidiu SaaS-vs-split · NÃO tocou event-settlement
(events.actor_id intocado; só events.organizer_id) · NÃO tocou services-discovery/unifycard-method/business-
authorization/Bank/ledger/transactions/splits/payout/recovery/settlement · NÃO criou migration/materializou schema ·
NÃO abriu RBAC amplo · NÃO fecha DT-mãe 0113 nem parent canal-1 (2>0).

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. organizers create/add-member/link-event → **BOUND (subject=req.user) / HOLD YALA**;
organizers file → **FULLY RESOLVED** (billing CONTAINED R8K + authority BOUND R8O) → removido do baseline.
`DT-AUTHORITY-Z2-ORGANIZER-EVENT-AUTHORITY` → IMPLEMENTED_AS_BOUND / HOLD YALA. DT-mãe 0113 + parent canal-1 OPEN
(baseline 2). Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (2 entradas)

- **MONEY → IA-DINHEIRO (2):** services-discovery [PARTIAL — rotas não-money createOffer/createRequest/respond],
  unifycard-method [M5 money defer, fee-unit defect no settlement — NÃO executar sem decisão money].
- _(Residual: organizer billing SaaS-vs-split; event_settlements ghost; CRM AR read; DECISION-0110/0114 D5;
  automation worker + human-mvp/G10 reativação.)_
