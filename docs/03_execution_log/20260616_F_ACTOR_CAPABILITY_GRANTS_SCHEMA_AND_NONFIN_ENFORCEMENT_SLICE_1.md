# 2026-06-16 — F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 (Slice 1A)

Materializa o substrato de capability grants por actor (DECISION-0136). **Slice 1A** (decisão IA Diretora após
STOP): schema + service + repository + resolver + testes, **SEM enforcement em rota de negócio**. Não-financeiro.

## Anchor / Pré-flight

HEAD inicial `127525d2` · branch `rescue-structural` · superfícies materiais LIMPAS · dev **390**. STOP não disparado.

## READ-FIRST + STOP (premissa do GO ajustada)

O GO pedia enforcement de `calendar:block` numa rota viva. READ-FIRST 1ª mão provou:
- `calendar:block` é key **DEFINIDA mas NÃO-ROTEADA** (não há `/block`; só existe em permission-keys.ts/business-permissions).
- A rota viva natural (`POST /` create-availability) tem gate **SELADO** (DECISION-0113 canal-1 + DECISION-0118 D2):
  `actionContext.actorId` = owner.authorityActorId + canRepresentActor(owner) + comentário **"Sem admin escape"**.
- Substrato: NÃO existe tabela actor+capability_key; `tenant_operator_grants` é global_user/boolean; `actor_delegations`
  é representação; `users.referral_code` é COMERCIAL (DECISION-0119); `actors.slug` (0002 UNIQUE / 0064 readicionou
  nullable → unicidade NÃO garantida).
→ **STOP**: enforçar grant na rota selada RELAXA invariante selado (decisão de produto). IA Diretora escolheu
**Slice 1A só** (substrato; sem enforcement; sem tocar superfície selada).

## Patch (substrato — Slice 1A)

- **Migration** `20260616210000_create_actor_capability_grants.sql` (dev 390→**391**): tabela `actor_capability_grants`
  (grantee_actor_id × capability_key × scope_type='actor'/scope_actor_id × granted_by_user_id/granted_by_actor_id ×
  status/valid_*/revoked_* × audit). UNIQUE parcial ativo + 2 índices. **CHECK** scope='actor', status canônico,
  **allowlist NÃO-financeira** (`calendar:block/unblock`, `services:create/edit/disable`).
- **Repository** `actor-capability-grant.repository.ts` (insert/findActive/getById/list/revoke, tenant-safe).
- **Service** `actor-capability-grant.service.ts` (grant/list/revoke + **`hasCapabilityGrant`** — primitivo de
  enforcement DEFINIDO, NÃO aplicado a rota). Concedente exige `canRepresentActor(scope_actor)`. Allowlist no service.
- **Resolver** `actor-lookup.service.ts` `resolveBySlug` (actors.slug, tenant-scoped, **fail-closed em ambiguidade**;
  NUNCA `users.referral_code`).
- **Sem endpoints HTTP** (Slice 1B). **Sem enforcement em rota de negócio** (availability owner-only intocado).

## Provas

| Prova | Resultado |
| --- | --- |
| tsc build / strict | **25 / 43** (baseline) |
| guard `audit-actor-capability-grants-nonfinancial.mjs` (na chain regression-guards) | **GATE OK** |
| neg-proof `negative-proof-...ps1` | **5 mordidas** (allowlist-financial · scope-global · drop-grantee-actor · types-financial · lookup-referral) + restauração byte-idêntica SHA256 |
| e2e efêmero `actor-capability-grants-slice1` | **13/13** |
| GATE actor-writer / bank-ledger | OK / OK |
| GATE regression-guards | rc=0 (inclui novo guard; sql-lint + numbering OK p/ a migration) |
| GATE architectural-patterns --strict | critical_new=0 (warning_new=4 pré-existentes inventory-legacy) |

**e2e:** T1 grant legítimo (concedente representa scope) → ativo + grantee/scope=actor_id; T2 hasCapabilityGrant→true;
T3 sem grant→false; T4 scope errado→false; T5 revoke→false; T6 concedente sem autoridade→403; T7 capability
financeira→403 (allowlist); T8 isolamento tenant A↛B; T9 resolveBySlug (slug→actor; inexistente/vazio→null);
T10 grant grava actor_id (nunca slug); T-bank Bank intocado; C1/C2 estruturais.

## DT aberta

- **DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION** — OPEN / PRODUCT_AUTHORITY_DECISION_REQUIRED. Operador
  não-owner preencher/bloquear agenda por grant relaxa o gate selado DECISION-0113/0118 → decisão de produto +
  frente de enforcement (Slice 1C).

## Escopo negativo (verificado)

ZERO enforcement em rota de negócio · ZERO availability/calendar/weekly-template/bookings/participants tocados ·
ZERO `permission-keys.ts` · ZERO `business-permissions.types.ts` · ZERO frontend/UI · ZERO financeiro/Bank/ledger/
payout/split/refund · ZERO `users.referral_code` · ZERO votes/organization/contextual-thread · ZERO RBAC/FASE 6 ·
ZERO scope global · grants nascem inexistentes (sem backfill).

## Estado

**IMPLEMENTED / HOLD YALA.** Fecha SÓ como **F-ACTOR-CAPABILITY-GRANTS-...-SLICE-1**: substrato de capability grants
por actor materializado (tabela + service + repository + resolver por slug + `hasCapabilityGrant`), invariantes
provados, **zero enforcement em rota de negócio** (availability owner-only selado preservado). DECISION-0136
promulgada; DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION aberta. dev **391**. **Aguarda reseal Yala.**
