# DECISION-0127 — Trust tenant-level grants / R2.4 unfreeze

**Status:** PROMULGADA · **Data:** 2026-06-14 · **Branch:** `rescue-structural` · **Frente:** F-R2-TRUST-TENANT-GRANTS-R24-UNFREEZE

**Precedência:** DECISION-0126 (tenant_operator_grants = grant tenant-scoped) · DECISION-0125 (company_users = company-scoped) · DECISION-0113 (actorId client-declared = HINT).

## Decisão

Fecha o resíduo **`trust`** do baseline 0113: o `requireRole(['admin'])` **INTERINO** (R2.4 congelado) é
**substituído** por grant material **tenant-level** em `tenant_operator_grants`. Trust = engine de
compliance/risco/anti-fraude **TENANT-SCOPED** (mapa de risco do tenant; `actorId` é alvo/filtro, **nunca**
subject). **View e manage separados.** `company_users.can_*` **NÃO** autoriza trust tenant-level. Grant em
tenant A não vale tenant B.

```text
tenant_operator_grants.can_view_tenant_trust   → leitura/consulta trust (profiles, events, can-proceed)
tenant_operator_grants.can_manage_tenant_trust → ações administrativas (registrar evento, recalcular score)
bank-http / payout → permanecem fora do escopo (baseline 0113)
```

## Modelo material

Migration `20260614130000` (não-financeira, só `tenant_operator_grants`): +2 colunas
`can_view_tenant_trust` · `can_manage_tenant_trust` (boolean NOT NULL default false, **sem backfill**).
Primitivo estendido `companiesService.canUserPerformTenantCapability` (whitelist + 2 novas keys) — subject =
req.user.id server-side (→global_user_id via JOIN canônico); fail-closed; grant A≠B; **não consulta company_users**.

## Aplicação nas rotas trust (requireRole removido)

| Rota | Tipo | Capability |
| --- | --- | --- |
| GET /trust/profile/:actorId | read | `can_view_tenant_trust` |
| GET /trust/profiles | read | `can_view_tenant_trust` |
| GET /trust/events | read | `can_view_tenant_trust` |
| POST /trust/can-proceed | avaliação read-only | `can_view_tenant_trust` |
| POST /trust/events | mutation (createEvent/updateScore/snapshot) | `can_manage_tenant_trust` |
| POST /trust/recalculate/:actorId | recompute | `can_manage_tenant_trust` |

Trust **NÃO toca dinheiro**: as refs a "dispute" são apenas TIPOS DE EVENTO de score (dispute_won/opened/lost),
não operações de dispute/reversal/Bank. Nenhum `bank_*`/ledger/payout tocado.

## Guard / baseline

`audit-actor-authority-boundary.mjs`: `trust.routes.ts` **REMOVIDO do BASELINE** → `SAFE_SUBJECT_READERS`
(reconhecido pela **Forma D** = `canUserPerformTenantCapability(tenantId, <req.user>, '<can_tenant_*>')`).
**Baseline 0113: 3 → 2** (restam `bank-http`, `payout`). `flagged=2 baseline=2 new=0 stale=0 safe_subject_recognized=4`.
`SUBJECT_EQUALS_TARGET` segue hard-fail.

## Hard stops respeitados

Zero `bank_ledger`/`bank_transactions`/payout writer/`reversal`/dispute; sem reabrir POST /service-orders; sem
RBAC V2; sem `actor_roles`/`company_roles` genéricos; `company_users.can_*` NÃO abre trust tenant-level; sem
frontend; sem `service_id` nullable; sem permissão financeira (`can_execute_*` não criados); bank-http/payout
**não removidos** do baseline.

## Prova

e2e `validate-pipeline-e2e-company-users-fine-grants` (DB efêmera 383, **32/32** incl. TR1–TR9): TR2 read sem grant→403;
TR3 read com can_view_tenant_trust→passa; TR4 company grant não abre trust; TR5 mutation sem can_manage→403; TR6 mutation
com can_manage→passa; TR7 view NÃO autoriza mutation; TR8 grant A≠B; TR9 actorId≠subject; T16 SUBJECT_EQUALS_TARGET;
T18 bank-http/payout baselineados+intocados / trust fora do baseline. guard `flagged=2 baseline=2 new=0 safe_subject_recognized=4`;
neg-proof **17/17** (Forma D). Gates: actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch critical_new=0 · tsc 25.
dev 382→**383**.

## Estado

DECISION-0127 PROMULGADA. **Baseline 0113: 2** (bank-http, payout). dev **383/383**. Restam DECISION_REQUIRED:
bank-http/payout (Core de Aprovação Financeira); platform-wide/cross-tenant operator; deprecar
`businessAuthorizationService`/RBAC v1 órfão.
