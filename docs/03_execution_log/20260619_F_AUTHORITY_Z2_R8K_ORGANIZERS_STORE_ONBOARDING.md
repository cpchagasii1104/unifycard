# 2026-06-19 — R8K ORGANIZERS CONTAINMENT + STORE-ONBOARDING BIND (macrofrente, cirúrgico)

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

**🟡 IMPLEMENTED / HOLD YALA**. organizers billing/subscription → **CONTAINED (501 / webhook no-op) / HOLD YALA**;
organizers file → **PARTIAL / REMAINDER NON-MONEY ROUTES** (create/add-member/link-event). store-onboarding →
**BOUND (canRepresentActor) / HOLD YALA** (removido do baseline). `DT-AUTHORITY-Z2-ORGANIZER-BILLING-SCHEMA-GHOST`
→ IMPLEMENTED_AS_CONTAINED / HOLD YALA; `DT-AUTHORITY-Z2-STORE-ONBOARDING-CATALOG-ACTOR-UNBOUND` →
IMPLEMENTED_AS_BOUND / HOLD YALA. DT-mãe 0113 + parent canal-1 OPEN (baseline 6). Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (6 entradas)

- **MONEY → IA-DINHEIRO (2):** services-discovery [PARTIAL — rotas não-money], unifycard-method.
- **READ-SENSITIVE / OWN FRONT (1):** business-authorization.
- **C_CONTAIN ghost própria / produto (2):** automation, human-mvp (G10).
- **organizers [PARTIAL]:** create/add-member/link-event (event-organizer authority) — frente própria.
- _(Residual: organizer billing SaaS-vs-split decision; event_settlements ghost; CRM accounts_receivable;
  DECISION-0110/0114 D5.)_
