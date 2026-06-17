# 2026-06-17 — F-AUTHORITY-Z2-R6.1-SERVICES-ACTOR-BINDING (material, cirúrgico)

Contenção **localizada** do bolsão legado `/services` (DECISION-0113 / DECISION-0131 §B7 / Z2): POST/PUT
criavam/atualizavam serviço em nome de um actor sem provar representação server-side. `actorId`
declarado pelo cliente é HINT, nunca autoridade. Non-money; sem migration/schema; availability,
Bank/ledger/splits e R1/R2/R3/R4/R5 intocados.

## Anchor / Pré-flight

HEAD inicial `976a5e1d` · branch `rescue-structural` · dev 394 · pending=[]. Anchors `6e94916f`…`976a5e1d`
(13) presentes. Sem sujeira material em services/service-offering/authority/action-context/bank/ledger/
migrations/R1-R5/referral.

## Causa-raiz (READ-FIRST)

- **POST /services** (`servicesService.createService`): `body.actorId` = dono declarado; o handler passava
  `req.actionContext.actorId` a um param `userId` morto; o service só checava **existência** do actor
  (`actorRepository.findById`), nunca representação → qualquer autenticado criava serviço sob qualquer actor.
- **PUT /services/:id** (`servicesService.updateService`): check fraco
  `if (actor.user_id !== userId && actor.actor_type !== 'user') throw` — **bypass** para actor-type `'user'`
  (curto-circuito) e **sem caminho de delegação** para page/group; o param `userId` recebia
  `actionContext.actorId` (actorId, não userId).
- **Availability** (`createServiceAvailability`/`updateServiceAvailability`): JÁ vinculada por
  `requireServiceOwnedByActor` (exact-owner `service.actorId === callerActorId`) → **não tocada** (GO).
- Coluna dona = `services.actor_id`; `findById(...).actorId` resolve o dono; dono **imutável** no update.
- Padrão canônico: `service-offering.service.ts` → `canRepresentActor(tenantId, req.user.userId, providerActorId)`
  fail-closed 403. Subject = `req.user.userId` (disponível no protectedScope: auth/tenant/action-context/rbac).

## Correção (cirúrgica — `services.routes.ts` + `services.service.ts`)

**Rota (gate autoritativo, 403 direto):**
```
const userId = (req as { user?: { userId?: string } }).user?.userId;
if (!userId) return reply.status(401)... code:'AUTH_REQUIRED';
// POST: target = parsed.data.actorId
const canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, parsed.data.actorId);
if (!canRep) return reply.status(403)... code:'SERVICE_ACTOR_NOT_REPRESENTABLE';
// PUT: target = current.actorId (server-resolved via getService); 404 se inexistente
```
A rota passa o `userId` real ao service (createService/updateService) em vez de `actionContext.actorId`.

**Service (defesa em profundidade + remoção do check fraco):**
- `createService`: após a checagem de existência, `canRepresentActor(tenantId, userId, input.actorId)` →
  `ForbiddenError('SERVICE_ACTOR_NOT_REPRESENTABLE: …')` se false.
- `updateService`: o check fraco (`actor.user_id !== userId && actor.actor_type !== 'user'`) foi
  **substituído** por `canRepresentActor(tenantId, userId, currentService.actorId)` → `ForbiddenError` se false
  (o load redundante de `actor` foi removido).

`services.routes.ts` **removido do baseline canal-1** de `audit-actor-authority-boundary.mjs` (o canal
`actionContext.actorId` como autoridade sumiu; o arquivo agora é `hasBinding`).

## E2E

`run-services-actor-binding-ephemeral.ps1` → **17/17 verdes** (DB efêmera dedicada; nunca unificard_dev):
- **A (estrutural):** A1 gate na rota (POST `parsed.data.actorId` / PUT `current.actorId`) · A2 subject
  `req.user.userId` + 403 `SERVICE_ACTOR_NOT_REPRESENTABLE` · A3 gate **antes** dos sinks create/update ·
  A4 service tem canRepresentActor em create+update e o check fraco foi removido (comentários stripados).
- **B (primitivo):** B1 `canRepresentActor(A.userId, A.actor)=true` · B2 `(B.userId, A.actor)=false`.
- **C (HTTP real via `fastify.inject`):** C1 POST spoof (B cria p/ A) → **403** · C2 sem nova linha `services` ·
  C3 POST self passa do gate (falha adiante, nunca 403-repr) · C4 PUT spoof (B atualiza serviço de A) →
  **403** + nome inalterado · C5 PUT self passa do gate.
- **D (não-regressão):** D1 service-offering canônico · D2 R5 intent-execute · D3 R1 groups · D4 R3 reports ·
  D5 R4 marketplace money-latent. **E1** bank_ledger/bank_transactions/bank_splits intocados.

## Guard + Negative-proof

Novo `scripts/audit-services-actor-binding.mjs` em `validate:regression-guards`: exige canRepresentActor
(rota: `(req.tenant.id, userId, parsed.data.actorId)` [POST] e `(.., current.actorId)` [PUT], antes dos
sinks; service: `(tenantId, userId, input.actorId)` e `(.., currentService.actorId)`), subject de
`req.user.userId`, 403 `SERVICE_ACTOR_NOT_REPRESENTABLE`; proíbe actor declarado como subject, o check fraco
e a regressão do offering. **Negative-proof versionado** `scripts/negative-proof-services-actor-binding.ps1`
(ASCII puro, sem BOM, roda em pwsh 7 **e** Windows PowerShell 5.1): spoof do subject → **GATE FAIL (exit 1)**
→ restaura byte-idêntico → **git status inalterado** → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente, nenhum nas minhas alterações) ·
check:migrations OK (**sem migration**) · tsc baseline **43** — **0 erro novo na frente**.

## Escopo negativo

Sem migration/schema; **availability não tocada** (já owner-gated); `service-offering` sem regressão; Bank
Core/`bank_ledger`/`bank_transactions`/`bank_splits`, R1 groups/R2 dashboard/R3 reports/R4 money-latent/R5
intent-execute, referral, event-rfq/social-posts/feed-action/venue/system-notifications/store-onboarding/
business-permissions/unifycard **intocados**.

## Proof-hygiene pós-reseal (sem novo commit; HEAD permaneceu `b54838ed`) — W1/W2 resolvidos

Reseal Yala material READ-ONLY = **PASS_WITH_WARNINGS**. Warnings operacionais resolvidos antes do seal,
sem alterar material (o `.ps1` já estava ASCII/sem-BOM com Set-Location + asserção byte-idêntica + git
status pre-vs-post; nenhuma edição necessária):

- **W1 — E2E + negative-proof não rodaram no pass Yala:** reproduzidos no ambiente da executora.
  `negative-proof-services-actor-binding.ps1` executado em **pwsh 7 e Windows PowerShell 5.1** — base passa
  → mutação spoofando o subject (`parsed.data.actorId` como 2º arg) faz o guard FALHAR (exit 1) → restauração
  faz o guard passar → restauração **byte-idêntica** → **git status sem resíduo**. E2E
  `run-services-actor-binding-ephemeral` **17/17** (DB efêmera dedicada, nunca unificard_dev).
- **W2 — gates completos não reexecutados frescos no pass Yala:** gates frescos verdes — actor-writer /
  bank-ledger boundaries, regression-guards (inclui `services-actor-binding`), arch `--strict`
  critical_new=0, check:migrations 394/394, tsc baseline 43 (zero erro novo).

## Continuidade (recomendação futura — NÃO executar agora)

- **R6.2 SOCIAL-POSTS-ACTOR-BINDING** — vivo, non-money, write-attribution unbound.
- **R6.3 FEED-ACTION** — alinhar ao padrão de binding do `/feed/contextual`.
- **R7 EVENT-RFQ-ACTING-USER-GATE** — money-adjacent, maior severidade remanescente (fail-open por
  `actingUserId` fantasma; `acceptQuote` cria booking + payment_request).
- **venue / system-notifications** — schema ghost; conter antes de materializar tabelas.
- **business-permissions/check** — aguarda decisão Clayton.
- **Guard cross-module Z2** — para subsumir os guards per-file (avança a DT-mãe).

## Estado

**✅ CLOSED / YALA PASS MATERIAL** (seal docs-only 2026-06-17 sobre commit material `b54838ed`; reseal Yala
material READ-ONLY = PASS_WITH_WARNINGS; warnings W1/W2 resolvidos pela executora). dev 394.
`DT-AUTHORITY-Z2-SERVICES-ACTOR-BINDING-UNBOUND` → **CLOSED / YALA PASS MATERIAL**. **Esta frente fechou
somente a contenção localizada de services actor binding. Não fecha Z2 inteiro, Z1, Z3, authority global nem
a DT-mãe 0113** — o parent canal-1 `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` e a DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` permanecem **OPEN**. R1/R2/R3/R4/R5 **não reabertos**;
availability e service-offering **não regrediram**. Nenhum código material alterado no seal.
