# 2026-06-19 — R8P SERVICES-DISCOVERY NON-MONEY AUTHORITY BIND (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `73896cd7`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL**.
> `DT-AUTHORITY-Z2-SERVICES-DISCOVERY-NON-MONEY-AUTHORITY` + services-discovery → **CLOSED / BOUND / FULLY
> RESOLVED / YALA PASS_WITH_WARNINGS MATERIAL** (direct-pay RETIRED R8J + non-money authority BOUND R8P). **Yala
> confirmou materialmente:** HEAD 73896cd7 · branch rescue-structural · migrations 394/394 · sem migration/schema;
> diff 9 arquivos, runtime `.ts` só services-discovery.routes.ts; nenhum service/bank/unifycard/payment-execution/
> settlement file alterado; diff adiciona só helper + 6 call-sites; /request/pay fora do diff; detector removeu
> services-discovery do baseline. **Bind confirmado:** helper assertActorRepresentable(req,reply) — sem req.user →
> 401 SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED; não-representável → canRepresentActor(req.tenant.id, req.user.id,
> req.actionContext.actorId) → 403; 6 call-sites após presence-checks, antes de parse/service; actionContext.actorId
> vira hint, sozinho não autoriza; body/query não substituem subject. **Rotas non-authority confirmadas:** /metrics
> + /search passam só tenant.id (+filtros), actionContext.actorId é presence-gate, NÃO filtro actor-scoped → sem
> read-residual. **Direct-pay R8J PRESERVADO:** /request/pay CLOSED_AS_CONTAINED (firewall 1º gate; 403
> SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110; handler _req; zero payAcceptedRequest/createSimpleTransaction/
> bank_*; SERVICE_FINANCIAL_RUNTIME_ENABLED default OFF). **unifycard-method INTOCADO** (M5 money defer, OPEN; sem
> alteração de payment-execution/settlement/fee_percentage/unidade de fee). **Guard**
> `audit-services-discovery-actor-bind.mjs` wired+GREEN (helper canRepresentActor; ≥6 call-sites; /request/pay
> retired+firewall; proíbe payAcceptedRequest/createSimpleTransaction/bank_*; não mascara unifycard-method). **E2E
> DB-free** 10/10. **Gates Yala:** actor-writer OK · bank-ledger OK · regression-guards **70 GATE OK / 0 FAIL** ·
> arch critical_new=0 · check:migrations 394/394 · tsc baseline 43. **Baseline 2→1** (flagged 1 · new=0 · stale 0 ·
> safe_subject 7 · service_bound 4 · self_bound 1 · not_authority 1 — resta APENAS unifycard-method[M5]). **DT-mãe
> 0113 + parent canal-1 OPEN (1>0).**
>
> **Warnings do reseal (não-bloqueantes):** **W1** — negative-proof não reexecutado pela Yala (muta source);
> validado estruturalmente + executora pwsh 7 & WPS 5.1 (neutralizar canRepresentActor com canRep=true → FALHA;
> remover um bind call-site → FALHA; restauração byte-idêntica; git pré==pós). **W2** — working tree sujo fora do
> material → não é HOLD_WORKTREE_DIRTY. **W3** — o E2E prova fail-closed 401 + /request/pay retired, mas NÃO
> exercita positive-path nem representable-spoof; não bloqueia (prova estrutural: helper retorna 403 se
> !canRepresentActor; guard exige canRepresentActor; negative-proof o neutraliza e falha); follow-up opcional = E2E
> positive-path + spoof de actor não representável. Seal = docs-only; HEAD material permanece `73896cd7`. _(Detalhe
> IMPLEMENTED abaixo.)_

Bind canal-1 das 6 rotas não-money de services-discovery (o "PARTIAL" deixado por R8J), DECISION-0113 / Z2. **NÃO
reabre /request/pay (retired R8J), NÃO toca payAcceptedRequest/firewall/settlement/unifycard-method/Bank/ledger,
NÃO cria migration.**

## Anchor / Pré-flight

HEAD inicial `fa30ae01` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · working tree material limpo. Parent canal-1 OPEN baseline 2; DT-mãe 0113 OPEN.

## READ-FIRST — prova material

- **Rotas actor-scoped (canal-1):** writes POST /offers, POST /request, POST /request/respond; reads GET
  /my-requests, GET /provider-requests, GET /request/:requestId. `/metrics` e `/search` usam actionContext só como
  presence-gate (tenant-wide/category, NÃO authority). `/request/pay` = RETIRED (R8J), intocado.
- **Modelo de autoridade do service:** todas as 3 escritas usam `actionActorId` (= actionContext.actorId) como o
  actor operacional — `createOffer`: `input.actorId !== actionActorId` throw; `createRequest`: `input.customerId
  !== actionActorId` throw; `respondToRequest`: `provider_actor_id !== actionActorId` throw. As reads filtram por
  actionActorId. Colunas: `service_discovery_requests.customer_actor_id`; `actors.actor_id` (provider/customer
  public). **Defeito (canal-1):** actionContext.actorId é client-declared — o caller declara o public actor id de
  outro (não-secreto) e age/lê como ele; **sem canRepresentActor**.
- **/request/pay:** segue retired (R8J): firewall 1º gate + 403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110;
  `payAcceptedRequest` sem caller vivo por esta rota. `bank_refs`=NONE no escopo.

## Classificação + Decisão por rota

Todas **B_BIND_LOCAL** — owner/target = o actor operacional declarado, provável via canRepresentActor (mesmo padrão
canônico de services.routes R6.1). Nenhum STOP: sem money/settlement (escopo não-money), sem product decision
(regras de offer/request/respond já existem no service), sem owner ambíguo (o actor operacional é exatamente o
actionActorId, agora provado representável).

**Fix cirúrgico (route-only):** helper `assertActorRepresentable(req, reply)` →
`canRepresentActor(req.tenant.id, req.user.id, req.actionContext.actorId)` fail-closed (401/403
`SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED`), chamado nas **6 rotas actor-scoped** ANTES de qualquer write/leitura.
Assim actionContext.actorId deixa de ser um claim livre: o caller só age/lê como um actor que PROVA representar; as
checagens existentes do service (offer.actorId===actionActorId etc.) passam a operar sobre actor representável.
`/request/pay` (R8J), `/metrics`/`/search` (presence-gate) e o service intocados.

## Baseline canal-1 — 2 → 1

`services-discovery.routes.ts` **REMOVIDO do baseline** — as 6 rotas actor-scoped bound + /request/pay retired +
metrics/search presence-gate. Detector: **flagged 1 · baseline 1 · new=0 · stale 0 · safe_subject 7**. GATE OK.
**Resta APENAS:** `unifycard-method` [M5 money defer, fee-unit defect no settlement] — exige decisão financeira
própria (NÃO executável aqui).

## Prova material — guard + negative-proof + E2E

- E2E DB-free `validate-pipeline-e2e-services-discovery-actor-bind.ts` → **10/10**: as 6 rotas SEM req.user (só
  actionContext spoofado) → **401 SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED** (actionContext NÃO autoriza);
  /request/pay → 403 retired (R8J); guards (bind + direct-pay-containment R8J) + baseline verdes. (Fail-closed antes
  de canRepresentActor/service/DB → DB-free.)
- Guard `audit-services-discovery-actor-bind.mjs` (wired): helper com canRepresentActor(req.tenant.id, req.user.id,
  actionContext.actorId) + fail-closed nomeado; **≥6 call-sites** do bind (1 def + 6); /request/pay retired +
  firewall; PROÍBE payAcceptedRequest/createSimpleTransaction/bank_*.
- **Negative-proof versionado** `negative-proof-services-discovery-actor-bind.ps1` (ASCII/sem-BOM, pwsh 7 + WPS 5.1):
  (1) neutralizar canRepresentActor no helper → GATE FAIL; (2) remover os 6 call-sites do bind → GATE FAIL; cada um
  restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo; direct-pay R8J
preservado) · actor-authority-boundary **new=0** (baseline 2→1) · arch `--strict` **critical_new=0** (warning_new=4
pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**.

## Escopo negativo

NÃO reabriu /request/pay · NÃO chamou payAcceptedRequest · NÃO removeu hard-stop retired · NÃO ligou firewall · NÃO
tocou payment-execution/settlement/unifycard-method/fee_percentage · NÃO tocou Bank/ledger/transactions/splits/
payout/recovery · NÃO criou migration · NÃO abriu RBAC amplo · NÃO corrigiu organizers · NÃO fecha DT-mãe 0113 nem
parent canal-1 (1>0).

## Estado

**✅ CLOSED / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material `73896cd7`;
reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2-W3 não-bloqueantes — ver bloco SEAL no topo).
services-discovery 6 rotas não-money → **BOUND (canRepresentActor)**; services-discovery file → **CLOSED / BOUND /
FULLY RESOLVED** (direct-pay RETIRED R8J + non-money authority BOUND R8P; removido do baseline).
`DT-AUTHORITY-Z2-SERVICES-DISCOVERY-NON-MONEY-AUTHORITY` → **CLOSED / BOUND / YALA PASS_WITH_WARNINGS MATERIAL**.
DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` + parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN** (baseline 1 — só unifycard-method[M5]). _(Histórico: 🟡 IMPLEMENTED / HOLD YALA antes do
reseal.)_

## Fila restante para fechar 0113 (1 entrada)

- **MONEY → IA-DINHEIRO (1):** `unifycard-method` [M5 money defer, fee-unit defect no settlement] — exige decisão
  financeira própria (unidade de fee). É o ÚLTIMO item; o parent canal-1 + DT-mãe 0113 só podem zerar/promulgar
  após essa decisão.
- _(Residual: organizer billing SaaS-vs-split; event_settlements ghost; CRM AR read; DECISION-0110/0114 D5;
  automation worker + human-mvp/G10 reativação.)_
