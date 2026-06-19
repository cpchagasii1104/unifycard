# 2026-06-19 — R8G NON-MONEY READ / NOT-AUTHORITY WAVE — plan GET (W3) + feed-plugin + business-authorization (cirúrgico)

Onda não-money/read sobre 3 entradas (DECISION-0113 / Z2): (1) `GET /plan` (W3 do reseal R8F) · (2) `feed-plugin`
(H_FALSE_POSITIVE) · (3) `business-authorization` (H_FALSE_POSITIVE candidato). Executou as 2 quick wins seguras
(plan GET self-subject + feed-plugin not-authority); **deferiu** business-authorization (read sensível por operador
client-declared + dependência de smoke).

## Anchor / Pré-flight

HEAD inicial `428d02f8` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8F CLOSED_WITH_REMAINDER; parent canal-1 OPEN baseline 13;
DT-mãe 0113 OPEN; DT-AUTHORITY-Z2-PLAN-GET-READ-AUTHORITY OPEN.

## Classificação das 3 entradas

| entrada | classe | decisão |
|---|---|---|
| **GET /plan (W3)** | **A_SAFE_SUBJECT_RECONCILE** (era read por actionContext.actorId) | **EXECUTADO — subject self-only req.user.userId** |
| **feed-plugin** | **H_FALSE_POSITIVE_NOT_AUTHORITY** | **EXECUTADO — guard not-authority + recognizer** |
| business-authorization | **DEFER** (read sensível: operador=actionContext.actorId client-declared; LEGACY advisory; smoke-dependency) | NÃO executado (frente própria) |

## Executado

**(1) plan GET — A_SAFE_SUBJECT (fecha W3):** o frontend chama `GET /plan` SEM actorId → semântica "meu plano".
Antes, o read usava `getUserPlanByActorId(tenantId, req.actionContext.actorId)` (client-declared → lia tier/
canToggle/is_test/admin de outro actor — W3). Agora deriva o actor do `req.user` autenticado (`findByUserId(
req.tenant.id, req.user.userId)` → `callerActor.actor_id`; 403 se ausente), igual ao PUT (DECISION-0113 fatia 5.1).
`actionContext.actorId` deixou de ser subject do read. Guard `audit-plan-self-bound.mjs` **estendido** para exigir
o GET também self-bound (subject de req.user; proíbe `getUserPlanByActorId(..., actionContext.actorId)`).
**Fecha `DT-AUTHORITY-Z2-PLAN-GET-READ-AUTHORITY`** e torna o recognizer `SELF_BOUND_WRITERS` honesto para o
arquivo inteiro (PUT + GET self-bound). users.plan = feature-flag (NÃO money).

**(2) feed-plugin — H_FALSE_POSITIVE not-authority:** orquestrador VISUAL read-only ("BLINDAGEM: rotas apenas
expõem informação"). O `actionContext.actorId` é PURE PRESENCE-GATE (400-if-missing, 5×), NUNCA threadado a
`feedPluginService`, e o módulo NÃO tem write sink. Novo guard `audit-feed-plugin-not-authority.mjs` (em
`validate:regression-guards`) prova: zero write/DB no arquivo; toda ocorrência de actionContext.actorId está em
presence-gate (`!`); proíbe threadar actorId a service. Detector ganhou `NON_AUTHORITY_READONLY` +
`notAuthorityReadonlyProof` (reconhece em runtime); feed-plugin **removido do BASELINE**. Runtime intocado.

## Deferido — business-authorization

`GET /business-permissions/check` é advisory read-only ("apenas para UI; backend sempre valida novamente"), MAS o
**operador** do read = `actionContext.actorId` (client-declared) → revela permissão/role de operador declarado
sobre org declarada = **read sensível** (regra do prompt: read sensível ⇒ NÃO false-positive). Serviço é LEGACY;
**zero caller real** no frontend (só a definição em api/business-permissions.ts); referenciado por
`smoke-production.ts:134` (asserta `status<500`, e 501 ≥ 500 quebraria). Por isso NÃO é quick win: precisa de
frente própria (bind do operador a req.user/canActAs, OU contenção 403 — não 501 — com revisão do smoke). Mantido
no BASELINE; registrado.

## Baseline canal-1 — antes/depois

**13 → 12** (flagged 10→9 · baseline 13→12 · **new=0** · stale_baseline 3 · safe_subject 6 · service_bound 4 ·
self_bound 1 · **not_authority 0→1**). GATE OK. (plan já estava fora do baseline desde R8F; o W3 fix tornou o
recognizer honesto e fechou a DT, sem mudar a contagem por plan.)

## Prova material — guards + negative-proof

- Guard `audit-plan-self-bound.mjs` (estendido): PUT + GET ambos self-bound (subject=req.user.userId; proíbe
  actionContext.actorId como subject). Guard `audit-feed-plugin-not-authority.mjs` (novo): read-only + presence-gate.
  Ambos em `validate:regression-guards`.
- **Negative-proof versionado** `negative-proof-r8g-read-not-authority-wave.ps1` (ASCII/sem-BOM, pwsh 7 + WPS 5.1):
  (1) reverte o subject de plan (req.user.userId→req.actionContext.actorId) → `audit-plan-self-bound` FALHA
  (dispara o check do GET **e** do PUT); (2) threada actionContext.actorId num `feedPluginService.listPlugins(...)`
  → `audit-feed-plugin-not-authority` FALHA; cada um restaura byte-idêntico + git status inalterado.
- Detector: `selfBoundProof` (plan, PUT+GET) + `notAuthorityReadonlyProof` (feed-plugin) — re-flaggam e FALHAM se a
  prova sumir.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ plan guard estendido + feed-plugin
guard) · actor-authority-boundary **new=0** (baseline 13→12) · arch `--strict` **critical_new=0** (warning_new=4
pré-existente) · check:migrations **394/394** (sem migration) · tsc **43** (baseline, 0 novo).

## Escopo negativo

NÃO executou business-authorization (read sensível + smoke-dependency → frente própria) · NÃO tocou money/método
de pagamento/Bank/Core/ledger/splits/payout/recovery/AP/AR/PO/SPR · RBAC/FASE 6 · actor_delegations/R2 · sem
migration/schema · NÃO materializou schema · NÃO decidiu produto · NÃO fecha DT-mãe 0113 nem parent canal-1
(baseline 12>0). feed-plugin runtime intocado.

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. Onda R8G: plan GET A_SAFE_SUBJECT (fecha W3) + feed-plugin H_FALSE_POSITIVE;
**baseline 13→12**. `DT-AUTHORITY-Z2-PLAN-GET-READ-AUTHORITY` → **RESOLVED (HOLD YALA)** (GET self-bound).
DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN**. Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (12 entradas)

- **MONEY → IA-DINHEIRO (9):** event-rfq[stale/W6], purchase-order[stale], service-payment-request[stale],
  accounts-payable, accounts-receivable, organizers, store-onboarding, services-discovery, unifycard-method.
- **DEFER read sensível / própria (1):** business-authorization (bind operador a req.user OU contain 403; revisar smoke).
- **C_CONTAIN ghost própria (2):** automation (9 rotas mistas; run-due já 403), human-mvp (vertical G10/produto).
