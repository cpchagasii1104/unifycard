# 2026-06-14 — F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE (MODO: EXECUTOR / macrofrente corretiva)

Fecha o reseal **PASS COM RESSALVA** da Yala sobre F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION em duas
partes: (A) âncora — aplicar a migration commitada ao dev; (B) escopo — impedir autorização tenant-wide por
qualquer `company_users`. Parent `0662155f` · branch `rescue-structural` · dev 380 → **381** (sem nova migration).

## Parte A — Âncora

`schema_migrations` no dev estava em 380 sem `20260613170000`; colunas ausentes. Aplicada via runner canônico
`npm run migrate` (1 pendente, 39ms) → **dev 381/381**; `can_view_audit_logs`/`can_view_risk`/`can_manage_risk`/
`can_manage_policy` presentes (boolean NOT NULL default false). company_users no dev = 2 rows (nascem false ⇒
zero acesso ampliado). Nenhuma migration nova criada.

## Parte B — Escopo (READ-FIRST)

1. **Rotas com target resolvível:** risk `/actors/:actorId`[`/timeline`] (params.actorId), business-audit
   `?actorId=` (repo FILTRA por actor_id), policy `/policies/evaluate/:actorId` + `/policy-decisions/actor/:actorId/active`.
2. **Tenant-wide sem escopo:** reporting (TODAS — `getFinancialKPIs(tenantId,...)` agrega tenant-wide e IGNORA
   `filters.actorId`), risk `/overview` + `/actors` (lista), business-audit `/:logId`, policy lista + mutations.
3. **actor→companyId:** `actors.company_id` (page/company-actor tem; user-actor = NULL). Novo
   `resolveCompanyIdForActor` (server-side, fail-closed).
4. **Dado tenant-wide vs company-scoped:** reporting/risk-overview/audit-list/policy-list = tenant-wide;
   risk/actors/:id, policy/evaluate/:id = actor-scoped (o service já escopa pelo actorId).
5. **Comportamento seguro sem companyId:** fail-closed `company_scope_required` (NUNCA tenant-wide por grant de empresa).

## Mudança

- `companies.service.ts`: `canUserPerformCompanyCapability` **fail-closed sem companyId** (`reason`); checa o vínculo
  NAQUELA empresa; `owner`/`can_manage_company` supergrant só dentro da empresa. Novo `resolveCompanyIdForActor`.
- **reporting**: fail-closed `COMPANY_SCOPE_REQUIRED` em todas as rotas; `actorId` morto removido (Querystring/filters/export).
- **risk-dashboard**: `requireRiskTenantWide` (overview/lista → fail-closed) + `requireRiskActorScoped` (/actors/:id[/timeline]).
- **business-audit**: `requireAuditActorScoped` (?actorId→company) + `requireAuditTenantWide` (/:logId → fail-closed).
- **policy-engine**: `requirePolicyPermission` → fail-closed tenant-wide; `requirePolicyActorScoped` em evaluate/:id + decisions/actor/:id/active.
- **guard**: Forma C exige prova de company-scope (`resolveCompanyIdForActor`); reporting fora do allowlist (sem canal).
- **neg-proof**: +reject Forma-C-sem-company-scope; recognized=3. **e2e** reescrito (company-scoped, 20 casos). canal3 B3 + spoof T-struct ajustados.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e company-users-fine-grants (DB efêmera 381) | **20/20** (T-PRIM fail-closed/scoped; T2/T7 company passa; T3 cross 403; T4/T8/T10/T-reporting tenant-wide→COMPANY_SCOPE_REQUIRED; T11 owner não tenant-wide; T12/T12b alvo≠subject) |
| guard | `flagged=3 baseline=3 new=0 stale=0 safe_subject_recognized=3` rc=0 |
| prova negativa | **13/13** unit (incl. reject Forma-C sem company-scope) + recognized=3 + new=0 |
| canal3 B3 + spoof T-struct/T6 | verdes contra source vivo |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113, zero novo) |
| dev migration | 380 → **381** (aplicada via runner canônico) |

## Hard stops respeitados

Zero Bank/ledger/transactions/payout writer/reversal/dispute/booking/order/service_offering; sem nova migration;
sem RBAC V2/FASE 6; sem actor_roles/company_roles/grants genéricos; sem frontend; sem service_id nullable; sem
modelo tenant-wide amplo (mantido DECISION_REQUIRED).

## Estado

F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION: **IMPLEMENTED / HOLD PARA RESEAL FINAL**. DECISION-0125 §escopo
promulgada. Reads tenant-wide = fail-closed até modelo platform-admin (DECISION_REQUIRED).
