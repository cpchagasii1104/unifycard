# 2026-06-19 — R8L BUSINESS-AUTHORIZATION READ-SENSITIVE AUTHORITY (bind, cirúrgico)

Bind canal-1 da leitura sensível `GET /business-permissions/check` (DECISION-0113 / Z2). **NÃO toca money, NÃO toca
Bank/Core/ledger, NÃO abre frente ampla de RBAC/delegação, NÃO altera businessAuthorizationService legado fora do
escopo, NÃO cria migration.**

## Anchor / Pré-flight

HEAD inicial `90719025` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · working tree material limpo. Parent canal-1 OPEN baseline 6; DT-mãe 0113 OPEN.

## READ-FIRST — prova material

- **Rota exata:** `GET /business-permissions/check?action&actorId&contextId` (`core/authorization/
  business-authorization.routes.ts`). **Read-only** (apenas UI; backend revalida nas ações). Revela
  permissão/role (resultado de `checkPermission`).
- **Service:** `businessAuthorizationService.checkPermission(tenantId, userId, actorId, action, contextId)` →
  `OrganizationAuthorizationHelper.getUserRole(tenantId, userId, actorId)` → "o **user** tem role para a ação na
  **org** actorId?".
- **Defeito (canal-1):** a rota passava **`actionContext.actorId` (client-declared) como o `userId`/SUBJECT** (2º
  arg) — semanticamente errado (actor id ≠ user id) E spoofável (permitia perguntar "operador X pode A em Y?" sem
  provar ser X). `query.actorId` ia como a org (3º arg).
- **Subject real:** o utilizador autenticado (`req.user`). **Target:** a org (`query.actorId`).
- **canRepresentActor antes?** Não — e NÃO é o primitivo correto aqui: a checagem é uma consulta de
  AUTO-permissão (o caller pergunta o SEU próprio papel numa org); `getUserRole(req.user, org)` revela só o que é
  dele. Gate por canRepresentActor seria ovo-galinha (checa permissão p/ saber se pode agir).
- **Frontend/smoke:** nenhum smoke referencia esta rota (`smoke-production.ts:134` bate noutro endpoint `/n`). Sem
  smoke para atualizar. **bank_ledger/transactions/splits:** NENHUM (zero money).

## Decisão: BIND (Opção A) — STOPs não acionados

Owner/target claros → **BIND**. Subject derivado de `req.user`; `actionContext.actorId` deixa de governar;
`query.actorId` é só o CONTEXTO org; `getUserRole` revela só o papel do próprio caller. STOP_BUSINESS_AUTH_TARGET_
AMBIGUOUS não acionado (target = org do query, subject = caller); STOP_…PRODUCT_DECISION não acionado (auto-permissão,
sem decisão de produto); STOP_CORE_MONEY_PATH não acionado (zero bank_*); STOP_SCOPE_EXPANSION evitado (só esta rota;
businessAuthorizationService intocado).

## Fix cirúrgico (route-only)

```
const subjectUserId = req.user?.id;
if (!subjectUserId) → 401 BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED
const orgActorId = req.query.actorId;            // contexto org (alvo de leitura), NÃO subject
checkPermission(tenantId, subjectUserId, orgActorId, action, contextId)   // subject server-side
```
Removida toda a governança por `actionContext.actorId` (inclusive a presença-gate V2). `businessAuthorizationService`
intocado.

## Detector — recognition + baseline 6 → 5

- `safeSubjectProof` Forma B estendida para reconhecer **checkPermission** (mesma família
  `businessAuthorizationService(tenantId, userId, actorId, action)` do requirePermission).
- `business-authorization.routes.ts` adicionado a `SAFE_SUBJECT_READERS` (subject=req.user, query.actorId=alvo).
- **REMOVIDO do BASELINE.** Detector: **flagged 5 · baseline 5 · new=0 · stale 0 · safe_subject_recognized 6→7**.
  Recognition: `B:requirePermission/checkPermission(tenantId, subjectUserId=req.user, orgActorId) — subject
  server-side, subj!=target`. Se o subject voltar a client-declared, a prova some → re-flagga → FALHA (sem máscara).

## Prova material — guard + negative-proof + E2E

- E2E DB-free `validate-pipeline-e2e-business-authorization-read-authority.ts` → **6/6**: sem req.user → 401
  nomeado; sem actorId → 400; **subject recebido por checkPermission === req.user.id** (não actionContext); **spoof
  actionContext/x-actor-id NÃO altera o subject**; guard + baseline verdes. (Service stubado → DB-free.)
- Guard `audit-business-authorization-read-authority.mjs` (wired): subject=req.user.id + 401 nomeado +
  checkPermission(…, subjectUserId, …) + PROÍBE actionContext.actorId/req.body|query como subject + zero bank_*/write.
- **Negative-proof versionado** `negative-proof-business-authorization-read-authority.ps1` (ASCII/sem-BOM, pwsh 7 +
  WPS 5.1): (1) subject volta a actionContext.actorId → GATE FAIL; (2) remover o subject derivado de req.user →
  GATE FAIL; cada um restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo) ·
actor-authority-boundary **new=0** (baseline 6→5) · arch `--strict` **critical_new=0** (warning_new=4
pré-existente) · check:migrations **394/394** (sem migration) · tsc **43** (sem erro novo).

## Escopo negativo

NÃO aceitou actionContext.actorId/body/query como autoridade · NÃO expôs role de terceiros (só auto-permissão) ·
NÃO relaxou smoke · NÃO tocou money/Bank/bank_ledger/transactions/splits/payout/recovery/settlement · NÃO alterou
businessAuthorizationService legado · NÃO corrigiu organizers/services-discovery/unifycard-method/automation/
human-mvp · NÃO criou migration · NÃO abriu frente ampla de RBAC/delegação · NÃO fecha DT-mãe 0113 nem parent
canal-1 (5>0).

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. `GET /business-permissions/check` → **BOUND (subject=req.user) / HOLD YALA**
(removido do baseline). `DT-AUTHORITY-Z2-BUSINESS-AUTHORIZATION-READ-SENSITIVE` → IMPLEMENTED_AS_BOUND / HOLD YALA.
DT-mãe 0113 + parent canal-1 OPEN (baseline 5). Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (5 entradas)

- **MONEY → IA-DINHEIRO (2):** services-discovery [PARTIAL — rotas não-money], unifycard-method.
- **C_CONTAIN ghost própria / produto (2):** automation, human-mvp (G10).
- **organizers [PARTIAL]:** create/add-member/link-event (event-organizer authority) — frente própria.
- _(Residual: organizer billing SaaS-vs-split; event_settlements ghost; CRM AR read; DECISION-0110/0114 D5.)_
