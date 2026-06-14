# DECISION-0126 — Tenant-level operator grants

**Status:** PROMULGADA · **Data:** 2026-06-14 · **Branch:** `rescue-structural` · **Frente:** F-R2-TENANT-LEVEL-OPERATOR-GRANTS

**Precedência:** DECISION-0125 (company_users.can_* = grant company-scoped; tenant-wide = DECISION_REQUIRED) ·
DECISION-0113 (actorId client-declared = HINT) · CORE_ESTORNOS/LEI §4.6 (fronteira financeira).

## Decisão

`company_users.can_*` é permissão **por empresa** e **NUNCA** autoriza o tenant inteiro. As superfícies
**tenant-wide** (reporting, risk overview/list, business-audit sem actor/company scope, policy tenant-wide/
list/mutations) só podem abrir por **grant tenant-level explícito** num modelo material **SEPARADO**:
**`tenant_operator_grants`**. Platform-wide/cross-tenant e execução financeira ficam **fora do escopo**
(DECISION_REQUIRED / Core de Aprovação Financeira).

```text
company_users.can_*        → company-scoped (DECISION-0125)
tenant_operator_grants.can_* → tenant-scoped (esta decisão)
platform-wide / cross-tenant → fora do escopo / DECISION_REQUIRED
financial execution          → fora do escopo / Core de Aprovação Financeira
```

## Modelo material

Tabela `tenant_operator_grants` (migration `20260614120000`, não-financeira): `id` · `tenant_id`→tenants(id) ·
`global_user_id`→**global_users(global_user_id)** (PK real; a sugestão `(id)` da GO estava incorreta) ·
`can_view_tenant_reports` · `can_view_tenant_audit_logs` · `can_view_tenant_risk` · `can_manage_tenant_policy`
(boolean NOT NULL default false) · `is_active` · timestamps. UNIQUE(tenant_id, global_user_id) + índices.
**Sem backfill** (grants nascem inexistentes/false; testes efêmeros criam os seus). **NÃO** cria
`can_execute_payout`/`can_execute_dispute_action`/`can_execute_reversal` nem qualquer permissão financeira.

Primitivo `companiesService.canUserPerformTenantCapability(tenantId, userId, capability)`: resolve
`users.global_user_id` (JOIN canônico), exige `is_active` + coluna whitelisted = true; `source='tenant_operator_grants.can_*'`;
fail-closed (`no_subject`/`no_tenant_grant`). **Grant em tenant A não vale tenant B** (filtro `tog.tenant_id=$tenantId`).
SUBJECT sempre server-side (req.user); actorId client-declared **nunca** é subject. **Não consulta company_users.**

## Aplicação nas rotas

| Superfície | Tenant-wide → grant tenant-level | Actor-scoped → permanece company-scoped (DECISION-0125) |
| --- | --- | --- |
| reporting | TODAS → `can_view_tenant_reports` | (não há) |
| risk-dashboard | `/overview` + `/actors` (lista) → `can_view_tenant_risk` | `/actors/:actorId`[`/timeline`] → `can_view_risk` |
| business-audit | `/business-audit-logs` sem actor resolvível + `/:logId` → `can_view_tenant_audit_logs` | `?actorId=`→company → `can_view_audit_logs` |
| policy-engine | listar/criar/ativar/desativar/decisões/apply/revoke → `can_manage_tenant_policy` | `/policies/evaluate/:actorId` + `/policy-decisions/actor/:actorId/active` → `can_manage_policy` |

Nota policy: mutations gerem estado de POLÍTICA interno (`policy_rules`/`policy_decisions`) — **sem efeito
financeiro** nem chamada externa; nenhum `bank_*`/payout/reversal. `can_manage_company` **não** é usado para tenant-wide.

## Guard

`audit-actor-authority-boundary.mjs`: **Forma D** reconhece `canUserPerformTenantCapability(tenantId, <subj=req.user>, '<can_tenant_*>')`
(subject server-side; tenant-scoped por construção; sem actorId/company/company_users; A≠B; não Bank/payout/trust).
Baseline 0113 inalterado: **3** (`bank-http`, `payout`, `trust`). `flagged=3 baseline=3 new=0 stale=0 safe_subject_recognized=3`.

## Hard stops respeitados

Zero `bank_ledger`/`bank_transactions`/payout writer/`reversal.service`/`requestAndExecuteReversalSync`; sem reabrir
dispute/reversal nem POST /service-orders; sem RBAC V2; sem `actor_roles`/`company_roles` genéricos; sem usar
`company_users.can_*` para tenant-wide; sem frontend; sem trust R2.4; sem `service_id` nullable; sem permissão financeira.

## Prova

e2e `validate-pipeline-e2e-company-users-fine-grants` (DB efêmera 382, **23/23**): T1 migration; T2/T6/T9/T12 sem grant
→403; T3/T7/T7b/T10/T13 com grant tenant-level → passa; T4/T17 company grant NÃO abre tenant-wide; T5 grant A≠B
(primitivo); T8/T11/T14 actor-scoped continua company-scoped (tenant grant não cobre); T15/T15b actorId≠subject; T16
SUBJECT_EQUALS_TARGET; T18 bank-http/payout/trust intocados; T19 dispute contido; T20 service-orders contido; T21 Bank
intocado. guard `flagged=3 baseline=3 new=0 safe_subject_recognized=3`; neg-proof **17/17** (incl. Forma D + rejeições).
Gates: actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch critical_new=0 · tsc 25. dev 381→**382**.

## Estado

DECISION-0126 PROMULGADA. dev **382/382**. Restam DECISION_REQUIRED: **platform-wide/cross-tenant** operator;
execução financeira (Core de Aprovação Financeira); deprecar `businessAuthorizationService`/RBAC v1 órfão; trust R2.4.
