# Execution Log — F-INVENTORY-COMPANY-CONSOLIDATED-AUTHORITY-IMPL · consolidado empresarial autorizado

**Data:** 2026-06-10
**Frente:** `F-INVENTORY-COMPANY-CONSOLIDATED-AUTHORITY-IMPL`
**HEAD origem:** `7c76cfb5` · **Branch:** `rescue-structural` · **dev:** 365 → **366**
**Modo:** DOCS + MIGRATION + BACKEND + E2E
**Governado por:** DECISION-0116 (ADENDO A1, promulgado nesta fatia) + DECISION-0113 (sujeito server-side) + Decisões 1 e 2 de Clayton (2026-06-10)

---

## 1. Decisões de Clayton implementadas

**D1 — Autoridade do consolidado:** permissão específica `company_users.can_view_consolidated_inventory` (BOOLEAN NOT NULL DEFAULT FALSE). Autorização da projeção = vínculo ATIVO em company_users com `can_manage_company=true` (≡ `canManageCompany`, incl. `role='owner'`) OU `can_view_consolidated_inventory=true`. Mesmo tenant NÃO autoriza; `can_manage_marketplace` NÃO autoriza; role textual NÃO autoriza; sem R2/actor_delegations; sem FASE 6/RBAC stub. Owner material do estoque permanece `inventory_movements.actor_id`.

**D2 — Actor elegível empresarial:** critério canônico = `actors.company_id IS NOT NULL` (vínculo material). NÃO liberar `actor_type='page'` genérico. Legado `actor_type='company'` preservado sem regressão.

## 2. Fail-first (capturado ANTES da implementação)

`failfirstprobe-consolidated.ts` (temporário, deletado):
1. `GET /marketplace/inventory/company/:id/balance` → **400 "ActionContext is required"** (rota inexistente atrás do middleware; sem implementação por baixo).
2. Page-actor com `company_id` (sem atividade comercial) → **FALHA** `assertInventoryUnitActorEligible` ("não elegível como unidade de estoque").
3. Coluna `can_view_consolidated_inventory` → **AUSENTE** (information_schema).

## 3. Migration

`backend/migrations/20260610120000_add_company_users_can_view_consolidated_inventory.sql`
- `ALTER TABLE company_users ADD COLUMN IF NOT EXISTS can_view_consolidated_inventory BOOLEAN NOT NULL DEFAULT FALSE;`
- Aplicada pelo runner canônico (`pnpm run migrate`); `schema_migrations` = 366; numeração única OK (gate); sem backfill (admins já autorizados via `can_manage_company`); sem view/constraint dependente (verificado antes).

Schema final de `company_users` (colunas de autoridade): `role`, `can_manage_company`, `can_manage_financial`, `can_manage_employees`, `can_view_reports`, `can_manage_services`, **`can_view_consolidated_inventory`**, `is_active`, `is_primary`, `member_status`.

## 4. Backend

| Peça | Arquivo | Conteúdo |
|------|---------|----------|
| Tipos | `companies.types.ts` | `CompanyPermissions.canViewConsolidatedInventory` |
| SELECTs/mappers | `companies.service.ts` | 4 readers explícitos de company_users + INSERT do createCompany (criador nasce com flag FALSE — can_manage_company já autoriza) |
| Autorizador | `companies.service.ts::canViewConsolidatedInventory` | `(can_manage_company OR role='owner' OR can_view_consolidated_inventory)` + `is_active AND member_status='active'`; fail-closed |
| Writer | `companies.service.ts::setConsolidatedInventoryPermission` | gate `canManageCompany(caller)`; UPDATE de campo ÚNICO (não toca can_manage_company); 403/404 |
| Rota de concessão | `companies.routes.ts` | `PUT /companies/:companyId/users/:companyUserId/consolidated-inventory-permission` body `{canViewConsolidatedInventory: boolean}` |
| Eligibility | `inventory-unit-actor.ts` | `a.company_id IS NOT NULL` adicionado; legado `'company'` + critérios comerciais preservados |
| Repo | `inventory-movement.repository.ts::calculateConsolidatedBalanceByCompany` | CTE `company_actors` (`WHERE tenant_id=$1 AND company_id=$3`) + agregação `actor_id IN (SELECT id FROM company_actors)` + `actor_count` — uma query, nunca tenant-wide |
| Service | `inventory.service.ts::getCompanyConsolidatedBalance` | valida variante (disciplina dos irmãos); delega ao repo |
| Rota consolidada | `marketplace-inventory.routes.ts` | `GET /inventory/company/:companyId/balance?variantId=X` (full: `/marketplace/...`) |

**Contrato da rota consolidada:** 401 sem auth · 400 companyId não-UUID · 400 sem variantId · **400 se `actorId`/`actorIds` na query** (conjunto é server-side) · 403 fail-closed sem vínculo/sem autoridade/empresa inexistente · 200 `{companyId, productVariantId, consolidatedQuantity, unit, actorCount, resolvedAt}` · zero explícito sem actors (sem fallback tenant-wide) · GET não cria actor.

**Identidade do caller:** `req.user.globalUserId` do token quando presente; senão `resolveGlobalUserId(userId, tenantId)` fail-closed (mesmo padrão do binding 0113).

**Nota de posição:** a rota nova vive ao FIM do arquivo de rotas — o E2E selado f6-5-c3 (B7) sela a vizinhança byte-a-byte entre os comentários das rotas legadas (`sliceBetween`); inserir entre elas quebrava o slice sem tocar nas rotas.

**Auto-concessão vedada por desenho:** o campo NÃO foi adicionado ao zod do PUT genérico self-scoped nem a `UpdateCompanyUserInput` — concessão SÓ pelo writer admin-gated.

## 5. Descoberta material (DT nova, NÃO corrigida nesta fatia)

`DT-COMPANY-USERS-SELF-UPDATE-PERMISSION-ESCALATION` (OPEN): o `PUT /companies/:companyId/users/:companyUserId` existente atualiza apenas o PRÓPRIO vínculo (`WHERE global_user_id = caller`) mas aceita `permissions.canManageCompany` → **qualquer membro pode se auto-promover a admin geral**. Pré-existente; não ampliada (flag nova fora do caminho); correção em fatia própria.

## 6. Prova (E2E 39/39)

`validate-pipeline-e2e-inventory-company-consolidated-authority.ts` — HTTP real (`fastify.inject`, stack auth+tenant+actionContext+rbac+marketplace+companies).

Fixtures: empresas E+F · users A (admin E) / B (flag E) / C (membro E sem flags) / D (admin F) · actors EA1 (page, company E) / EA2 (channel, company E — `uq_actors_company_page` impede 2º page) / FB1 (page, company F) / H (page sem company_id) · variante V · movimentos IN: EA1=10, EA2=7, FB1=100, H=55.

- **A1–A9:** A vê 17 (EA1+EA2; exclui FB1 e H); actorCount=2; shape completo; B com flag vê 17; C → 403; D→E 403; A→F 403.
- **B1–B6:** actorId na query → 400; actorIds → 400; sem auth → 401; empresa fantasma → 403; sem variantId → 400; companyId inválido → 400.
- **C1:** GET não cria actor/membership/permissão/movimento (counts before==after).
- **D1–D3:** admin mantém com flag=false; B perde com flag=false; B perde com membership inativa.
- **E1–E8:** C não se auto-concede (403, flag intacta); admin de F não concede em E (403); A concede a C (200 → C vê); A revoga (200 → C 403); writer não toca can_manage_company.
- **F1–F3:** page com company_id elegível; channel com company_id elegível; page novo SEM company_id e sem atividade NÃO elegível pelo tipo.
- **G1–G8:** nível 1 preservado (canRepresentActor A→EA1 + by-actor=10); estruturais (gate certo, sem requirePermission como autoridade, CTE server-side, eligibility correta, sem Bank, rota legada preservada).
- **H1:** cleanup zero leftovers (por MARKER, idempotente entre runs; movements via `session_replication_role=replica` em client dedicado — invariante append-only intacto em runtime).

## 7. Gates e regressões

| Gate | Resultado |
|------|-----------|
| `tsc --noEmit` | OK — 2 pré-existentes geo-enrichment (baseline) |
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] |
| `validate:regression-guards` | OK — 366 migrations, numeração única, sufixos válidos |
| `validate-architectural-patterns --strict` | `critical_new=0` (warning_new=1 pré-existente) |
| `validate:system-state:strict` | PASS |

| Regressão | Resultado |
|-----------|-----------|
| inventory actorId authority f6-5-c3 | 12/12 |
| marketplace actor-target f6-5-c3 | 16/16 |
| company-members read authority f6-5-5 | 7/7 |
| pj-company-user-role-vocabulary (creator authority) | 7/7 |
| x-actor-id-resolver-bind (0113) | 9/9 |
| groups-mine auth-derived-user | 26/26 |
| E2E novo consolidado | **39/39** |
| atomic-company-birth | N/A em dev — guarda intencional (só DB efêmera) |
| company-two-moments | N/A — CNPJ harness sem dígito verificador, pré-existente (provado via stash no HEAD limpo) |

## 8. DTs

- `DT-INVENTORY-COMPANY-CONSOLIDATED-MISSING-ROUTE` — **CLOSED** (rota criada).
- `DT-INVENTORY-UNIT-ACTOR-ELIGIBILITY-VOCABULARY-DRIFT` — **CLOSED** (D2 implementada).
- `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` — **segue OPEN** + atualização registrada: a rota nova NÃO resolve os readers tenant-wide legados; seguem no denominador Classe A com caller frontend vivo.
- `DT-COMPANY-USERS-SELF-UPDATE-PERMISSION-ESCALATION` — **NOVA, OPEN** (§5).

## 9. Escopo intocado / STOPs

Bank/ledger/wallet/payout/split/settlement · suppliers · contacts · purchase-orders · escrow · finance-agenda · daily-metrics · `/groups/mine` · R2/actor_delegations (não ampliado; a delegação interna do company-members.service pré-existente não foi tocada) · FASE 6 · frontend (zero UI; tipos frontend intactos — campo extra no payload não quebra compilação) · rotas tenant-wide legadas de inventory (STOP explícito — não transformadas em consolidado). **C1/tenant compartilhado NÃO liberado. DECISION-0113 NÃO fechada. Denominador global NÃO fechado.**

## 10. Próxima fatia

1. Migrar callers frontend (`getBalance`/`getMovements` em `api/marketplace.ts`) → rota consolidada/by-actor + tombstone/reconciliar os readers tenant-wide antigos (fecha o resíduo da DT ITEMIZED-CROSSCOMPANY-SCOPE no eixo balance).
2. Decisão de escopo (a/b/c/d) para `movements` sem actorId.
3. `DT-COMPANY-USERS-SELF-UPDATE-PERMISSION-ESCALATION` em fatia própria.
4. UI de gestão da permissão (frontend, fatia futura).

HOLD — aguardando reseal da Yala.
