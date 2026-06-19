# 2026-06-19 — Z3 SAFE-SUBJECT FORMA C DEDICATED GUARDS (higiene W3, guard-only)

Higiene não-bloqueante registrada no sweep final 0113 (W3): tornar guard-backed + negative-proofed o reconhecimento
das 3 superfícies `safeSubjectProof` **Forma C/D** que ainda não tinham guard dedicado. **NÃO altera runtime** (as 3
já são materialmente seguras — H1_GUARD_HYGIENE_ONLY); **não reabre 0113, não toca money/Bank/settlement/fee, não
mexe no detector para mascarar**.

## Anchor / Pré-flight

HEAD inicial `20ace3a1` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · baseline canal-1 **0** · working tree material limpo.

## READ-FIRST por surface (todas H1_GUARD_HYGIENE_ONLY)

- **business-audit** (`business-audit.routes.ts`): `requireAuditActorScoped` (req.user.id; 401 sem user;
  `resolveCompanyIdForActor(query.actorId)` → `canUserPerformCompanyCapability(can_view_audit_logs)` [Forma C] OU
  fallback `canUserPerformTenantCapability(can_view_tenant_audit_logs)` [Forma D]; 403 fail-closed) +
  `requireAuditTenantWide` (Forma D) para `/:logId`. **Sem `actionContext.actorId`**; query.actorId = alvo (repo
  filtra). Read-only (logs imutáveis); zero bank_*.
- **policy-engine** (`policy.routes.ts`): toda rota com preHandler `requirePolicyPermission` (Forma D,
  can_manage_tenant_policy) ou `requirePolicyActorScoped` (Forma C, can_manage_policy via resolveCompanyIdForActor);
  subject req.user.id (401 sem user; 403 fail-closed). `actorId` em apply/revoke = autor de auditoria derivado de
  `req.user.actorId` (server-side), não client-declared. policy_rules/policy_decisions = estado interno, sem
  efeito financeiro; zero bank_*.
- **risk-command-center** (`risk-dashboard.routes.ts`): preHandler `requireRiskTenantWide` (Forma D,
  can_view_tenant_risk) ou `requireRiskActorScoped` (Forma C, can_view_risk via resolveCompanyIdForActor); subject
  req.user.userId/id (401 sem user; 403 fail-closed). `actionContext.actorId` aparece SÓ em `recordAccessAudit`
  (breadcrumb de auditoria); os dados são keyed por `params.actorId` (alvo) e `riskDashboardService` NUNCA recebe o
  actionContext.actorId como argumento. Read-only; zero bank_*.

**Conclusão:** nenhuma surface tem gap de autoridade — actionContext.actorId não governa autoridade em nenhuma; o
subject é sempre req.user; a capability é Forma C/D fail-closed. Nenhum STOP acionado (sem money, sem ghost, sem
decisão de produto). → **guard hygiene only (sem patch de runtime)**.

## Implementação (guard-only)

- **Guard** `audit-safe-subject-form-c-dedicated-guards.mjs` (wired em `validate:regression-guards`): por superfície
  exige (1) primitivo `canUserPerformCompanyCapability`/`canUserPerformTenantCapability` (Forma C/D); (2) subject de
  `req.user.id`/`userId`; (3) fail-closed 401 + 403; (4) o service de dados (businessAuditLogService/
  policyEngineService/riskDashboardService) NÃO recebe `actionContext.actorId` como argumento (ator client-declared
  não governa leitura — é audit/alvo); (5) zero bank_*. Se trocarem capability por `requireRole` amplo, o primitivo
  some e (1) falha.
- **Nenhum arquivo de rota/runtime alterado** (H1). Material: guard + negative-proof + E2E + package.json (wire).

## Prova material — E2E + negative-proof

- E2E DB-free `validate-pipeline-e2e-safe-subject-form-c.ts` → **10/10**: as 3 superfícies (6 rotas representativas)
  SEM req.user → **401** (fail-closed antes de companiesService/DB); spoof `x-test-spoof` (actionContext) NÃO
  converte 401 em 200; guard verde; **baseline canal-1 = 0 / new = 0** (inalterado).
- **Negative-proof versionado** `negative-proof-safe-subject-form-c-dedicated-guards.ps1` (ASCII/sem-BOM, pwsh 7 +
  WPS 5.1): (1) business-audit — subject deixa de vir de req.user → GATE FAIL; (2) risk-command-center —
  riskDashboardService recebe actionContext.actorId como argumento (autoridade) → GATE FAIL; cada um restaura
  byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards **72 GATE OK / 0 FAIL** (+ guard novo) ·
actor-authority-boundary **flagged 0 · baseline 0 · new 0 · stale 0** (inalterado) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** · tsc **43** (sem runtime change).

## Escopo negativo

NÃO alterou runtime das rotas (já seguras) · NÃO trocou requireRole/requirePermission p/ limpar detector · NÃO
alterou canUserPerformCompanyCapability/canRepresentActor/canActAs · NÃO alterou o detector p/ mascarar · NÃO removeu
recognition · NÃO tocou Bank/bank_ledger/transactions/splits/settlement/payout/recovery/fee/bps · NÃO reabriu
unifycard-method/services-discovery/AP-AR/automation/human-mvp · NÃO criou migration · NÃO reabriu DECISION-0113 ·
NÃO alterou o baseline (segue 0). NÃO fecha decisões financeiras/produto.

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. `DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` → IMPLEMENTED / HOLD YALA
(guard dedicado + negative-proof + E2E entregues; W3 do sweep 0113 endereçada). Baseline canal-1 permanece 0 (não
alterado por esta frente). Próximo passo: **Yala reseal**.
