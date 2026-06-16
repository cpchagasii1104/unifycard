# 2026-06-16 — F-ACTOR-CAPABILITY-GRANTS-ENDPOINTS-SLICE-1B

Implementa os 3 endpoints HTTP de **gestão** de actor capability grants sobre o substrato do Slice 1A
(DECISION-0136). **NENHUM enforcement em rota de negócio.** Não-financeiro, sem UI. Autoridade = user
autenticado + actor operacional server-side + `canRepresentActor(userId, scopeActorId)`.

## Anchor / Pré-flight

HEAD inicial `f70f4b86` · branch `rescue-structural` · superfícies materiais LIMPAS · dev 391. STOP não disparado.

## READ-FIRST

DECISION-0134/0135/0136 + execution logs 1A/1A1 · STATUS · DT_LOG · `permission-keys.ts` (registry; intocado) ·
`business-permissions.types.ts` (confirmado: 2º vocabulário vivo — **NÃO tocado**) · `rbac.plugin` PermissionString
(3º vocabulário — **NÃO tocado**) · grant types/repository/service/lookup (Slice 1A) · migration (intocada) ·
`canRepresentActor`/`authorization.service` · `app.builder.ts` (registro de módulos sob protectedScope).

## Patch

- **`modules/authority/actor-capability-grant.routes.ts`** (novo): 3 endpoints sob prefixo `/authority`:
  - `POST /authority/grants` — cria grant. Resolve grantee server-side (slug via `resolveBySlug` fail-closed,
    OU actorId validado no tenant); concedente via `req.user.userId` + `actionContext.actorId`; gate de
    autoridade = `canRepresentActor(userId, scopeActorId)` (no service). `capabilityKey` validado por
    `z.enum(NON_FINANCIAL_CAPABILITY_ALLOWLIST)` (rejeita financeiro/desconhecido na borda). Grava actor_id,
    nunca slug. Duplicidade ativa → **409**; slug não resolvido → **404** fail-closed.
  - `GET /authority/grants` — **scopeActorId OBRIGATÓRIO** (sem listagem global; 400 se ausente); caller precisa
    `canRepresentActor(scopeActorId)` (403 senão); lista grants do scope.
  - `POST /authority/grants/:grantId/revoke` — revoga via **status** (não delete físico); caller representa o
    scope do grant (service valida); `revoked_by_actor_id` gravado.
- **`app.builder.ts`**: registro inline do módulo sob `protectedScope` (`/authority`).
- **Guard** `audit-actor-capability-grants-nonfinancial.mjs`: estendido (checks 4+6) — só a rota de gestão importa
  o service; `hasCapabilityGrant` proibido em qualquer rota; rota de gestão sem financeiro/referral/global/
  business-permissions/requirePermission/rbac/availability/DELETE-físico; `scopeActorId` obrigatório no GET.
- **NÃO tocado:** `permission-keys.ts` · `business-permissions.types.ts` · `rbac.plugin` · migration · grant
  service/repository/types/lookup (Slice 1A) · availability/calendar · frontend · financeiro/bank_ledger ·
  votes/organization/contextual-thread · `users.referral_code`.

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build / strict | **25 / 43** (baseline) |
| guard (estendido, na chain regression-guards) | **GATE OK** (checked=6) |
| neg-proof `negative-proof-...ps1` | **9 mordidas** (allowlist-financial · scope-global · drop-grantee-actor · types-financial · lookup-referral · pk-misalign · **ep-financial** · **ep-no-scope** · **ep-requirepermission**) + restauração byte-idêntica SHA256 |
| e2e efêmero endpoints `...-slice1b` (Fastify inject) | **15/15** |
| GATE actor-writer / bank-ledger | OK / OK |
| GATE regression-guards | rc=0 |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |

**e2e (15):** T1 POST slug→201 + grantee_actor_id=actor; T2 slug inexistente→404; T3 sem autoridade scope→403;
T4 capability financeira→400; T5 fora da allowlist→400; T6 duplicado ativo→409; T7 GET sem scope→400; T8 GET
scope representado→200+lista; T9 GET scope não-representado→403; T10 revoke não-representante→403; T11 revoke
representante→200+status=revoked (não delete); T12 cross-tenant→403; T-bank intocado; C1 sem delete físico;
C2 rota sem hasCapabilityGrant/requirePermission/referral/business-permissions.

## DT registrada

- **DT-PERMISSION-TRI-REGISTRY-RECONCILIATION** — OPEN / **BLOCKS_1C_NOT_1B**: 3 vocabulários vivos
  (`permission-keys.ts` × `business-permissions.types.ts` × `rbac.plugin` PermissionString); 1B usa só
  `permission-keys.ts`; reconciliação obrigatória **antes** do Slice 1C (enforcement).

## Escopo negativo (verificado)

ZERO enforcement em rota de negócio · ZERO `hasCapabilityGrant` em rota · ZERO availability/calendar · ZERO
`permission-keys.ts`/`business-permissions.types.ts`/`rbac.plugin`/migration tocados · ZERO financeiro/bank_ledger ·
ZERO frontend/UI · ZERO `users.referral_code` · ZERO grant global (`scope_type='actor'`) · ZERO delete físico ·
ZERO votes/organization/contextual-thread.

## R1 (Yala) — DEV MIGRATION MATERIALIZED (2026-06-16, F-ACTOR-CAPABILITY-GRANTS-DEV-MIGRATION-MATERIALIZATION)

Yala apontou no reseal do 1B a **ressalva R1**: o código passou, mas o substrato `actor_capability_grants`
**não estava aplicado** no `unificard_dev` vivo (`to_regclass`=NULL; migration `20260616210000` ausente de
`schema_migrations`; dev em 390; endpoints dariam 42P01 fora da DB efêmera).

**Verificação READ-ONLY (antes):** `current_database=unificard_dev`; `schema_migrations`=**390** (col `filename`);
última aplicada `20260616130000_suppliers_owner_actor_id.sql`; **PENDENTE = exatamente
`[20260616210000_create_actor_capability_grants.sql]`** (1 só, exatamente a alvo); `to_regclass`=NULL. Nenhum
STOP disparado (uma pendência, a correta; tabela ausente + não-registrada = consistente).

**Aplicação:** **somente** via runner canônico `src/core/db/migrate.ts` (profile CORE_ONLY) — 1 pendente
EXECUTADA: `20260616210000_create_actor_capability_grants.sql` (117ms). **Zero SQL manual; zero nova migration;
zero edição de migration; zero código.**

**Verificação (depois):** `to_regclass('public.actor_capability_grants')`=**actor_capability_grants** (existe);
`schema_migrations` contém `20260616210000`; dev count = **391**; **PENDING=[]**; `row_count=0` (sem backfill);
constraints `chk_acg_capability_nonfinancial`/`chk_acg_scope_type`/`chk_acg_status` + 5 FKs + pkey; índices
`uidx_actor_capability_grants_active` (unique parcial) + `idx_..._grantee` + `idx_..._scope`; **`bank_ledger`=0
(intocado)**. 4 gates verdes (actor-writer · bank-ledger · regression-guards · arch critical_new=0).

**Resultado:** **R1 CLOSED** — endpoints 1B não têm mais risco 42P01 por ausência da tabela no dev vivo. Zero
código alterado; Slice 1B permanece **IMPLEMENTED / HOLD YALA** até a revalidação final da Yala.

## Estado

**IMPLEMENTED / HOLD YALA.** Fecha SÓ como **F-ACTOR-CAPABILITY-GRANTS-ENDPOINTS-SLICE-1B**: 3 endpoints de gestão
de grants (criar/listar/revogar) sob `/authority`, autoridade por `canRepresentActor(scope)`, allowlist
não-financeira, sem listagem global, revoke por status; **zero enforcement em rota de negócio**;
`DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` aberta (bloqueia 1C, não 1B); `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`
segue OPEN. dev 391. **Aguarda reseal Yala.**
