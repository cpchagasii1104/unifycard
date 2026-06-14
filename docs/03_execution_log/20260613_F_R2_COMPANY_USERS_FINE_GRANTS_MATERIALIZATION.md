# 2026-06-13 — F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION (MODO: EXECUTOR / macrofrente única)

Materializa o R2 mínimo usando `company_users.can_*` como fonte viva de permissão fina (decisão Clayton/
IA Diretora, DECISION-0125). Parent `149f2958` · branch `rescue-structural` · dev 380 → **381**. Zero Bank.

## Domínio / prova normativa

Domínio = **authority/membership** (PJ). Fonte material = `company_users` (MEMBERSHIP SSOT, DECISION-0042;
autoridade contextual DECISION-0116). NÃO RBAC v1 órfão (`organization_members` só em `migrations_archive`),
NÃO RBAC V2 (ausente/dormente), NÃO `requireRole` genérico, NUNCA actorId client-declared (DECISION-0113).
Precedência Constituição > Leis > SSOT respeitada.

## READ-FIRST (respostas)

1. **can_* existentes em company_users:** can_manage_company, can_manage_financial, can_manage_employees,
   can_view_reports, can_manage_services, can_view_consolidated_inventory.
2. **Usados hoje:** can_manage_company/role='owner' (canManageCompany — gestão PJ), can_view_consolidated_inventory
   (DECISION-0116), can_manage_financial/can_view_reports (seed/e2e), can_manage_employees/can_manage_services (seed).
3. **Decorativos:** nenhum órfão de schema; can_view_reports existia mas não era consultado em runtime (reporting usava
   o chain legado). can_manage_employees/services têm uso fraco (seed/vocabulário).
4. **Relação target↔company_users:** company_users(company_id, global_user_id) liga usuário↔empresa; user via
   users.global_user_id (JOIN canônico). As 4 superfícies desta frente são tenant-wide (sem empresa-alvo única).
5. **company_id do target sem heurística?** Para estas reads platform-level, NÃO há empresa-alvo única → grant por
   vínculo ativo no tenant (documentado em DECISION-0125 como propriedade conhecida; per-empresa = refino futuro).
6. **reporting → can_view_reports existente?** SIM (reutilizado).
7. **business-audit → can_view_audit_logs novo?** SIM (criado).
8. **risk-dashboard → can_view_risk/can_manage_risk novo?** can_view_risk criado (reads); can_manage_risk criado mas
   RESERVADO (sem ação de mitigação hoje).
9. **policy-engine → can_manage_company ou can_manage_policy?** can_manage_policy criado (com fallback documentado
   can_manage_company/owner no authorizer); reads+mutations no mesmo gate.
10. **Rota mixed?** policy.routes (reads+mutations) — resolvido por gate único (não mantido baseline). bank-http/payout
    permanecem (move-money). trust permanece (requireRole interino).
11. **Migration?** SIM — não-financeira, só company_users, 4 booleanas NOT NULL DEFAULT false.
12. **Dados vivos p/ backfill?** Nenhum backfill (existentes nascem false; admin concede). Como o legado já negava,
    zero acesso EXISTENTE ampliado.
13. **Operador cross-actor legítimo:** preservado — o gate é por vínculo+grant (não por representabilidade do actor
    filtrado), e o actorId segue filtro; quem tem o grant continua vendo o agregado.
14. **Guard reconhece novo binding:** Forma C em safeSubjectProof (req.user → canUserPerformCompanyCapability), gated
    por SAFE_SUBJECT_READERS, com prova reverificada em runtime.

## Mudança (runtime R2 mínimo + tooling + tests + cartório)

- `src/core/companies/companies.service.ts`: novo `canUserPerformCompanyCapability` + `CompanyCapabilityKey` +
  whitelist `COMPANY_CAPABILITY_COLUMNS`.
- `migrations/20260613170000_add_company_users_r2_fine_grants.sql`: +4 colunas can_*.
- 4 rotas migradas: reporting / business-audit / risk-dashboard / policy-engine.
- `scripts/audit-actor-authority-boundary.mjs`: Forma C; policy removido do BASELINE; SAFE_SUBJECT_READERS atualizado.
- `scripts/negative-proof-actor-authority-boundary.ps1`: +4 asserções Forma C; safe_subject_recognized=4.
- e2e novo `validate-pipeline-e2e-company-users-fine-grants.ts` + runner `run-company-users-fine-grants-ephemeral.ps1`.
- Tests ajustados: risk-dashboard-spoof (T-struct/T6) + canal3 (B3) — autoridade migrou para can_*.

## Baseline 0113: 4 → 3

| Arquivo | Decisão | Razão |
| --- | --- | --- |
| policy-engine | **removido** | todas as rotas (reads+mutations) → can_manage_policy, subject server-side; arquivo provável (Forma C). Fecha a divergência honesta da FATIA A. |
| bank-http | mantido | BANK hard-stop + move-money writers — intocado |
| payout | mantido | FINANCIAL hard-stop + move-money writers — intocado |
| trust | mantido | requireRole(admin) INTERINO + mixed writes; R2.4 congelado |

## Provas

| Prova | Resultado |
| --- | --- |
| e2e company-users-fine-grants (DB efêmera, T0..T14) | **15/15** |
| guard | `flagged=3 baseline=3 new=0 stale=0 safe_subject_recognized=4` rc=0 |
| prova negativa (incl. 4 Forma C) | **12/12** unit + new=0 + recognized=4 |
| e2e risk-dashboard-spoof T-struct/T6 + canal3 B3 | verdes contra source vivo |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo |
| migration count | 380 → 381 |
| git diff --check | limpo nos arquivos da frente (só LF→CRLF) |

## Hard stops respeitados

Zero Bank/ledger/transactions/payout writer/reversal/dispute/booking/order/service_offering; migration só
company_users (não-financeira); sem RBAC V2/FASE 6; sem actor_roles/company_roles/grants genéricos; sem frontend;
sem decidir política financeira de reversão; sem trust R2.4; sem service_id nullable; flags de disputa NÃO criadas.

## Estado

F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION: **IMPLEMENTED / HOLD PARA RESEAL**. DECISION-0125 PROMULGADA.
