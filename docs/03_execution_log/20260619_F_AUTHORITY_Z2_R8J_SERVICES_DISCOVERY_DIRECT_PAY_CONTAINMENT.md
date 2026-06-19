# 2026-06-19 — R8J SERVICES-DISCOVERY DIRECT-PAY CONTAINMENT — aposentar o trilho direto (cirúrgico)

Aposentadoria fail-closed do trilho direto **POST /services/request/pay** (DECISION-0110 D2 / DECISION-0113 / Z2).
O trilho movia dinheiro (`payAcceptedRequest → bankTx.createSimpleTransaction → bank_ledger/bank_transactions`)
lendo `actionContext.actorId` (client-declared) SEM `canRepresentActor` antes do sink, com authorship fabricada.
**NÃO implementa pagamento, NÃO faz hardening para reabrir, NÃO liga firewall, NÃO toca Bank/Core/ledger, NÃO
implementa escrow/intent/approval/release/KYB.** Apenas deixa o trilho direto explicitamente aposentado + guardado.

> **Consolidação (2026-06-19):** o material desta frente foi aplicado no working tree numa rodada anterior e
> consolidado/commitado aqui após a Paralela C READ-ONLY confirmá-lo. Material preservado (não reimplementado, não
> descartado). Adicionado nesta consolidação: `run-service-financial-firewall-ephemeral.ps1` (o E2E do firewall
> estava órfão de runner — necessário para PROVAR a aposentadoria em DB efêmera).

## Anchor / Pré-flight

HEAD `7e6aed0a` · branch `rescue-structural` · dev 394 · migrations 394/394 · working tree = exatamente o material
R8J (5 arquivos) + docs/untracked pré-existentes (sem HOLD_UNEXPECTED_DIRTY). actor-writer/bank-ledger boundaries
OK. Parent canal-1 OPEN baseline 7; DT-mãe 0113 OPEN.

## READ-FIRST — prova material (bate com as 3 paralelas A/B/C)

`POST /services/request/pay` (services-discovery.routes.ts): com firewall OFF (default) já retornava 403
`SERVICE_FINANCIAL_RUNTIME_DISABLED`; **com firewall ON** alcançava `servicesDiscoveryService.payAcceptedRequest(
tenantId, actionContext.actorId, body)`. `payAcceptedRequest` (service.ts): autoridade = SÓ
`if (row.customer_public_actor_id !== actionActorId) throw Forbidden` (actionActorId = `actionContext.actorId`
client-declared, burlável; sem `req.user`/`canRepresentActor`) → `bankPortsRegistry.getBankTransaction()
.createSimpleTransaction` (em `modules/bank/`, sink real: bank_ledger + bank_transactions; **bank_splits NÃO**) +
authorship FABRICADA (`authoritySource:'ownership'`, `allowed:true`) + `UPDATE service_discovery_requests SET
payment_status='paid', payment_bank_transaction_id`. Idempotência presente (latch `UPDATE … WHERE payment_status
IS NULL RETURNING id`); sem `FOR UPDATE`. DECISION-0110 D2 marca o trilho direto como **FORA da política**.

## Decisão: CONTAIN (aposentadoria) — STOPs não acionados

Verdito = **CONTAIN**. Não-bind (não reabrir), não-redesenhar. **STOP_CORE_MONEY_PATH_FOUND** não acionado (a
correção NÃO toca bank_ledger/transactions/splits — bloqueia a rota ANTES do sink; o sink fica no service,
intocado/inalcançável). **STOP_REOPENING_DIRECT_PAY/STOP_DECISION_0110_REQUIRED/STOP_AUTHORITY_AMBIGUOUS** não
acionados (containment, sem nova semântica de money).

## Fix cirúrgico (route-only)

`POST /services/request/pay` reescrito: **(1)** firewall geral (`isServiceFinancialRuntimeEnabled()`, default OFF)
PRESERVADO como 1º gate; **(2)** mesmo com firewall ON, **hard-stop INCONDICIONAL** `403
SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110`. Removidos do handler: leitura de `actionContext.actorId`
(canal-1), parse do body e a chamada a `payAcceptedRequest` → o sink ficou INALCANÇÁVEL por esta rota; flipar o
firewall NÃO reabre. `payAcceptedRequest` permanece no service, **intocado e morto por esta rota**. Firewall
(`service-financial-firewall.ts`) e Bank/Core **intocados**.

## Baseline — services-discovery PERMANECE (PARTIAL)

`services-discovery` **NÃO sai do baseline**: o arquivo tem outras rotas (createOffer/createRequest/respond) que
ainda leem `actionContext.actorId` (canal-1 não-money) — fora do escopo desta frente. Detector inalterado:
**flagged 7 · baseline 7 · new=0** (GATE OK). Estado: `/services/request/pay` → **CLOSED_AS_CONTAINED**;
services-discovery file → **PARTIAL / REMAINDER NON-MONEY ROUTES** (frente própria posterior, bind req.user +
canRepresentActor).

## Prova material — E2E + guard + negative-proof

- E2E efêmero `validate-pipeline-e2e-service-financial-firewall.ts` (runner novo
  `run-service-financial-firewall-ephemeral.ps1`, DB efêmera `unificard_service_firewall_e2e`, NUNCA dev):
  **12/12** — firewall OFF → 403 DISABLED (3 rotas); flag ON → passa o firewall; **R8J: /request/pay flag ON →
  403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110 (firewall ON NÃO reabre)**; **bank_ledger +
  bank_transactions delta = 0**; zero service_orders/payment_intents/service_payment_executions.
- Guard `audit-services-discovery-direct-pay-containment.mjs` em `validate:regression-guards`: exige no handler
  /request/pay o 403 RETIRED + o firewall; PROÍBE `payAcceptedRequest(`/`createSimpleTransaction`/`bank_ledger|
  transactions|splits`/`payment_status|payment_bank_transaction_id`/`actionContext.actorId`; exige o firewall
  default-OFF preservado no arquivo do firewall.
- **Negative-proof versionado** `negative-proof-services-discovery-direct-pay-containment.ps1` (ASCII/sem-BOM,
  pwsh 7 + WPS 5.1): reintroduzir `payAcceptedRequest(` + `actionContext.actorId` no handler → GATE FAIL;
  restauração byte-idêntica + git status pré==pós + guard OK pós-restauração.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo) ·
actor-authority-boundary **new=0** (baseline 7, inalterado — services-discovery permanece) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**
(baseline; sem erro novo em services-discovery/firewall).

## Escopo negativo

NÃO reabriu /request/pay · NÃO ligou SERVICE_FINANCIAL_RUNTIME_ENABLED · NÃO mudou default do firewall · NÃO
removeu/enfraqueceu firewall · NÃO chamou canRepresentActor para "preparar pagamento" · NÃO implementou escrow/
intent/approval/release/KYB · NÃO tocou Bank/Core/bank_ledger/bank_transactions/bank_splits/createSimpleTransaction
· NÃO reativou/redesenhou payAcceptedRequest · NÃO consertou authorship fabricada · NÃO corrigiu rotas não-money
(createOffer/createRequest/respond) · NÃO decidiu DECISION-0110 · NÃO fecha DT-mãe 0113 nem parent canal-1.

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. `/services/request/pay` → **CLOSED_AS_CONTAINED (RETIRED) / HOLD YALA**.
services-discovery file → **PARTIAL / REMAINDER NON-MONEY ROUTES**.
`DT-AUTHORITY-Z2-SERVICES-DISCOVERY-DIRECT-PAY` → **IMPLEMENTED_AS_CONTAINED / HOLD YALA**. DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` + parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` OPEN
(baseline 7). DECISION-0110 (reabertura via cadeia D1-D7/D8) OPEN. Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (7 entradas — inalterada)

- **MONEY → IA-DINHEIRO (4):** organizers, store-onboarding, **services-discovery [PARTIAL — só rotas não-money
  restantes; direct-pay já contido]**, unifycard-method.
- **READ-SENSITIVE / OWN FRONT (1):** business-authorization.
- **C_CONTAIN ghost própria / produto (2):** automation, human-mvp (G10).
- _(Residual: CRM accounts_receivable read; DECISION-0110/0114 D5; redesign acceptQuote; payAcceptedRequest
  authority real — tudo para frentes/decisões próprias.)_
