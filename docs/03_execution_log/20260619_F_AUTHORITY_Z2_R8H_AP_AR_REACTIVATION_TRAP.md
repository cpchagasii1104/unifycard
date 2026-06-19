# 2026-06-19 — R8H AP/AR REACTIVATION-TRAP CONTAINMENT — blindagem defensiva (cirúrgico)

Contenção **defensiva fail-closed** de `accounts-payable` + `accounts-receivable` contra reativação insegura
(DECISION-0113 / DECISION-0131 §B7 / Z2; DECISION-0114 D5). **NÃO implementa AP/AR, NÃO religa Bank, NÃO toca
ledger, NÃO cria regra financeira.** Instala 403 fail-closed antes do Proxy/service + guard anti-reactivation-trap.

## Anchor / Pré-flight

HEAD inicial `a9730e62` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
regression-guards OK · working tree material limpo. R8G CLOSED_WITH_REMAINDER; parent canal-1 OPEN baseline 12;
DT-mãe 0113 OPEN.

## READ-FIRST — prova material (bate com IA-DINHEIRO)

**AP** (`accounts-payable.routes.ts`, 7 rotas): POST from-purchase-order · POST manual · GET list · GET :id ·
POST :id/schedule · POST :id/mark-paid · POST :id/cancel. As 5 de escrita liam `actionContext.actorId` (+ campo
fantasma `actingUserId`) SEM canRepresentActor. **Service** (`accounts-payable.service.ts`): repo =
`new Proxy({}, { get: () => () => Promise.reject(new Error('AccountsPayable migrated to Bank')) })` — **reject-all**.
**AR** (`accounts-receivable.routes.ts`, 5 rotas): POST manual · GET list (+`query.actorId`) · GET :id · POST
:id/mark-received · POST :id/cancel — mesmo padrão canal-1. **Service**: Proxy reject-all "AccountsReceivable
migrated to Bank".

**Substrato (read-only em unificard_dev, `to_regclass`):** `accounts_payable`=GHOST(null) · `accounts_receivable`
=GHOST(null) → tabelas droppadas (migradas ao Bank). **`bank_ledger`/`bank_transactions`/`bank_splits`=LIVE, mas
NÃO referenciados por nenhum arquivo AP/AR** (rg=0) — **NÃO há money-path** nas rotas/services AP/AR (Proxy rejeita
antes de qualquer DB; nenhum INSERT em bank_*). → **STOP_CORE_MONEY_PATH_FOUND NÃO acionado.**

**Callers internos (todos via SERVICE → Proxy reject-all, já mortos):** scheduled-action.service.ts:311/322
(getPayableById/markAsPaid) · ticket.service.ts:243 (createFromPaymentIntent) · payment-execution.service.ts:658
(createFromPaymentIntent) · purchase-order.service.ts:318 (createFromPurchaseOrder). A contenção toca SÓ as rotas
públicas (o service fica intacto) → callers internos INALTERADOS (continuam rejeitando) → **zero regressão
material; STOP_INTERNAL_CALLER_BREAKAGE NÃO acionado.**

**CRM:** `crm.service.ts:413` lê `FROM accounts_receivable ar` (ghost → dead-at-db). É um **READ**, não writer
canal-1 → **RESIDUAL** (não redesenhado aqui; frente própria quando a decisão de money de AP/AR ocorrer).

**Owner/authority:** não-ambíguo — é containment defensivo (não bind), AP/AR estão mortos (Proxy + ghost). →
**STOP_AP_AR_OWNER_AMBIGUOUS NÃO acionado.**

## Decisão: CONTAIN (anti-reactivation)

**Fix cirúrgico (route-only, defensivo):** as **12 rotas** (7 AP + 5 AR) retornam **403** com code
**`ACCOUNTS_PAYABLE_DISABLED`** / **`ACCOUNTS_RECEIVABLE_DISABLED`** ANTES de ler `actionContext.actorId`/
`query.actorId` ou chamar o service — eliminando o canal-1 dos arquivos e bloqueando reativação silenciosa via
HTTP. Removidos imports service/types das rotas. **Os services (Proxy reject-all) e os callers internos permanecem
INALTERADOS.** Sem migration, sem schema, sem Bank/ledger.

## Baseline canal-1 — removido honestamente

`accounts-payable.routes.ts` + `accounts-receivable.routes.ts` **REMOVIDOS do BASELINE** — pós-contenção não leem
mais canal client-declared (mesmo padrão settlement/unifycard/ghost). Antes/depois: **flagged 9→7 · baseline 12→10
· new=0** (recognizers inalterados). GATE OK.

## Prova material — E2E (sem DB) + guard + negative-proof

- E2E DB-free `validate-pipeline-e2e-ap-ar-reactivation-trap.ts` → **15/15** (12 rotas → 403 com code nomeado;
  spoof actionContext arbitrário → ainda 403; guards anti-reactivation + baseline verdes; rotas contidas não
  importam pool/service → inject sem banco → zero write possível em accounts_payable/accounts_receivable/bank_*).
- Guard `audit-ap-ar-reactivation-trap.mjs` em `validate:regression-guards`: rotas (≥7 AP / ≥5 AR contidas 403
  nomeado; proíbe `accounts*Service.`/`actionContext.actorId`/`bank_ledger|transactions|splits`) **E** services
  (exige o **Proxy reject-all** "migrated to Bank" presente em ambos — se sumir = repo reativado sem decisão/
  binding → FALHA).
- **Negative-proof versionado** `negative-proof-ap-ar-reactivation-trap.ps1` (ASCII/sem-BOM, pwsh 7 + WPS 5.1):
  (1) rota AP volta a chamar `accountsPayableService.createManualPayable` → GATE FAIL; (2) service AP perde o Proxy
  reject-all (`Promise.reject`→`Promise.resolve`) → GATE FAIL; cada um restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** (containment não perturbou a fronteira Core money) ·
regression-guards OK (+ guard novo) · actor-authority-boundary **new=0** (baseline 12→10) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**
(baseline, 0 novo).

## Escopo negativo

NÃO reativou AP/AR · NÃO trocou o Proxy por lógica viva · NÃO criou migration/schema · NÃO escreveu em Bank/
bank_ledger/bank_transactions/bank_splits · NÃO criou payable/receivable · NÃO decidiu DECISION-0114 D5 · NÃO
resolveu CRM (residual) · NÃO tocou payout/recovery/service-payment-request/purchase-order (services internos
intactos) · NÃO fecha DT-mãe 0113 nem parent canal-1 (baseline 10>0). Services AP/AR e callers internos INTOCADOS.

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. AP/AR rotas → **CONTAINED (403 DISABLED) / HOLD YALA**.
`DT-AUTHORITY-Z2-AP-AR-REACTIVATION-TRAP` → **IMPLEMENTED_AS_CONTAINED / HOLD YALA**. DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN**; `DECISION-0114 D5` (religar AP/AR) segue **OPEN** (decisão própria). **Residual:** CRM
read de `accounts_receivable` (ghost dead-at-db) — frente própria. Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (10 entradas)

- **MONEY → IA-DINHEIRO (7):** event-rfq[stale/W6], purchase-order[stale], service-payment-request[stale],
  organizers, store-onboarding, services-discovery, unifycard-method.
- **READ-SENSITIVE / OWN FRONT (1):** business-authorization.
- **C_CONTAIN ghost própria / produto (2):** automation (9 rotas mistas; run-due já 403), human-mvp (G10).
