# 2026-06-14 — F-R2-TENANT-LEVEL-OPERATOR-GRANTS (MODO: EXECUTOR / macrofrente única)

Materializa o modelo mínimo de **operador tenant-level** (`tenant_operator_grants`) para destravar com
segurança as superfícies tenant-wide que ficaram fail-closed em DECISION-0125 §escopo. Parent `b0baadd7` ·
branch `rescue-structural` · dev 381 → **382**. DECISION-0126 promulgada. Zero Bank.

## READ-FIRST (respostas)

1. **Fonte material viva tenant-level hoje?** NÃO. Não há tenant_members/tenant_users/admins/operator/platform_admin.
2. **Tabela utilizável?** Nenhuma — criada `tenant_operator_grants`.
3. **Vínculo user→tenant além de users.tenant_id?** `users.tenant_id` (tenant-casa) + `users.global_user_id` (identidade). `users.tenant_id` NÃO é grant de operação.
4. **Padrão global_user_id:** `users.global_user_id` = SSOT (pós-Gate-0); PK de `global_users` = **`global_user_id`** (não `id`).
5. **Rotas tenant-wide fail-closed hoje:** reporting (todas), risk `/overview`+`/actors` lista, business-audit sem actor/`/:logId`, policy lista+mutations.
6. **Quais usam tenant grant:** reporting→can_view_tenant_reports; risk overview/list→can_view_tenant_risk; business-audit tenant→can_view_tenant_audit_logs; policy tenant→can_manage_tenant_policy.
7. **Decision-required:** platform-wide/cross-tenant; execução financeira.
8. **Impedir company→tenant:** tabelas + primitivos SEPARADOS; o primitivo tenant NÃO consulta company_users; o company exige companyId.
9. **Guard tenant-level safe binding:** Forma D (subject=req.user + canUserPerformTenantCapability; sem actorId cliente; sem subject==target; não Bank/payout/trust).
10. **Migration:** SIM — `tenant_operator_grants` (não-financeira), aplicada ao dev via runner canônico.

## Mudança

- migration `20260614120000_create_tenant_operator_grants.sql` (tabela + 4 booleanas + is_active + UNIQUE/índices). dev → **382**.
- `companies.service.ts`: `canUserPerformTenantCapability` + `TenantCapabilityKey` + whitelist `TENANT_CAPABILITY_COLUMNS`.
- **reporting**: fail-closed → `can_view_tenant_reports`.
- **risk-dashboard**: `requireRiskTenantWide` → `can_view_tenant_risk` (actor-scoped inalterado).
- **business-audit**: list = company-scoped (actorId→company) com fallback `can_view_tenant_audit_logs`; `/:logId` → `can_view_tenant_audit_logs`.
- **policy-engine**: `requirePolicyPermission` (tenant) → `can_manage_tenant_policy` (actor-scoped inalterado).
- **guard**: Forma D (`canUserPerformTenantCapability`). **neg-proof**: +4 asserções Forma D (17/17). **e2e** reescrito (23 casos). canal3 B3 ajustado.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera 382) | **23/23** (T1..T21 + T7b/T15b) |
| guard | `flagged=3 baseline=3 new=0 stale=0 safe_subject_recognized=3` rc=0 |
| prova negativa | **17/17** (incl. Forma D + reject params/actionContext) |
| canal3 B3 + spoof T-struct | verdes |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113, zero novo) |
| dev migration | 381 → **382** (runner canônico) |

## Hard stops respeitados

Zero bank_ledger/bank_transactions/payout writer/reversal.service/requestAndExecuteReversalSync; sem reabrir
dispute/reversal nem POST /service-orders; sem RBAC V2; sem actor_roles/company_roles genéricos; sem usar
company_users.can_* para tenant-wide; sem frontend; sem trust R2.4; sem service_id nullable; sem permissão financeira.

## Estado

F-R2-TENANT-LEVEL-OPERATOR-GRANTS: **IMPLEMENTED / HOLD PARA RESEAL**. DECISION-0126 promulgada. dev **382/382**.
Restam DECISION_REQUIRED: platform-wide/cross-tenant; execução financeira; deprecar legado/RBAC v1; trust R2.4.
