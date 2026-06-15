# 2026-06-15 — ONDA DECISION-0131 · F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING

Materializar o OWNER EMPRESARIAL de `purchase_order` via `owner_actor_id` = **actor operacional da empresa COMPRADORA**
(lado comprador), e vincular toda operação da PO à representabilidade desse owner. Parent `522b2059` · branch
`rescue-structural` · dev **386 → 387** (1 migration). **Decisão Clayton:** PO pertence ao lado comprador;
`owner_actor_id` = actor organizacional; `created_by_actor_id` = autoria histórica, NUNCA autoridade; `supplier_id` =
contraparte/credor, NUNCA owner; `tenant_id` = escopo, NUNCA owner; `company_id` **não entra** (deriva-se de
`owner_actor_id`, evitando dupla verdade). **TRAVA:** `owner_actor_id` deve apontar p/ actor **organizacional**
(`actor_type='page' AND company_id IS NOT NULL`), nunca humano/person/user. **receivePO CONTINUA MORTO.**

## READ-FIRST (1ª mão)

- **Ambiguidade page/company/actor_organizational resolvida (workflow READ-ONLY):** o actor operacional vivo de empresa é
  canonicamente **`actor_type='page' AND company_id IS NOT NULL`** (§4.38 normativo). `actor_organizational` (§3.1) é a
  abstração de autoridade (coluna distinta), `company` é legado/`entity_type` — **não** são o tipo operacional vivo.
  Sem ambiguidade material → não houve STOP.
- **Schema vivo de `purchase_orders`:** tinha `tenant_id`/`created_by_actor_id`/`supplier_id`; **NÃO** `owner_actor_id`/
  `company_id`/`company_actor_id`/`received_by_actor_id`. **`row_count=0`** (NOT NULL seguro; create passa a setar no mesmo
  commit), **0** FK pré-existente p/ owner, `actors.id` = uuid PK. → migration segura, **sem backfill**.
- **canRepresentActor (DECISION-0113):** caminho empresa = `actor.company_id` setado → `resolveGlobalUserId(userId,tenant)`
  → `canManageCompany` (company_users: `can_manage_company OR role='owner'`, ativo). É o binding canônico p/ provar que
  `req.user` representa o owner empresarial. Todos os métodos do service são chamados **apenas** por `purchase-order.routes.ts`
  → autoridade vai na rota (binding) + service exige owner (integridade).

## Migration (forward-only · idempotente · `20260615210000_purchase_orders_owner_actor_id.sql`)

`ADD COLUMN IF NOT EXISTS owner_actor_id uuid` · FK `fk_purchase_orders_owner_actor → actors(id)` em DO-block
`IF NOT EXISTS pg_constraint` · `SET NOT NULL` (seguro com row_count=0; fail-closed se houvesse linha órfã, sem backfill) ·
`CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_owner (tenant_id, owner_actor_id)`. **SEM** `company_id` ·
**SEM** `received_by_actor_id` · **SEM** RLS · **SEM** trigger · **SEM** alterar `created_by_actor_id`/`supplier_id`/
status/lifecycle · **SEM** tocar inventory/AP/Bank. Aplicada em dev (386 → 387).

## Correção (runtime cirúrgico)

- **`purchase-order.types.ts`:** `ownerActorId: string` em `PurchaseOrder`; `ownerActorId?: string` em `CreatePurchaseOrderInput`.
- **`purchase-order.repository.ts`:** `owner_actor_id` em `PurchaseOrderRow` + `toPurchaseOrder` (`ownerActorId`) +
  `poSelectList`; `createPurchaseOrder` recebe `ownerActorId` e o INSERE (coluna `owner_actor_id`).
- **`purchase-order.service.ts`:** `createPO` lança `AppError(400, …, 'PURCHASE_ORDER_OWNER_REQUIRED')` se faltar
  `input.ownerActorId` e o repassa ao repo (integridade — nunca cria PO sem owner). `receivePO` **inalterado** (segue
  hard-stop 403 `PURCHASE_ORDER_RECEIVE_CONTAINED` da frente anterior; impl material em `receivePOContainedImpl` não chamado).
- **`purchase-order.routes.ts`:** helpers `isOrgActor(tenantId, actorId)` (SELECT `actor_type`,`company_id` →
  `actor_type==='page' && company_id!=null`) e `loadAndAuthorizePO(reply, tenantId, userId, orderId)` (getPOById → 404;
  `canRepresentActor(owner)` → 403). **POST create:** `req.user.userId` (401) → `ownerHint = body.ownerActorId ||
  actionContext.actorId` → `isOrgActor` (403, TRAVA organizacional) → `canRepresentActor(owner)` (403) → `createPO`
  com `ownerActorId=ownerHint`, `createdByActorId=actionContext.actorId` (autoria, não autoridade). **GET list:** filtra
  por `canRepresentActor(owner)` (tenant-only NÃO basta), com cache de dedup. **GET :id · GET :id/items · POST :id/items ·
  POST :id/submit · POST :id/cancel:** via `loadAndAuthorizePO`. **POST :id/receive:** 403 CONTAINED inalterado.
- **NÃO tocado:** receivePO funcional · inventory IN/authority · accounts payable · Bank/Core/ledger/split ·
  `company_id`/`received_by_actor_id` na PO · RLS/trigger.

## Provas

- **Guard** `audit-po-owner-authority.mjs` (no chain): owner empresarial (page+company_id) validado · ≥3 `canRepresentActor`
  (create/reads/mutações/list) · `loadAndAuthorizePO` · `listPOs` · sem `addMovement`/`bank_*` · receivePO ainda 403 ·
  service exige `PURCHASE_ORDER_OWNER_REQUIRED`/`input.ownerActorId` · migration com `owner_actor_id` + `REFERENCES actors(id)`
  + índice. GATE OK.
- **Negative-proof** `negative-proof-po-owner-authority.ps1`: **6 mordidas** byte-idêntico (SHA256 restore) — sem-org ·
  sem-canRepresentActor · service-sem-owner-required · bank-touch · receive-descontido · migration-quebrada.
- **E2E** `validate-pipeline-e2e-po-owner-authority.ts` (DB efêmera, MIGRATION_PROFILE=FULL): **17/17** — T1 owner=empresa
  representável → 201 · T2 owner=humano(user) → 403 (TRAVA organizacional) · T3 owner de outro tenant → 403 · T4 owner=empresa
  não representável → 403 · T5 spoof owner alheio → 403 · T6/T9 GET by id terceiro → 403 · T10 GET items → 403 · T11 POST item
  → 403 · T12 submit → 403 · T13 cancel terceiro → 403 · T8 list: terceiro não vê PO de owner não representável · T8b list:
  owner-representante VÊ · T13b cancel pelo representante → 200 · T14 receivePO segue 403 CONTAINED · T15 zero
  inventory_movements · T16 Bank/ledger/split intocados · T17 accounts_payable não religado.

| Prova | Resultado |
| --- | --- |
| audit-po-owner-authority guard | GATE OK |
| negative-proof | 6 mordidas; byte-idêntico (SHA256) |
| e2e (efêmero) | **17/17** |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (+1 guard) |
| validate:architectural (--strict) | total 35 baseline · **0 atribuível** (REGRA 2/3 perfil, sem purchase-order/owner_actor) |
| tsc | build **25** · strict **43** (0 atribuível a purchase-order) |
| migration | dev 386 → 387; idempotente; forward-only |

## DT

- **DT-PO-RECEIVE-COMPANY-OWNER-PENDING** (atualizada): ✅ owner empresarial **MATERIALIZADO** (`owner_actor_id`, page+company_id,
  `canRepresentActor` em toda operação). receivePO **continua contido** (403) — a reabilitação funcional do recebimento
  (inventory IN + AP) é **frente futura própria**, agora podendo derivar a autoridade do owner empresarial, NUNCA de
  `created_by_actor_id`.

## NÃO FECHADO

receivePO funcional · inventory IN/authority · accounts payable · Bank/Core/ledger/split · AP/AR · `company_id`/
`received_by_actor_id` na PO · RLS · C1_MONEY inteiro · pedido/booking econômico/R2/FASE 6. A frente entrega **apenas** o
owner empresarial material + binding de representabilidade; movimento de dinheiro/estoque continua morto.

## Estado

**IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING**: `purchase_order` passou a
ter **owner empresarial material** (`owner_actor_id` = actor operacional page+company_id da empresa compradora, FK→actors,
NOT NULL); toda operação (create/list/read/items/submit/cancel) exige `req.user` **representar** o owner via
`canRepresentActor`; `created_by_actor_id`/`supplier_id`/`tenant_id` **não autorizam**; TRAVA organizacional barra
owner humano. receivePO segue **morto** (403). Zero dinheiro/estoque. dev 387.
