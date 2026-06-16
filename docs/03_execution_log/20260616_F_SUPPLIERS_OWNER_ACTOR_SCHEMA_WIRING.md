# 2026-06-16 — F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING

Materializa **DECISION-0133** (suppliers company-owned via `owner_actor_id`) em schema + runtime + authority.
Parent `7e13fb5c` · branch `rescue-structural` · dev **389 → 390** (1 migration). Espelha o precedente
`F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING` (`purchase_orders.owner_actor_id`).

## Declaração antes do patch

- **Domínio:** suppliers ownership wiring (schema + runtime + authority).
- **Docs lidos:** DECISION-0133, supplier.{routes,service,repository,types}, PO owner precedent (routes/migration),
  `accounts-payable.service` (uso de supplier), `canRepresentActor` (authorizationService), schema vivo de suppliers.
- **Suficiente porque:** o precedente PO é mirror direto; a superfície de suppliers é pequena (create/list/get; sem
  rotas update/delete); AP usa supplier como existência/contraparte (autoridade vem do PO owner) → inalterado.
- **SSOT afetado:** `suppliers` (`owner_actor_id` = owner material / authority). **NÃO é SSOT:** `created_by_actor_id`
  (audit), `tenant_id` (escopo), `purchase_orders.supplier_id` (contraparte — intocado).
- **row_count suppliers (pré):** **0** → `NOT NULL` seguro, sem backfill.
- **FKs (pré):** `created_by_actor_id→actors(id) RESTRICT`, `tenant_id→tenants(id) CASCADE`; referenciada por
  `purchase_orders.supplier_id→suppliers(id) RESTRICT`. **Índices (pré):** pkey, `uidx_suppliers_code`,
  `idx_suppliers_tenant`, `idx_suppliers_status`.
- **Callers vivos:** `accounts-payable.service` (getSupplierById = existência/contraparte), `marketplace.routes`
  (registra a rota). Nenhum importa `supplierRepository` como autoridade tenant-only.
- **Plano migration:** ADD `owner_actor_id uuid NOT NULL` + FK→actors RESTRICT + índice `(tenant_id, owner_actor_id)`.
- **Plano runtime:** route-level `isOrgActor` + `canRepresentActor` (create/list/get); service exige owner; repo expõe
  owner; AP getById permanece puro.
- **Plano testes:** e2e cross-company same-tenant + guard + neg-proof.
- **STOPs avaliados:** row_count>0 (não — =0) · sem rotas update/delete (skip) · AP não regredido (contraparte) ·
  org-actor DB constraint (app-level + DT hardening) · status enum mismatch (residuo pré-existente, fora de escopo).

## Migration (`20260616130000_suppliers_owner_actor_id.sql`, dev 389→390)

`ADD COLUMN IF NOT EXISTS owner_actor_id uuid` · FK `fk_suppliers_owner_actor → actors(id) ON DELETE RESTRICT`
(DO-block idempotente) · `SET NOT NULL` (seguro, row_count=0; fail-closed se houvesse órfã, sem backfill) ·
`CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_owner (tenant_id, owner_actor_id)`. **SEM** alterar
created_by/tenant/status · **SEM** tocar `purchase_orders.supplier_id` · **SEM** RLS. **Catálogo pós verificado:**
owner_actor_id uuid NOT NULL ✓ · FK ✓ · índice ✓ · created_by_actor_id intacto ✓ · PO.supplier_id FK inalterado ✓.

## Runtime (espelha PO owner)

- **`supplier.routes.ts`:** helpers `isOrgActor(tenantId, actorId)` (SELECT actor_type, company_id →
  `actor_type='page' && company_id!=null`) + `loadAndAuthorizeSupplier` (getById → 404; `canRepresentActor(owner)` →
  403). **POST**: `req.user.userId` (401) → ownerHint=`body.ownerActorId || actionContext.actorId` → `isOrgActor`
  (403, TRAVA organizacional) → `canRepresentActor` (403) → `createSupplier` com `ownerActorId=ownerHint`,
  createdByActorId=`actionContext.actorId` (autoria, NÃO autoridade). **GET list**: filtra por
  `canRepresentActor(ownerActorId)` (dedup cache; tenant-only NÃO basta). **GET :id**: loadAndAuthorize.
- **`supplier.service.ts`:** `createSupplier` exige `SUPPLIER_OWNER_REQUIRED` (defesa em profundidade) e repassa
  `ownerActorId` ao repo. list/get permanecem leitura pura (a rota é a camada de autoridade) — `getSupplierById`
  continua usável por AP como existência/contraparte.
- **`supplier.repository.ts` / `.types.ts`:** `owner_actor_id`/`ownerActorId` no row/mapper/INSERT($16)/SELECT;
  `Supplier.ownerActorId` + `CreateSupplierInput.ownerActorId?` (hint).
- **NÃO tocado:** accounts-payable (getSupplierById puro/contraparte) · purchase_orders · `supplier_id` semantics.

## Provas

| Prova | Resultado |
| --- | --- |
| backend typecheck (build) | **25** (baseline; 0 em supplier) |
| migration | dev 389→390; catálogo pós verificado |
| e2e efêmero `validate-pipeline-e2e-supplier-owner-authority.ts` | **12/12** |
| guard `audit-supplier-owner-authority.mjs` (no chain) | GATE OK |
| negative-proof | **7 mordidas** byte-idêntico (sem-org/sem-canRepresentActor/body-owner/created_by-owner/service-sem-owner/migration-quebrada/repo-sem-owner) |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards | rc=0 (+1 guard) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 |

E2E cobre (cross-company SAME-TENANT): T1 create owner-representável 201 + ownerActorId=page-actor + created_by=Alice ·
T2 spoof owner B (não representável) 403 · T3 owner=actor humano 403 · T4 não-representante 403 · T5 Bob cria de B ·
T6/T6b LIST isolado (Alice só A, Bob só B; tenant comum não vaza) · T7 GET A por Alice 200 · T7b GET A por Bob
(mesmo tenant) 403 · T8 GET B por Alice 403 · T9 created_by_actor_id NÃO autoriza (Carol=created_by mas não representa
o owner A → 403) · T10 owner_actor_id é a única authority.

## DT / Residuos

- **DT-SUPPLIERS-OWNER-ACTOR-WIRING:** **CLOSED/materializada** (leak Classe-A de suppliers FECHADO).
- **DT-SUPPLIERS-OWNER-ORG-ACTOR-DB-CONSTRAINT-HARDENING (OPEN):** org-actor (page+company_id) validado **app-level**
  (isOrgActor); FK garante existência; CHECK/trigger DB futuro = reforço, não substituto. Não bloqueante.
- **DT-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH (OPEN, residuo pré-existente):** `suppliers_status_check` = lowercase
  `{active,inactive}` vs type/default `'ACTIVE'`. Latente (row_count era 0). NÃO corrigido (fora de ownership; e2e
  isola com `status:'active'`).

## Escopo negativo (confirmado)

ZERO contacts · ZERO Bank/Core/ledger/payout/split/recovery · ZERO RLS aplicada · ZERO RBAC/FASE 6 · ZERO AP redesign ·
ZERO PO redesign · ZERO alteração de `supplier_id` semantics · ZERO `company_id` 2ª verdade · ZERO backfill · ZERO
cargo/delegação/actor_delegations · ZERO contactService/contactRepository.

## Estado

**IMPLEMENTED / HOLD PARA RESEAL.** Fecha SÓ como **F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING**: `suppliers` é
**company-owned material** (`owner_actor_id` NOT NULL = page/company actor da empresa dona, FK→actors); create/list/get
exigem `canRepresentActor(owner_actor_id)`; `created_by_actor_id`/`tenant_id`/`supplier_id` não autorizam;
cross-company same-tenant isolado. DECISION-0133 materializada. dev 390.
