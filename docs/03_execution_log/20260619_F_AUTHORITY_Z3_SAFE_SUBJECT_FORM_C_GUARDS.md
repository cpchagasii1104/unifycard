# 2026-06-19 — Z3 SAFE-SUBJECT FORMA C DEDICATED GUARDS (higiene W3, guard-only)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `a9884b36`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL**.
> `DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` → **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL**. **Yala
> confirmou materialmente:** HEAD a9884b36 · branch rescue-structural · migrations 394/394 · sem migration; diff
> **guard-only** (7 arquivos; zero runtime `.ts` fora de src/scripts); business-audit/policy-engine/risk-command-center
> routes NÃO alteradas; `audit-actor-authority-boundary.mjs` (detector 0113) NÃO alterado; Bank/Core/settlement/fee/bps
> NÃO alterados; package.json só recebeu o wire do guard novo. **READ-FIRST por surface confirmado:** business-audit
> (subject=req.user.id; 401 sem user; resolveCompanyIdForActor → canUserPerformCompanyCapability can_view_audit_logs
> Forma C OU canUserPerformTenantCapability can_view_tenant_audit_logs Forma D; 403 fail-closed; actionContext.actorId
> NÃO é autoridade; query.actorId=alvo; read-only; zero bank_*) · policy-engine (requirePolicyPermission Forma D +
> requirePolicyActorScoped Forma C; subject=req.user.id; 401/403; apply/revoke autor=req.user em audit; actorId client
> não vira subject; estado interno; zero bank_*) · risk-command-center (requireRiskTenantWide Forma D +
> requireRiskActorScoped Forma C; subject=req.user.userId/id; 401/403; actionContext.actorId só breadcrumb em
> recordAccessAudit APÓS o gate; riskDashboardService não recebe actionContext; dados keyed por params.actorId;
> read-only; zero bank_*). **Guard** `audit-safe-subject-form-c-dedicated-guards.mjs` wired+GREEN (Forma C/D por
> superfície + subject=req.user + fail-closed 401/403 + service sem actionContext.actorId como arg + zero bank_*;
> morde se subject≠req.user / capability sumir / requireRole amplo substituir / actionContext virar autoridade /
> bank_* aparecer). **E2E DB-free** `validate-pipeline-e2e-safe-subject-form-c` **10/10** (6 rotas sem req.user → 401;
> spoof actionContext não autoriza; guard verde; baseline canal-1 = 0 / new = 0). **Baseline 0113 PRESERVADO:** detector
> flagged 0 · baseline 0 · new 0 · stale 0 · safe_subject 7 · service_bound 4 · self_bound 1 · not_authority 1 — Z3 NÃO
> alterou baseline, NÃO removeu recognizer, NÃO alterou detector, NÃO reabriu 0113; nenhum new C1; o guard novo é camada
> ADICIONAL, não substituto do detector. **Money safety:** zero Bank/Core/bank_ledger/transactions/splits/settlement/
> payout/recovery/fee/bps/payment-execution/unifycard-method/services-discovery/AP-AR/automation/human-mvp. **Gates Yala:**
> actor-writer OK · bank-ledger OK · regression-guards **72 GATE OK / 0 FAIL** · arch critical_new=0 · check:migrations
> 394/394 · tsc 43.
>
> **Warnings do reseal (não-bloqueantes):** **W1** — negative-proof não reexecutado pela Yala (muta source); validado
> estruturalmente + executora pwsh 7 & WPS 5.1 (business-audit subject≠req.user → FALHA; risk passa actionContext.actorId
> ao riskDashboardService → FALHA; restauração byte-idêntica; git pré==pós). **W2** — working tree sujo fora do material
> → não é HOLD_WORKTREE_DIRTY. **Observação não-bloqueante (higiene futura opcional):** o check do guard que procura
> actionContext como argumento usa regex de arg direto (cobre o caso comum; negative-proof confirma que morde); chamada
> multi-linha/nested poderia escapar — o source vivo não faz isso e o E2E cobre runtime; endurecer regex/migrar p/ AST é
> melhoria opcional futura, não bloqueante.
>
> **Z3 NÃO altera o estado fechado de 0113, NÃO reabre 0113 e NÃO fecha nenhuma DT financeira/produto** — apenas encerra
> a higiene W3 do sweep. Seal = docs-only; HEAD material permanece `a9884b36`. _(Detalhe IMPLEMENTED abaixo.)_

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

**✅ CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material `a9884b36`;
reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2 + observação higiene-futura não-bloqueantes —
ver bloco SEAL no topo). `DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` → **CLOSED / YALA PASS_WITH_WARNINGS
MATERIAL** (W3 do sweep 0113 encerrada com guard dedicado + negative-proof + E2E). Baseline canal-1 permanece **0**
(inalterado). **Z3 NÃO altera o estado fechado de 0113** (`DT-0113-CANAL1-...` = CLOSED/BASELINE ZERO; DT-mãe =
CLOSED_WITH_CONTAINED_RESIDUALS), NÃO reabre 0113 e NÃO fecha nenhuma DT financeira/produto. _(Histórico: 🟡
IMPLEMENTED / HOLD YALA antes do reseal.)_
