# 2026-06-18 — R8E REMAINING CANAL-1 TRIAGE WAVE — triagem das 21 + onda controlada (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `65a2dce3`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (fechou a fatia
> executada — 6 entradas — mas deixou **15 entradas remanescentes**; **NÃO** fecha a DT-mãe 0113 nem o parent
> canal-1). **Estados por tipo:** as 4 reconciliações stale (**supplier · service-bundle · social.routes · votes**)
> → **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (reconciliação stale já guardada — NÃO containment); as 2
> contenções schema-ghost (**business-segment · tax-profile**) → **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS
> MATERIAL** (NÃO `CLOSED` simples — contenção por schema-ghost). **Yala confirmou materialmente:** HEAD 65a2dce3 ·
> branch rescue-structural · migrations 394/394 · diff de 10 arquivos; sem migration/schema; zero money executado;
> zero Bank/Core/ledger/splits/payout/recovery; zero AP/AR/purchase-order/service-payment-request; zero RBAC/FASE 6;
> zero actor_delegations/R2; zero decisão de produto; não fechou DT-mãe 0113 nem parent canal-1; lista das 21 +
> matriz A-H confirmadas; 6 entradas executadas (4 stale removals + 2 schema-ghost containments);
> `business_segments`/`tax_profiles` = schema-ghost (to_regclass=NULL; CREATE TABLE só em migrations_archive/0048 e
> /0072); zero frontend caller p/ business-segment e tax-profile; ambas as rotas → 501 nomeado ANTES de service/DB;
> guard da onda confirmado; **E2E DB-free 8/8 rodado pela Yala**; baseline reduzido honestamente **21→15** (flagged
> 14→12 · new=0 · stale_baseline 7→3 — os 3 restantes são money · safe_subject_recognized=6 ·
> service_bound_recognized=4); actor-authority-boundary OK · actor-writer-boundaries OK · bank-ledger-boundaries OK ·
> regression-guards OK · arch `--strict` critical_new=0 · tsc baseline 43; cartório correto; **DT-mãe 0113 e parent
> canal-1 seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> source); validado estruturalmente + executora declarou execução em **pwsh 7 e Windows PowerShell 5.1**. **W2** —
> working tree sujo fora do material (docs/memorias/untracked/artefatos) → não é HOLD_WORKTREE_DIRTY. **W3** — nas 4
> reconciliações stale, a Yala confiou em **guard dedicado WIRED+GREEN + detector new=0** (não reauditou linha-a-
> linha o biting interno dos guards supplier/service-bundle/votes nesta onda); mitigação: runtime intocado nessas 4
> entradas, guards dedicados wired em validate:regression-guards, regression-guards GREEN, detector live new=0 — se
> a remoção mascarasse canal-1 vivo, viraria newViolation e falharia.
>
> **Observação:** `unifycard-method` aparece em mais de uma leitura de risco (money-adjacent vs false-positive) —
> registrado como **DEFERIDO**, não executado nesta onda; não decidir money-adjacent vs false-positive sem frente
> própria. Seal = docs-only; HEAD material permanece `65a2dce3`. _(Detalhe IMPLEMENTED abaixo.)_

Onda controlada sobre as **21 entradas restantes** do parent canal-1 (`DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`,
DECISION-0113 / Z2). Triagem completa em matriz A–H (14 ativamente flagged via fan-out de 14 leitores read-only +
7 já-stale) e **execução em lote SOMENTE de quick wins seguras** (4 reconciliações de stale + 2 contenções
schema-ghost). Money/RBAC/produto/owner-ambíguo **NÃO executados** — viraram fila.

## Anchor / Pré-flight

HEAD inicial `9b81d389` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8A/R8C/R8D CLOSED_AS_CONTAINED · R8B CLOSED; parent canal-1
OPEN baseline 21; DT-mãe 0113 OPEN.

## Matriz de triagem — 21 entradas

**Já STALE (7; o detector já as eximia — binding/containment presente):**
| # | arquivo | situação | ação |
|---|---|---|---|
| event-rfq.routes.ts | R7a bound W1-W5 / R7b acceptQuote contido — **MONEY-ADJACENT** | LEAVE (money; guards próprios) |
| purchase-order.routes.ts | po-owner-authority — **MONEY** | LEAVE (money) |
| service-payment-request.routes.ts | spr-read-authority — **MONEY** | LEAVE (money) |
| supplier.routes.ts | supplier-owner-authority (bound) | **REMOVIDO** (A_RECONCILE) |
| service-bundle.routes.ts | service-bundle-write-authorship-binding (bound) | **REMOVIDO** (A_RECONCILE) |
| social.routes.ts | R8A legacy create contido; canal só em comentário | **REMOVIDO** (A_RECONCILE) |
| votes.routes.ts | votes-writes-containment (501) | **REMOVIDO** (A_RECONCILE) |

**Ativamente FLAGGED (14; fan-out de 14 Evidence Packs read-only):**
| arquivo | classe | tabela | ação nesta onda |
|---|---|---|---|
| core/authorization/business-authorization.routes.ts | H_FALSE_POSITIVE | ghost (business_audit_logs) | DEFER (read-only advisory + audit breadcrumb; precisa guard not-authority) |
| core/feed/feed-plugin.routes.ts | H_FALSE_POSITIVE | live (read-only) | DEFER (actorId é presence-gate; nunca chega a sink) |
| core/plan/plan.routes.ts | A_RECONCILE | (bound no service, self-only) | DEFER (bind vive no service; precisa SERVICE_BOUND-style guard) |
| modules/automation/automation.routes.ts | C_CONTAIN | ghost (alerts, scheduled_actions) | DEFER (9 rotas mistas; run-due já 403; frontend trata 500 → frente própria) |
| modules/events/organizers/organizers.routes.ts | D_MONEY_DEFER | live | DEFER → IA-DINHEIRO |
| modules/human-mvp/human-mvp.routes.ts | C_CONTAIN | ghost (user_skills/human_mvp_*) | DEFER (vertical humana G10 — produto; conter exige frente G10-aware) |
| modules/marketplace/accounts-payable.routes.ts | D_MONEY_DEFER | ghost | DEFER → IA-DINHEIRO |
| modules/marketplace/accounts-receivable.routes.ts | D_MONEY_DEFER | ghost | DEFER → IA-DINHEIRO |
| modules/marketplace/business-segment.routes.ts | C_CONTAIN | **ghost (business_segments)** | **EXECUTADO — contido 501** |
| modules/marketplace/contact.routes.ts | C_CONTAIN | ghost (contacts) | DEFER (já contido no service via assertContactsFeatureAvailable 501 + guard próprio; reconcile de baseline depois) |
| modules/marketplace/store-onboarding.routes.ts | D_MONEY_DEFER | live | DEFER → IA-DINHEIRO |
| modules/marketplace/tax-profile.routes.ts | C_CONTAIN | **ghost (tax_profiles)** | **EXECUTADO — contido 501** |
| modules/marketplace/unifycard-method.routes.ts | H_FALSE_POSITIVE | ghost | DEFER (actorId breadcrumb; write já gated por requireRole admin) |
| modules/services/services-discovery.routes.ts | A_RECONCILE→B_BIND | live | DEFER (precisa threadar req.user.userId no service; bind + E2E spoof própria) |

Verificação de substrato (read-only em unificard_dev, `to_regclass`): **GHOST(null)** confirmado para alerts,
scheduled_actions, business_segments, tax_profiles, contacts, user_skills_categories, human_mvp_*, plans,
service_requests — consistente com a lei histórica (features arquivadas em `migrations_archive/`).

## Executado nesta onda

**(a) 4 reconciliações de STALE (baseline hygiene, sem mudança de runtime):** removidas do BASELINE de
`audit-actor-authority-boundary.mjs` as entradas **supplier**, **service-bundle**, **social.routes**, **votes** —
cada uma já EXEMPT no detector (binding helper presente / contida / canal só em comentário) e coberta por guard
dedicado já em `validate:regression-guards` (audit-supplier-owner-authority · audit-service-bundle-write-
authorship-binding · audit-social-legacy-post-create-containment · audit-votes-writes-containment). Se o
binding/containment regredir, o guard dedicado falha. Não-mascaramento.

**(b) 2 contenções SCHEMA-GHOST (route-only, idêntico a R8C/R8D):** **business-segment** e **tax-profile** —
tabelas `business_segments`/`tax_profiles` ghost (só em migrations_archive/0048 e /0072; to_regclass=null) + zero
caller no frontend. As 3 rotas de cada (POST/GET/PATCH) passam a **501** (`BUSINESS_SEGMENT_SCHEMA_GHOST_CONTAINED`
/ `TAX_PROFILE_SCHEMA_GHOST_CONTAINED`) ANTES de qualquer service/DB; removidos imports service/types e o canal-1
(`actionContext.actorId`); rotas permanecem registradas; services/types intocados (dead code residual). Removidas
do BASELINE. **Sem migration, sem redesenho.**

## Baseline canal-1 — antes/depois

**21 → 15** (flagged 14→12 · baseline 21→15 · **new=0** · stale_baseline 7→3 · safe_subject_recognized 6 ·
service_bound_recognized 4). GATE OK. Os 3 stale restantes (event-rfq, purchase-order, service-payment-request)
são MONEY — mantidos (defer IA-DINHEIRO).

## Prova material

- E2E DB-free `validate-pipeline-e2e-canal1-ghost-wave-r8e-containment.ts` → **8/8** (6 endpoints business-segment/
  tax-profile → 501 com code nomeado + guards verdes; rotas contidas não importam pool/service → inject sem banco).
- Guard `audit-canal1-ghost-wave-r8e-containment.mjs` em `validate:regression-guards` (cada arquivo: 501 + code
  nomeado, ≥3 rotas, proíbe service/repository/tabela-ghost/actionContext.actorId).
- Negative-proof versionado `negative-proof-canal1-ghost-wave-r8e-containment.ps1` (ASCII/sem-BOM, pwsh 7 + WPS
  5.1): reintroduz `businessSegmentService.setSegment` + actionContext.actorId no POST → GATE FAIL exit 1 →
  restaura byte-idêntico → git inalterado → GATE OK.
- Triagem fan-out: 14 agentes read-only (Workflow `r8e-canal1-triage`) — Evidence Pack por arquivo.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
actor-authority-boundary **new=0** (baseline 21→15) · arch `--strict` **critical_new=0** (warning_new=4
pré-existente) · check:migrations **394/394** (sem migration) · tsc **43** (baseline, 0 novo).

## Escopo negativo

NÃO executou money (AP/AR/PO/SPR/organizers/store-onboarding/event-rfq) — fila IA-DINHEIRO · NÃO executou
human-mvp (produto/G10) · NÃO executou plan/services-discovery (bind próprio) · NÃO executou H_FALSE_POSITIVE
(feed-plugin/business-authorization/unifycard-method — precisam guard not-authority) · NÃO tocou Bank/Core/ledger/
splits/payout/recovery · RBAC/FASE 6 · actor_delegations/R2 · sem migration/schema · sem redesenho · NÃO fecha a
DT-mãe 0113 nem o parent canal-1 (baseline 15 > 0).

## Estado

**✅ CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material
`65a2dce3`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W3 + observação unifycard-method
registrados como follow-up não-bloqueante — ver bloco SEAL no topo). Onda R8E: 4 reconciliações stale + 2
contenções schema-ghost; **baseline 21→15**. **Estados por tipo:** supplier · service-bundle · social.routes ·
votes → **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (reconciliação stale, não containment); business-segment ·
tax-profile → **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (contenção schema-ghost). **A onda fechou
a fatia executada mas deixou 15 entradas remanescentes** → a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`
e o parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` permanecem **OPEN**. _(Histórico: 🟡 IMPLEMENTED / HOLD
YALA antes do reseal.)_

## Fila restante para fechar 0113 (15 entradas)

- **MONEY → IA-DINHEIRO (6):** event-rfq (stale, W6 acceptQuote), purchase-order (stale), service-payment-request
  (stale), accounts-payable, accounts-receivable, organizers, store-onboarding, unifycard-method (money-adjacent).
- **C_CONTAIN ghost própria (2):** automation (9 rotas mistas; run-due já 403), human-mvp (vertical G10 — produto).
- **A_RECONCILE/B_BIND próprias (2):** plan (bound no service — RECONCILE com guard), services-discovery (bind
  req.user.userId + E2E spoof).
- **H_FALSE_POSITIVE com guard not-authority (3):** feed-plugin, business-authorization, unifycard-method.
- **C_CONTAIN reconcile (1):** contact (já contido no service; só baseline reconcile).
