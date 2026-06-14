# 2026-06-14 — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT (MODO: EXECUTOR / macrofrente única)

Contém duas superfícies internas P1 reveladas pelo READ-FIRST do Core de Aprovação Financeira
(F-CORE-FINANCIAL-APPROVAL-READ-FIRST). Parent `9f5481db` · branch `rescue-structural` · dev 383
(sem migration). **Zero dinheiro · zero Core de Aprovação · zero bank-http/payout.** Derivado de
DECISION-0113 (ator/tenant declarado pelo cliente é HINT, nunca autoridade) — sem DECISION nova.

## Superfícies contidas

- **R18 — `POST /automation/schedule/run-due`** (`modules/automation/automation.routes.ts`): rota
  dentro do protectedScope (auth+tenant) mas **sem gate admin/internal**; `now` vinha de
  `req.query.now`. Qualquer usuário comum autenticado do tenant disparava
  `scheduledActionService.executeDueActions(tenantId, now)` com tempo arbitrário.
- **R19 — `/internal/financial/disputes`** (`modules/disputes/financial-dispute.controller.ts`):
  controller registrado em `/internal` no **app cru** (`app.builder.ts:177-178`, FORA do
  protectedScope/linha 291) — **sem auth efetiva, sem req.user**; `tenant_id` vinha do body
  (POST/PATCH) e da query (GET) como autoridade; gravava `financial_disputes`/`financial_alerts` e
  `listOpenDisputes(undefined)` vazava **cross-tenant**.

## Patch (fail-closed; mirror da contenção dispute/reversal)

- **R18:** handler `/schedule/run-due` reduzido ao **403 `AUTOMATION_RUN_DUE_HTTP_DISABLED`**;
  removidos `req.query.now` e a chamada `executeDueActions` desta rota. O service `executeDueActions`
  **permanece intacto** para futuro worker/internal caller (sem caller humano hoje). As demais rotas
  de automation (schedule create/list/get/cancel) **intocadas**.
- **R19:** as 3 rotas (POST/GET/PATCH `/financial/disputes[/:id]`) reduzidas ao **403
  `FINANCIAL_DISPUTES_HTTP_DISABLED`**; removidos os imports/chamadas de
  `createDispute`/`listOpenDisputes`/`updateDisputeStatus`/`createFinancialAlert` (sem caller HTTP).
  Repositórios/funções **intactos** para futuro caller com subject server-side dentro do
  protectedScope. **Registro mantido** em `/internal` (contenção 403 preferida a mover registro —
  blast radius do cohort `/internal` em app cru é alto, GO §ESTRATÉGIA R19). Zero Bank.

## Guard + provas

- **Guard NOVO** `scripts/audit-internal-surfaces-containment.mjs` no `validate:regression-guards`:
  FALHA se run-due voltar a chamar `executeDueActions`/ler `query.now`, ou se o controller voltar a
  chamar create/update/list/alert ou tratar `tenant_id` de body/query. (cerca de regressão file-level).
- **Negative proof** `scripts/negative-proof-internal-surfaces-containment.ps1`: muta os 2 arquivos
  reais reabrindo cada contenção → guard FALHA nos 2 casos → restauração **byte-idêntica** (SHA256) →
  guard verde de novo. `baseOk=True r18Bites=True r19Bites=True restored=True guardGreenAgain=True`.
- **E2E** `validate-pipeline-e2e-internal-surfaces-containment.ts` (DB efêmera, wrapper
  `run-internal-surfaces-containment-ephemeral.ps1`): **11/11**. R18 via stub auth (usuário comum
  autenticado): T1 403 · T2 `?now` malicioso ainda 403 · T3 scheduled_actions inalterado · T4 erro
  explícito. R19 contra o controller real (app cru): T5 sem auth + tenant_id body → 403 + zero
  financial_disputes · T6 tenant alheio → 403 + zero financial_alerts · T7 GET ?tenant_id=foreign →
  403 sem lista cross-tenant · T8 PATCH → 403 · T9 bank_ledger/bank_transactions intocados.
  Estrutural S1/S2.

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera) | **11/11** |
| negative proof | guard morde R18+R19; restauração byte-idêntica |
| internal-surfaces guard | GATE OK (no regression-guards chain) |
| actor-authority-boundary (0113) | `flagged=2 baseline=2 new=0 safe_subject_recognized=4` (inalterado) |
| actor-writer §4.8.1 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 |
| arch patterns --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum nos arquivos da frente) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

Zero `bank_ledger`/`bank_transactions`/`bank_splits`/payout(A-D)/`seller_available`/bank-http/reversal/
dispute reversal; Core de Aprovação NÃO implementado; `can_execute_*` NÃO criado; `tenant_operator_grants`/
`company_users` NÃO usados para execução financeira; `availableBalanceCents` não usado como autorização;
sem RBAC V2; sem frontend; sem migration; sem refactor oportunista. **R20 (bank_splits imutabilidade /
target_actor_id nullable) FORA** — registrado como risco derivado, não corrigido aqui.

## Estado

F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT: **IMPLEMENTED / HOLD PARA RESEAL**.
Baseline 0113 inalterado (**2**: bank-http, payout — Core de Aprovação Financeira segue DECISION_REQUIRED).
DTs: DT-AUTOMATION-RUN-DUE-HTTP-OPEN → **P1 CONTAINED**; DT-FINANCIAL-DISPUTES-INTERNAL-HTTP-OPEN → **P1 CONTAINED**.
