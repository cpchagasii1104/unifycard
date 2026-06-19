# 2026-06-19 — R8Q UNIFYCARD-METHOD M5 MONEY-AWARE CONTAINMENT — ÚLTIMA entrada do baseline canal-1 (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `1373464f`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL**.
> `DT-AUTHORITY-Z2-UNIFYCARD-METHOD-M5-MONEY-CONTAINMENT` + unifycard-method → **CLOSED_AS_CONTAINED / YALA
> PASS_WITH_WARNINGS MATERIAL**. **🎯 `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`: ZEROED / HOLD SWEEP (baseline
> 0).** **Yala confirmou materialmente:** HEAD 1373464f · branch rescue-structural · migrations 394/394 · sem
> migration/schema; diff 9 arquivos, runtime `.ts` só marketplace/unifycard-method.routes.ts; nenhum consumer/
> service/settlement/bank/migration no commit; payment-execution.service/unifycard.service/settlement/regional-fee
> NÃO no diff; migrations_archive NÃO movido para migrations; detector removeu unifycard-method. **Schema-ghost
> confirmado:** to_regclass('public.unifycard_payment_methods')=NULL; to_regtype('public.unifycard_method_type')=NULL
> (só migrations_archive/0142; 3 rotas dead-at-db antes do containment). **Rotas contidas:** POST /unifycard/methods
> · GET /unifycard/methods · GET /unifycard/methods/:type → 501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED (hard-stop
> antes de sink; handlers _req; imports unifyCardMethodService/types/errors + preHandler requireRole removidos; não
> chama createMethod/listMethods/getMethodByType/resolveFee; não lê actionContext.actorId; spoof actionContext →
> 501; sem req.user → 501; requireRole não reativa; requirePermission não usado p/ mascarar detector). **Escopo
> financeiro:** zero Bank/Core/bank_ledger/transactions/splits/payment-execution/settlement/regional-fee/
> unifycard.service/fee_percentage/fee_bps/fee_rate_bps/migration/firewall; SERVICE_FINANCIAL_RUNTIME_ENABLED
> intocado; containment HTTP-only. **Guard** `audit-unifycard-method-money-containment.mjs` wired+GREEN (3 rotas
> 501; proíbe service/createMethod/listMethods/getMethodByType/resolveFee/actionContext.actorId/bank_*/import de
> consumers; verifica ausência de migration viva criando tabela/enum). **E2E DB-free** 7/7 (incl. baseline canal-1 =
> 0 assertado). **Gates Yala:** actor-writer OK · bank-ledger OK · regression-guards **71 GATE OK / 0 FAIL** · arch
> critical_new=0 · check:migrations 394/394 · tsc baseline 43. **Baseline 1→0** (flagged 0 · baseline 0 · new=0 ·
> stale 0 · safe_subject 7 · service_bound 4 · self_bound 1 · not_authority 1 — **sem entrada C1 restante; baseline
> vazio honesto por hard-stop material, sem recognizer amplo; detector re-flagga se a rota reabrir**).
>
> **Warnings do reseal (não-bloqueantes):** **W1** — negative-proof não reexecutado pela Yala (muta source);
> validado estruturalmente + executora pwsh 7 & WPS 5.1 (POST reintroduz createMethod + actionContext → FALHA; GET
> reintroduz listMethods → FALHA; restauração byte-idêntica; git pré==pós). **W2** — working tree sujo fora do
> material → não é HOLD_WORKTREE_DIRTY.
>
> **FEE-BUG PRESERVADO COMO DT FUTURA:** R8Q NÃO corrigiu /100 (payment-execution:714), fee_percentage,
> migrations_archive, bps, regional-fee nem settlement snapshot. **`DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` →
> OPEN / DECISION REQUIRED** (299¢ vs 3¢; §4.8 bps INTEGER canônico; fee_percentage proibido; não executável sem
> decisão Clayton/IA-DINHEIRO). **Baseline 0 NÃO significa que o fee foi corrigido.**
>
> **PARENT canal-1 — HOLD SWEEP (não CLOSED):** `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` = **ZEROED / HOLD
> SWEEP** (baseline 0), NÃO `CLOSED`. A **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` = OPEN / HOLD
> SWEEP**. O fechamento definitivo do parent + promulgação/fechamento da DT-mãe é ATO SOBERANO da IA-DIRETORA/Clayton
> após sweep final — NÃO da executora. Seal = docs-only; HEAD material permanece `1373464f`. _(Detalhe IMPLEMENTED
> abaixo.)_

Containment money-aware do ÚLTIMO item do baseline canal-1 (`unifycard-method [M5]`), DECISION-0113 / Z2 + norma
07_NOMENCLATURA_CANONICA §4.8. **Com esta frente o baseline canal-1 ZERA (1→0).** NÃO corrige a unidade de fee, NÃO
migra bps, NÃO altera settlement/payment-execution/unifycard.service, NÃO ativa o trilho, NÃO materializa schema,
NÃO toca Bank/Core.

## Anchor / Pré-flight

HEAD inicial `9d6e835c` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · working tree material limpo. Parent canal-1 OPEN baseline 1 (só unifycard-method); DT-mãe 0113 OPEN.

## READ-FIRST — prova material (consolida Paralelas A/B/C)

- **Rotas (`unifycard-method.routes.ts`):** POST /unifycard/methods (requireRole admin + lia actionContext.actorId
  como createdBy → createMethod); GET /unifycard/methods (listMethods); GET /unifycard/methods/:type
  (getMethodByType). **Baseline detecta C1** (actionContext.actorId no POST), não marcador M5.
- **Schema-ghost (verificado em dev):** `to_regclass('public.unifycard_payment_methods')=NULL`;
  `to_regtype('public.unifycard_method_type')=NULL`. Tabela+enum existem só em `migrations_archive/0142`. Nenhuma
  migration viva os cria → todas as 3 rotas são dead-at-db (POST/GET → 500/42P01).
- **Defeito de unidade de fee (Paralela A/B):** unifycard.service: `gross*0.0299=299¢`; payment-execution.service:
  `gross*(0.0299/100)=3¢`. Canônico §4.8 = basis points / `_bps` INTEGER; `fee_percentage` é nome proibido. A
  correção exige DECISION financeira própria — **NÃO feita aqui**.
- **Caller interno:** `payment-execution.service.ts:321` chama `unifyCardMethodService.resolveFee` — mas é o trilho
  de SETTLEMENT (dormant/proxy-dead, tabela ghost) — NÃO é rota; minha contenção é HTTP-route-only → resolveFee/
  payment-execution INTOCADOS e já dormant (zero regressão). Sem frontend caller. `bank_refs`=NONE no escopo.

## Decisão de containment

Verdito = **CONTAIN money-aware** (schema-ghost + money-deferred). Código único nomeado **501
`UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED`** (501 = família schema-ghost das ondas anteriores; o nome enfatiza o
money-defer, razão pela qual NÃO se conserta e reabre — a unidade de fee é decisão pendente). Nenhum STOP acionado
(não toca bank/settlement; não corrige /100; não materializa schema; não reativa; sem produto acquiring vivo).

**Fix cirúrgico (route-only):** as 3 rotas retornam 501 `UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED` ANTES de qualquer
service/repository/sink. Removidos imports de service/types/erros/requireRole. O service (createMethod/listMethods/
getMethodByType/**resolveFee**), payment-execution, unifycard.service, settlement e regional-fee permanecem
INTOCADOS.

## Baseline canal-1 — 1 → 0 🎯

`unifycard-method.routes.ts` **REMOVIDO do baseline** — após a contenção não lê mais actionContext.actorId nem chama
service. Detector: **flagged 0 · baseline 0 · new=0 · stale 0** (safe_subject 7 · service_bound 4 · self_bound 1 ·
not_authority 1). GATE OK. **O baseline DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE está VAZIO.**

## Prova material — guard + negative-proof + E2E

- E2E DB-free `validate-pipeline-e2e-unifycard-method-money-containment.ts` → **7/7**: 3 rotas → 501
  UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED; spoof actionContext → 501; sem req.user → 501 (contenção independe de
  auth); guard verde; **baseline canal-1 = 0** (assert flagged/baseline/new=0). (Rota não importa service → DB-free.)
- Guard `audit-unifycard-method-money-containment.mjs` (wired): 3 rotas 501; PROÍBE unifyCardMethodService/
  createMethod/listMethods/getMethodByType/resolveFee/actionContext.actorId/bank_* na rota; proíbe import de
  payment-execution/unifycard.service/settlement/regional-fee na rota; verifica que nenhuma migration VIVA cria
  unifycard_payment_methods/unifycard_method_type (archive permanece archive).
- **Negative-proof versionado** `negative-proof-unifycard-method-money-containment.ps1` (ASCII/sem-BOM, pwsh 7 + WPS
  5.1): (1) POST reintroduz createMethod + actionContext.actorId → GATE FAIL; (2) GET reintroduz listMethods → GATE
  FAIL; cada um restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo) ·
actor-authority-boundary **new=0, baseline 0** · arch `--strict` **critical_new=0** (warning_new=4 pré-existente) ·
check:migrations **394/394** (sem migration) · tsc **43**.

## Escopo negativo

NÃO corrigiu /100 · NÃO criou fee_bps · NÃO renomeou fee_percentage · NÃO alterou payment-execution.service/
unifycard.service/settlement.service/regional-fee.repository · NÃO criou migration · NÃO moveu archive→migrations ·
NÃO materializou unifycard_payment_methods · NÃO tocou Bank/bank_ledger/transactions/splits · NÃO ligou firewall ·
NÃO trocou requireRole por requirePermission p/ limpar detector · NÃO mascarou baseline (hard-stop material) · NÃO
fecha DT-mãe 0113 nem parent canal-1 (isso é ato pós-Yala da IA-DIRETORA/Clayton).

## DT financeira futura PRESERVADA (não resolvida)

**`DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` → OPEN / DECISION REQUIRED.** A correção canônica final exige bps
INTEGER (`_bps`, §4.8), alinhamento dos consumers (unifycard.service vs payment-execution.service), snapshot,
possível migration e E2E provando 299¢ vs 3¢. Baseline 0 NÃO significa que o fee foi resolvido — significa que o
canal-1 (autoridade client-declared) foi contido honestamente.

## Estado

**✅ CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material `1373464f`;
reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2 não-bloqueantes — ver bloco SEAL no topo).
unifycard-method → **CLOSED_AS_CONTAINED (501 money-deferred)** (removido do baseline).
`DT-AUTHORITY-Z2-UNIFYCARD-METHOD-M5-MONEY-CONTAINMENT` → **CLOSED_AS_CONTAINED / YALA PASS_WITH_WARNINGS MATERIAL**.
**`DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`: ZEROED / HOLD SWEEP (baseline 0)** — NÃO `CLOSED`. A **DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`: OPEN / HOLD SWEEP** — fechamento definitivo do parent +
promulgação da DT-mãe é ato soberano da IA-DIRETORA/Clayton após sweep final. `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-
MIGRATION` OPEN (decisão financeira; baseline 0 ≠ fee corrigido). _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do
reseal.)_

## Critério para fechar parent canal-1 / DT-mãe 0113

Com baseline 0 + Yala PASS desta frente, o **parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` pode ser
declarado zerado**; o fechamento/promulgação da **DT-mãe 0113** (`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`) é
ato soberano da IA-DIRETORA/Clayton após sweep final — NÃO da executora. Resíduos não-baseline permanecem como
frentes próprias: DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION; organizer billing SaaS-vs-split; event_settlements
ghost; CRM AR read; DECISION-0110/0114 D5; automation worker; human-mvp/G10.
