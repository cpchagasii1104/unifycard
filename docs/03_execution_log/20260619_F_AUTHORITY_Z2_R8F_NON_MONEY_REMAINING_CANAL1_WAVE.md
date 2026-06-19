# 2026-06-19 — R8F NON-MONEY REMAINING CANAL-1 WAVE — triagem das 6 + 2 quick wins (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `45442820`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (executou 2,
> deixou 13 remanescentes; **NÃO** fecha a DT-mãe 0113 nem o parent canal-1). **Estados por tipo:** **plan** →
> **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (A_RECONCILE self-bound write — NÃO containment; com follow-up W3
> abaixo); **contact** → **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (C_CONTAIN schema-ghost — NÃO
> `CLOSED` simples). **Yala confirmou materialmente:** HEAD 45442820 · branch rescue-structural · migrations
> 394/394 · diff 10 arquivos; sem migration/schema; zero money/método de pagamento/Bank/Core/ledger/splits/payout/
> recovery/AP/AR/PO/SPR; zero RBAC/FASE 6/actor_delegations/R2/produto; services-discovery/unifycard-method/
> feed-plugin/business-authorization NÃO tocados; `plan.routes.ts` NÃO alterado; PUT /plan self-bound
> (subject=req.user.userId via findByUserId; sink UPDATE users mira userRow.user_id; 403 antes do UPDATE;
> actionContext.actorId neutralizado; users.plan=feature-flag não-money; não toca bank_*); guard
> `audit-plan-self-bound.mjs` wired+GREEN; detector ganhou SELF_BOUND_WRITERS; `contacts` schema-ghost
> (to_regclass=NULL; CREATE só em migrations_archive/0065); 6 rotas contact → 501 CONTACTS_SCHEMA_GHOST_CONTAINED
> antes de service/DB; contactService/actionContext removidos dos handlers; guard contacts estendido com seção
> route-level GREEN; **E2E DB-free 9/9 rodado pela Yala**; baseline **15→13** (flagged 12→10 · new=0 · stale 3 ·
> safe_subject 6 · service_bound 4 · self_bound 1); actor-authority-boundary/actor-writer/bank-ledger/
> regression-guards OK · arch critical_new=0 · tsc baseline 43; cartório correto; **DT-mãe 0113 e parent canal-1
> seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> source); validado estruturalmente + executora declarou pwsh 7 e WPS 5.1. **W2** — working tree sujo fora do
> material → não é HOLD_WORKTREE_DIRTY. **W3 (material residual):** o recognizer `SELF_BOUND_WRITERS` é file-level
> e exime `plan.routes.ts` inteiro pela prova do PUT — porém **GET /plan** ainda lê
> `getUserPlanByActorId(tenantId, req.actionContext.actorId)` SEM canRepresentActor, permitindo READ não-bound de
> tier/canToggle/is_test/admin de outro actor. Severidade: **não-money, read-only, pré-existente, não bloqueia o
> WRITE self-bound nem o PASS** — vira **follow-up explícito** (ver `DT-AUTHORITY-Z2-PLAN-GET-READ-AUTHORITY`,
> registrada no REMEDIATION_DT_LOG). Mitigação futura (frente própria): conter/provar o read com
> canRepresentActor/canActAs · OU subject seguro req.user.userId · OU estreitar SELF_BOUND_WRITERS p/ não eximir
> o read · OU guard SAFE_SUBJECT-style se o read for comprovadamente self-only. Seal = docs-only; HEAD material
> permanece `45442820`. _(Detalhe IMPLEMENTED abaixo.)_

Onda não-financeira sobre 6 entradas do parent canal-1 (`DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`,
DECISION-0113 / Z2): `plan` · `services-discovery` · `contact` · `feed-plugin` · `business-authorization` ·
`unifycard-method`. Triagem A–H via fan-out de 6 leitores read-only; **execução em lote SOMENTE de quick wins
seguras não-financeiras** (1 reconcile self-bound + 1 contenção schema-ghost). Money/false-positive deferidos.

## Anchor / Pré-flight

HEAD inicial `2703b925` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8E CLOSED_WITH_REMAINDER; parent canal-1 OPEN baseline 15;
DT-mãe 0113 OPEN.

## Matriz de triagem — 6 entradas (fan-out read-only)

| entrada | classe | money | tabela | ação nesta onda |
|---|---|---|---|---|
| **core/plan/plan.routes.ts** | **A_RECONCILE** | NO (users.plan = feature-flag) | live | **EXECUTADO — reconcile self-bound** |
| modules/services/services-discovery.routes.ts | **D_MONEY_DEFER** | **YES** (POST /request/pay move dinheiro) | live | DEFER → IA-DINHEIRO |
| **modules/marketplace/contact.routes.ts** | **C_CONTAIN** | NO | ghost (contacts) | **EXECUTADO — contido 501 route-level** |
| core/feed/feed-plugin.routes.ts | H_FALSE_POSITIVE | NO | live (read-only) | DEFER (actorId presence-gate; nunca threada; sem write) |
| core/authorization/business-authorization.routes.ts | H_FALSE_POSITIVE | NO | ghost (business_audit_logs) | DEFER (read-only LEGACY advisory + audit breadcrumb) |
| modules/marketplace/unifycard-method.routes.ts | **D_MONEY_DEFER** | **YES** (acquiring fee_percentage/settlement_delay consumidos na resolução de fee de pagamento) | ghost | DEFER → IA-DINHEIRO |

**unifycard-method (aviso do prompt resolvido):** moneyTouch=YES — configura fee de aquisição/settlement consumido
no fluxo de pagamento → **D_MONEY_DEFER** (não executado), conforme a regra de não tocar método de pagamento.

## Executado nesta onda

**(a) plan — A_RECONCILE (self-bound, não-money):** PUT /plan (`UPDATE users SET plan`) é per-user do PRÓPRIO
caller (DECISION-0113 fatia 5.1). O actionContext.actorId é NEUTRALIZADO: subject = `req.user.userId` via
`findByUserId(req.tenant.id, req.user.userId)` → `callerActor.actor_id`; privilégio (is_test/admin) lido do actor
do CALLER; **403 ANTES do UPDATE**; o sink mira `userRow.user_id` (caller resolvido server-side). `users.plan` é
feature-flag, NÃO money. **Reconcile:** novo guard dedicado `audit-plan-self-bound.mjs` (em
`validate:regression-guards`) trava a ligação; detector ganhou `SELF_BOUND_WRITERS` + `selfBoundProof` (reconhece
em runtime que o subject vem de req.user); plan **removido do BASELINE**. Se a prova sumir (subject volta ao
actionContext), re-flagga e FALHA. Runtime de plan **intocado** (já estava bound).

**(b) contact — C_CONTAIN (schema-ghost, route-level):** `contacts` é schema-ghost (CREATE só em
`migrations_archive/0065`; to_regclass=null). O write JÁ era contido no SERVICE
(`assertContactsFeatureAvailable()` → 501, guard `audit-contacts-schema-ghost-containment`). R8F **eleva a
contenção à BORDA**: as 6 rotas (POST/PATCH/GET×3/kyc) retornam **501 `CONTACTS_SCHEMA_GHOST_CONTAINED`** ANTES de
ler `actionContext.actorId` ou chamar `contactService` → o canal-1 DESAPARECEU do arquivo; removidos imports
service/types. Comportamento p/ o frontend idêntico (já recebia 501 do service). Contact **removido do BASELINE**.
O funil do service + guard existente seguem intactos (defesa em profundidade); o guard foi estendido com seção
route-level. Sem migration, sem materializar `contacts`.

## Baseline canal-1 — antes/depois

**15 → 13** (flagged 12→10 · baseline 15→13 · **new=0** · stale_baseline 3 · safe_subject_recognized 6 ·
service_bound_recognized 4 · **self_bound_recognized 0→1**). GATE OK.

## Prova material

- E2E DB-free `validate-pipeline-e2e-r8f-contact-containment.ts` → **9/9** (6 endpoints contact → 501 com code
  nomeado + guards contacts/plan/baseline verdes; rota contida não importa pool/service → inject sem banco).
- Guards: `audit-plan-self-bound.mjs` (novo, em validate:regression-guards) + `audit-contacts-schema-ghost-
  containment.mjs` (estendido com seção route-level: ≥6 rotas 501, proíbe contactService./actionContext.actorId
  na rota).
- **Negative-proof versionado** `negative-proof-r8f-nonmoney-wave.ps1` (ASCII/sem-BOM, pwsh 7 + WPS 5.1): (1)
  spoofa o subject de plan (req.user.userId→req.actionContext.actorId) → `audit-plan-self-bound` FALHA exit 1; (2)
  reintroduz `contactService.createContact` no POST /contacts → `audit-contacts-schema-ghost-containment` FALHA
  exit 1; cada um restaura byte-idêntico + git status inalterado.
- Triagem fan-out: 6 agentes read-only (Workflow `r8f-nonmoney-triage`) — Evidence Pack por arquivo.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo plan + contacts
estendido) · actor-authority-boundary **new=0** (baseline 15→13) · arch `--strict` **critical_new=0**
(warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43** (baseline, 0 novo).

## Escopo negativo

NÃO executou money (services-discovery, unifycard-method → IA-DINHEIRO) · NÃO executou H_FALSE_POSITIVE
(feed-plugin, business-authorization — precisam guard not-authority próprio) · NÃO tocou método de pagamento ·
Bank/Core/ledger/splits/payout/recovery/AP/AR/PO/SPR · RBAC/FASE 6 · actor_delegations/R2 · sem migration/schema ·
NÃO materializou contacts · NÃO redesenhou · NÃO fecha DT-mãe 0113 nem parent canal-1 (baseline 13>0). Runtime de
plan intocado (só guard+recognizer); contact mudou só a borda (route 501), service/guard intactos.

## Estado

**✅ CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material
`45442820`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W3 registrados como follow-up
não-bloqueante — ver bloco SEAL no topo). Onda R8F: **plan → CLOSED** (A_RECONCILE self-bound; follow-up W3
`DT-AUTHORITY-Z2-PLAN-GET-READ-AUTHORITY` OPEN) · **contact → CLOSED_AS_CONTAINED** (C_CONTAIN schema-ghost).
**baseline 15→13.** A onda deixou 13 remanescentes → a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e o
parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` permanecem **OPEN**. _(Histórico: 🟡 IMPLEMENTED / HOLD
YALA antes do reseal.)_

## Fila restante para fechar 0113 (13 entradas)

- **MONEY → IA-DINHEIRO (8):** event-rfq[stale/W6], purchase-order[stale], service-payment-request[stale],
  accounts-payable, accounts-receivable, organizers, store-onboarding, services-discovery,
  unifycard-method *(unifycard-method é money: fee de aquisição/settlement)*.
- **H_FALSE_POSITIVE c/ guard not-authority (2):** feed-plugin, business-authorization.
- **C_CONTAIN ghost própria (2):** automation (9 rotas mistas; run-due já 403), human-mvp (vertical G10/produto).
  *(Nota: a lista de 13 = 15 − plan − contact; os itens acima somam o denominador vivo do parent.)*
