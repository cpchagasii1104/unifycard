# DECISION-0136 — Substrato de capability grants por actor (`actor_capability_grants`)

**Status:** **PROMULGADA / NORMATIVA + MATERIALIZADA (Slice 1A).** Cria a tabela `actor_capability_grants` +
service/repository/resolver. **NENHUM enforcement em rota de negócio** (decisão IA Diretora 2026-06-16):
availability/calendar permanecem **owner-only** (DECISION-0113 canal-1 / DECISION-0118 D2 SELADOS). Zero
financeiro, zero UI, zero RBAC/FASE 6, zero toque em `permission-keys.ts`/`business-permissions.types.ts`.

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **parent:** `127525d2` · **dev:** 390→**391** ·
**Tipo:** arquitetural / autoridade / materialização · **Frente:** F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 ·
**Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton (escolheu Slice 1A após STOP).

**Deriva de:** **DECISION-0134** (referral=lookup; grants contra actor_id) · **DECISION-0135** (key `domain:action`) ·
**DECISION-0113** (actorId HINT; canRepresentActor) · **DECISION-0126** (`tenant_operator_grants` — precedente de
invariantes) · `07_NOMENCLATURA_CANONICA`.

---

## §1 — O que materializa

Tabela **`actor_capability_grants`** (migration `20260616210000`): grant de capability **por actor**.
- `grantee_actor_id` (QUEM recebe — actor; nunca user/CPF/CNPJ/slug/referral).
- `capability_key` (DECISION-0135 `domain:action`; **allowlist NÃO-financeira** via CHECK).
- `scope_type='actor'` (MVP; sem `'global'`) + `scope_actor_id` (ONDE vale).
- `granted_by_user_id` + `granted_by_actor_id` (concedente) + `authority_source`.
- `status` (active/revoked/expired/suspended) + `valid_from`/`valid_until`/`revoked_at`/`revoked_by_actor_id`/`reason` + audit `created_at`/`updated_at`.
- UNIQUE parcial `(tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id) WHERE status='active'`; índices por grantee e scope.

Serviços (`modules/authority/`): `actorCapabilityGrantService` (grant/list/revoke + **`hasCapabilityGrant`** —
primitivo de enforcement DEFINIDO, NÃO aplicado a rota) · `actorCapabilityGrantRepository` · `actorLookupService.resolveBySlug`.

## §2 — Invariantes promulgados

1. **Lookup ≠ authority.** O lookup humano do actor usa **`actors.slug`** (resolver fail-closed: 0/>1 → null).
   **`users.referral_code` é PROIBIDO** (comercial/money-adjacent — DECISION-0119). O resultado é sempre `actor_id`.
2. **Grant é por actor_id.** grantee/scope/concedente gravados como `actor_id` (FK `actors`), nunca slug.
3. **Representar ≠ ter capability.** `canRepresentActor(user, actor)` = vestir o actor; `hasCapabilityGrant(actor, key, scope)` = capability no escopo. Eixos distintos.
4. **Owner nativo preservado; grant é ADITIVO.** O dono do recurso mantém autoridade nativa; o grant só ADICIONA para não-owner. (Enforcement = Slice futuro.)
5. **Concedente precisa representar o escopo.** `grant`/`revoke` exigem `canRepresentActor(grantedByUserId, scopeActorId)` (para page/company actor, isso já exige `canManageCompany`). actorId client-declared nunca é subject.
6. **Multi-tenant isolado.** Grant em tenant A não vale em B (chave por `tenant_id`).
7. **Grants nascem inexistentes** (sem backfill permissivo — espelha `tenant_operator_grants`/DECISION-0126).
8. **Financeiro FORA.** Allowlist MVP = `calendar:block`·`calendar:unblock`·`services:create`·`services:edit`·`services:disable`. Proibido `financial:`/`split:`/`cards:`/`cash_drawer:`/`customer_credit:`/`suppliers:credit_`/`payout`/`ledger`/`refund`/`payment`/`transfer` (CHECK na migration + allowlist no service). Financeiro = CRITICAL (3 paralelas — fora).
9. **Sem `scope_type='global'`** no MVP (CHECK).

## §3 — Provas

tsc build 25 / strict 43 (baseline). Guard `audit-actor-capability-grants-nonfinancial.mjs` (na chain
`validate:regression-guards`) GATE OK. Neg-proof `negative-proof-actor-capability-grants-nonfinancial.ps1` =
**5 mordidas** (allowlist-financial · scope-global · drop-grantee-actor · types-financial · lookup-referral) +
restauração byte-idêntica SHA256. e2e efêmero `actor-capability-grants-slice1` **13/13** (grant legítimo · scope/
grantee=actor_id · sem-grant→false · scope errado→false · revoke→false · concedente sem autoridade→403 ·
financeira→403 · isolamento tenant · resolveBySlug · grant grava actor_id · Bank intocado · 2 estruturais).
4 gates verdes (actor-writer · bank-ledger · regression-guards rc=0 · arch critical_new=0).

## §4 — NÃO feito / fora de escopo (Slices futuros)

- **Enforcement em rota de negócio** — NÃO feito. availability/calendar owner-only intocado. Decisão de produto:
  **DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION (OPEN / PRODUCT_AUTHORITY_DECISION_REQUIRED)**.
- **Endpoints HTTP** `/authority/grants` — deferidos (Slice 1B), para não ampliar a frente.
- **UI** de checkboxes — Slice futuro (depois de grants + endpoints).
- **Cutover de permission-keys.ts** (verb-first→object_verb) — frente própria (DECISION-0135 §6).
- **Reconciliação de vocabulário** `permission-keys.ts` × `business-permissions.types.ts` (2 fontes) — RFC futuro.
- NÃO tocado: financeiro/Bank/ledger · `permission-keys.ts` · `business-permissions.types.ts` · frontend ·
  votes/organization/contextual-thread · RBAC/FASE 6 · `users.referral_code`.

## §5 — Frase canônica

> "Slice 1A cria o substrato de grants por actor, mas não altera nenhuma autoridade de negócio já selada.
> Availability permanece owner-only até decisão explícita de calendar operator authority."

## §6 — Referências

`actor_capability_grants` (mig 20260616210000) · `modules/authority/actor-capability-grant.{service,repository,types}.ts` ·
`actor-lookup.service.ts` · `DECISION-0134`/`DECISION-0135`/`DECISION-0113`/`DECISION-0126` · `07_NOMENCLATURA_CANONICA` ·
`DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`.
