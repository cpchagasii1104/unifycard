# 2026-06-19 — R8H AP/AR REACTIVATION-TRAP CONTAINMENT — blindagem defensiva (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `eaaf077a`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (CLOSED_AS_CONTAINED,
> NÃO `CLOSED` simples — AP/AR continuam DESATIVADOS aguardando decisão financeira futura; **NÃO** fecha a DT-mãe
> 0113 nem o parent canal-1). `DT-AUTHORITY-Z2-AP-AR-REACTIVATION-TRAP` → **CLOSED_AS_CONTAINED / YALA
> PASS_WITH_WARNINGS MATERIAL**. **Yala confirmou materialmente:** HEAD eaaf077a · branch rescue-structural ·
> migrations 394/394 · sem migration/schema; zero Bank/Core/bank_ledger/bank_transactions/bank_splits/payout/
> recovery/settlement/service-payment-request/purchase-order alterado; zero reativação AP/AR; DECISION-0114 D5 não
> decidida; CRM não redesenhado; `accounts_payable`/`accounts_receivable` = NULL (to_regclass); services AP/AR
> seguem **Proxy reject-all "migrated to Bank"** (commit não removeu nem enfraqueceu o Proxy); rotas públicas AP/AR
> NÃO chegam ao service/proxy; callers internos seguem via service Proxy-dead; não há caminho vivo para Bank/ledger;
> 7 rotas AP → **403 ACCOUNTS_PAYABLE_DISABLED**; 5 rotas AR → **403 ACCOUNTS_RECEIVABLE_DISABLED**; containment
> ANTES de actionContext/service/sink; canal-1 sumiu dos arquivos AP/AR; callers internos (ticket/scheduled-action/
> payment-execution/purchase-order) intocados e nenhum usa rota HTTP pública; CRM residual `crm.service.ts:413`
> confirmado como read de accounts_receivable ghost/dead-at-db; guard `audit-ap-ar-reactivation-trap.mjs` wired e
> GREEN (exige rotas contidas + Proxy reject-all; falha se rota voltar a chamar service OU se o Proxy for removido);
> **E2E DB-free 15/15 rodado pela Yala**; baseline **12→10** (flagged 9→7 · new=0 · stale=3 · safe_subject=6 ·
> service_bound=4 · self_bound=1 · not_authority=1); actor-authority-boundary OK · actor-writer-boundaries OK ·
> bank-ledger-boundaries OK · regression-guards OK · arch `--strict` critical_new=0 · tsc baseline 43; cartório
> correto; **DT-mãe 0113 e parent canal-1 seguem OPEN**.
>
> **Warnings do reseal (follow-up não-bloqueante):** **W1** — negative-proof não reexecutado pela Yala (muta a
> source); validado estruturalmente + executora declarou pwsh 7 e Windows PowerShell 5.1. **W2** — working tree
> sujo fora do material → não é HOLD_WORKTREE_DIRTY.
>
> **Residual / OPEN registrados:** CRM `crm.service.ts:413` read de accounts_receivable (ghost/dead-at-db; não é
> writer canal-1; não redesenhado → follow-up próprio) · **DECISION-0114 D5 OPEN** (AP/AR não podem ser religados
> sem decisão própria). Seal = docs-only; HEAD material permanece `eaaf077a`. _(Detalhe IMPLEMENTED abaixo.)_

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

**✅ CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material
`eaaf077a`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2 + residuais registrados — ver bloco
SEAL no topo). AP/AR rotas → **CONTAINED (403 DISABLED) / YALA PASS_WITH_WARNINGS MATERIAL**.
`DT-AUTHORITY-Z2-AP-AR-REACTIVATION-TRAP` → **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**.
**CLOSED_AS_CONTAINED ≠ remediação:** AP/AR seguem desativados aguardando decisão financeira; a DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`, o parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` e a
`DECISION-0114 D5` (religar AP/AR) permanecem **OPEN**. **Residual:** CRM read de `accounts_receivable`
(crm.service.ts:413, ghost dead-at-db) — frente própria. _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do reseal.)_

## Fila restante para fechar 0113 (10 entradas)

- **MONEY → IA-DINHEIRO (7):** event-rfq[stale/W6], purchase-order[stale], service-payment-request[stale],
  organizers, store-onboarding, services-discovery, unifycard-method.
- **READ-SENSITIVE / OWN FRONT (1):** business-authorization.
- **C_CONTAIN ghost própria / produto (2):** automation (9 rotas mistas; run-due já 403), human-mvp (G10).
