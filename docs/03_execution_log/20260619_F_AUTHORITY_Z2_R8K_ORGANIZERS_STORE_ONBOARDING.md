# 2026-06-19 — R8K ORGANIZERS CONTAINMENT + STORE-ONBOARDING BIND (macrofrente, cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `387a1313`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL**. Estados:
> `DT-ORGANIZER-BILLING-SCHEMA-GHOST` + organizer billing/subscription → **CLOSED_AS_CONTAINED / YALA
> PASS_WITH_WARNINGS MATERIAL**; organizers file → **PARTIAL / REMAINDER EVENT-ORGANIZER AUTHORITY**;
> `DT-STORE-ONBOARDING-CATALOG-ACTOR-UNBOUND` + store-onboarding → **CLOSED / BOUND / YALA PASS_WITH_WARNINGS
> MATERIAL**. **Yala confirmou materialmente:** HEAD 387a1313 · branch rescue-structural · migrations 394/394 · sem
> migration/schema; diff 11 arquivos, runtime `.ts` só em organizers.routes.ts + store-onboarding.routes.ts; nenhum
> service/billing/stripe/settlement/bank file alterado; zero Bank/Core/bank_ledger/bank_transactions/bank_splits/
> payout/recovery/settlement; event-settlement canônico (events.actor_id + canRepresentActor) INTOCADO; zero
> services-discovery/unifycard-method/business-authorization/automation/human-mvp; zero decisão SaaS-vs-split; zero
> reativação de billing; catálogo não virou financeiro; price_cents BIGINT preservado. **Schema-ghost confirmado em
> dev:** event_organizers existe (com actor_id) mas plan/plan_expires_at AUSENTES; organizer_subscriptions existe com
> schema canônico ≠ do que organizer-billing.service escrevia → plan/subscribe/cancel/subscribe-stripe/subscription
> dead-at-db → containment sem migration apropriado. **organizer billing (5 rotas contidas — /:id/plan · /:id/
> subscribe · /:id/subscription/cancel · /:id/subscription · /:id/subscribe/stripe):** 501
> ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED antes de service/sink (handlers `_req`; zero organizerBillingService/
> stripeService/Stripe/pool/runQueryWithTenant/coluna-ghost/organizer_subscriptions-write/bank_*). **Webhook
> /webhooks/stripe:** no-op ACK 200 contained (não chama renew/updateSubscriptionStatus; zero escrita; evita retry
> storm). **store-onboarding (BOUND):** boundStoreActorId = data.actorId ?? importerActorId; subjectUserId =
> req.user?.id; 401 se ausente; canRepresentActor(tenantId, subjectUserId, boundStoreActorId) antes da escrita; 403
> STORE_ONBOARDING_ACTOR_AUTHORITY_REQUIRED se false; input.actorId = actor provado; requirePermission legado
> preservado (não é mais a única autoridade); category guard DECISION-0108 + idempotência UNIQUE preservados; saiu do
> baseline. **Guards** `audit-organizer-billing-ghost-containment.mjs` + `audit-store-onboarding-actor-bind.mjs`
> wired+GREEN. **E2E DB-free** validate-pipeline-e2e-r8k-organizers-store **10/10**. **Gates Yala:** actor-writer OK ·
> bank-ledger OK · regression-guards **66 GATE OK / 0 FAIL** · arch critical_new=0 · check:migrations 394/394 · tsc
> baseline 43. **Baseline 7→6** (flagged 6 · new=0 · stale 0 · safe_subject 6 · service_bound 4 · self_bound 1 ·
> not_authority 1 — store-onboarding fora, organizers PARTIAL). **DT-mãe 0113 + parent canal-1 OPEN (6>0).**
>
> **Warnings do reseal (não-bloqueantes):** **W1** — negative-proof não reexecutado pela Yala (muta source); validado
> estruturalmente + executora pwsh 7 & WPS 5.1 (reintroduzir organizerBillingService numa rota contida → FALHA;
> remover canRepresentActor do store-onboarding → FALHA; restauração byte-idêntica; git pré==pós). **W2** — working
> tree sujo fora do material → não é HOLD_WORKTREE_DIRTY. **W3** — E2E não exercita em runtime store-onboarding
> spoof→403 nem zero-write bank do store-onboarding; não bloqueia (guard dedicado cobre estruturalmente:
> canRepresentActor-before-write + 403 nomeado + zero bank_*); follow-up opcional = E2E runtime do bind em fatia
> futura. Seal = docs-only; HEAD material permanece `387a1313`. _(Detalhe IMPLEMENTED abaixo.)_

Dois itens do baseline canal-1 (DECISION-0113 / Z2): **organizers** = contenção decision-neutral do billing/
subscription quebrado (schema-ghost) + **store-onboarding** = bind de catálogo non-money com autoridade server-side.
**NÃO implementa pagamento, NÃO liga firewall, NÃO toca Bank/Core/ledger, NÃO decide SaaS-vs-split, NÃO toca
event-settlement canônico, NÃO cria migration.**

## Anchor / Pré-flight

HEAD inicial `3d5d20cd` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · working tree material limpo. Parent canal-1 OPEN baseline 7; DT-mãe 0113 OPEN.

## READ-FIRST — prova material (fan-out READ-ONLY 5 agentes + verificação em dev)

**organizers** — `event_organizers` existe com `actor_id` mas **`plan`/`plan_expires_at` NÃO existem** (migration
archive `0217` nunca aplicada). `organizer_subscriptions` existe com schema canônico **diferente** (id, tenant_id,
organizer_id, plan_id, status, starts_at, ends_at, amount_cents, bank_transaction_id) do que
`organizer-billing.service` escreve (archived `current_period_*`/`payment_gateway*`/`canceled_at` ausentes). Logo
TODO o cluster subscribe/cancel/subscribe-stripe/webhook escrevia colunas inexistentes (42703/dead). `POST /:id/
subscription/cancel` **não tinha autoridade alguma** (qualquer user do tenant cancelava qualquer organizer). Webhook
retornava 400 em falha → **retry storm da Stripe**. **`bank_refs`=NONE** (sem money path → STOP_CORE_MONEY_PATH_FOUND
não acionado). event-settlement canônico (events.actor_id + canRepresentActor) é **separado** e foi confirmado
intocado (event_settlements também é ghost, mas é residual de outra frente — NÃO tocado aqui).

**store-onboarding** — catálogo non-money: `product_offers.price_cents` BIGINT; category guard
`assertProductCategoryAllowedForCompany` (DECISION-0108); idempotência UNIQUE(tenant,product,merchant);
`bank_refs`=NONE. Autorização server-side (requireStorePermission → ensureUserActor(req.user.id) → requirePermission),
MAS o write `input.actorId = data.actorId ?? importerActorId` usava o **body actorId (client-declared)** como
merchant (`product_offers.merchant_id`) SEM provar representação → canal-1.

## Decisão por item

- **organizers → CONTAIN (decision-neutral, schema-ghost)**: subscribe/cancel/subscribe-stripe/plan/subscription →
  **501 `ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED`** antes de qualquer service/sink; **webhook → no-op ACK 200**
  `{contained}` (sem ghost-write, sem retry storm da Stripe). Removidos os 4 handlers de webhook + imports
  `organizerBillingService`/`stripeService`/`Stripe`/`pool`/`runQueryWithTenant` (órfãos). Preservados:
  create/add-member/link-event (core event-organizer), GET / · GET /:id · GET /plans. event-settlement intocado.
  NÃO decide SaaS-vs-split (frente/decisão própria).
- **store-onboarding → BIND (catálogo non-money)**: `canRepresentActor(tenantId, req.user.id, storeActorId)`
  fail-closed **403 `STORE_ONBOARDING_ACTOR_AUTHORITY_REQUIRED`** ANTES da escrita; `input.actorId` = store actor
  PROVADO; `data.actorId` (body) é só HINT validado. Preservados: requirePermission (papel), category guard
  DECISION-0108, price_cents BIGINT, idempotência.

## Baseline canal-1 — 7 → 6

- **store-onboarding REMOVIDO** (binding helper `canRepresentActor` presente + materialmente chamado; guard
  dedicado). 
- **organizers PERMANECE (PARTIAL)** — create/add-member/link-event ainda leem `actionContext.actorId` (core
  event-organizer, fora do escopo); o cluster billing foi contido mas o arquivo segue flagged. Bind dessas rotas =
  frente própria futura.
- Detector: **flagged 6 · baseline 6 · new=0 · stale 0** (safe_subject 6 · service_bound 4 · self_bound 1 ·
  not_authority 1). GATE OK.

## Prova material — guards + negative-proofs + E2E

- E2E DB-free `validate-pipeline-e2e-r8k-organizers-store.ts` → **10/10**: subscribe/cancel/subscribe-stripe/plan/
  subscription → 501 ghost; webhook → 200 contained (no-op); spoof actionContext → ainda 501; guards + baseline
  verdes. (Rotas contidas retornam antes de service/DB → registro DB-free.)
- Guards (wired em validate:regression-guards): `audit-organizer-billing-ghost-containment.mjs` (501 + webhook
  no-op + zero organizerBillingService/stripeService/coluna-ghost/bank_*/event-settlement) · `audit-store-
  onboarding-actor-bind.mjs` (canRepresentActor com subject=req.user + fail-closed nomeado + merchant provado +
  requirePermission preservado + zero bank_*).
- **Negative-proof versionado** `negative-proof-r8k-organizers-store.ps1` (ASCII/sem-BOM, pwsh 7 + WPS 5.1):
  (1) reintroduzir `organizerBillingService` numa rota contida → GATE FAIL; (2) remover `canRepresentActor` do
  store-onboarding → GATE FAIL; cada um restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+2 guards) ·
actor-authority-boundary **new=0** (baseline 7→6) · arch `--strict` **critical_new=0** (warning_new=4
pré-existente) · check:migrations **394/394** (sem migration) · tsc **43** (baseline; sem erro novo).

## Escopo negativo

NÃO decidiu SaaS-vs-split · NÃO criou migration/materializou plan/plan_expires_at · NÃO reativou organizer billing
· NÃO tocou event-settlement canônico · NÃO tocou services-discovery/unifycard-method/business-authorization/
automation/human-mvp · NÃO tocou Bank/bank_ledger/transactions/splits/payout/recovery/settlement · NÃO transformou
catálogo em financeiro · NÃO alterou DECISION-0110 · NÃO fecha DT-mãe 0113 nem parent canal-1 (6>0).

## Estado

**✅ CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material
`387a1313`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2-W3 não-bloqueantes — ver bloco SEAL
no topo). organizer billing/subscription → **CLOSED_AS_CONTAINED (501 / webhook no-op) / YALA PASS_WITH_WARNINGS
MATERIAL**; organizers file → **PARTIAL / REMAINDER EVENT-ORGANIZER AUTHORITY** (create/add-member/link-event;
permanece no baseline — correto). store-onboarding → **CLOSED / BOUND (canRepresentActor) / YALA PASS_WITH_WARNINGS
MATERIAL** (removido do baseline). `DT-AUTHORITY-Z2-ORGANIZER-BILLING-SCHEMA-GHOST` → **CLOSED_AS_CONTAINED**;
`DT-AUTHORITY-Z2-STORE-ONBOARDING-CATALOG-ACTOR-UNBOUND` → **CLOSED / BOUND**. **CLOSED_AS_CONTAINED ≠ reativação:**
billing segue desativado, SaaS-vs-split NÃO decidido. DT-mãe 0113 + parent canal-1 OPEN (baseline 6). _(Histórico:
🟡 IMPLEMENTED / HOLD YALA antes do reseal.)_

## Fila restante para fechar 0113 (6 entradas)

- **MONEY → IA-DINHEIRO (2):** services-discovery [PARTIAL — rotas não-money], unifycard-method.
- **READ-SENSITIVE / OWN FRONT (1):** business-authorization.
- **C_CONTAIN ghost própria / produto (2):** automation, human-mvp (G10).
- **organizers [PARTIAL]:** create/add-member/link-event (event-organizer authority) — frente própria.
- _(Residual: organizer billing SaaS-vs-split decision; event_settlements ghost; CRM accounts_receivable;
  DECISION-0110/0114 D5.)_
