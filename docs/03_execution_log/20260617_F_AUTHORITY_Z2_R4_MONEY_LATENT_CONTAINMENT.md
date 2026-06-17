# 2026-06-17 — F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT (material, cirúrgico)

Contenção **explícita + guard anti-reativação** das 6 rotas money-latent A1–A6
(settlement/regionAccount/unifycard). Hoje os sinks morrem por Proxy ("migrated to Bank"); a frente
torna a contenção **explícita, auditável e guardada** (403 fail-closed no edge), para que religar o
Bank no futuro sem gate de authority não ressuscite autoria spoofável (`actionContext.actorId` cru).
NÃO religa Bank; NÃO implementa fluxo financeiro; NÃO decide papel institucional; sem migration.

## Anchor / Pré-flight

HEAD inicial `0a0b87e2` · branch `rescue-structural` · dev 394 · pending=[]. Anchors `6e94916f`/
`4aeebe7f`/`37eb5efa`/`13f3ee2e`/`fb73cd95`/`24a45196`/`e8394a27`/`28db8ce1`/`2f531a9b`/`0a0b87e2`
presentes. Sem sujeira material em settlement/unifycard/regionAccount/bank/ledger/migrations/
authority/routes/R1/R2/R3/R5/referral.

## Preflight (3 paralelas READ-ONLY) — convergência

- **A — IA-DINHEIRO:** `PASS_MONEY_LATENT`; `STOP_MONEY_EXPOSED = NÃO`.
- **B — IA-ACTOR-USERS:** `PASS_WITH_DECISION`; A1–A6 têm falha Z2 latente (rotas montadas,
  `actionContext.actorId`, sem gate, sinks mortos por Proxy).
- **C — IA-BANCO/DT:** `PASS_WITH_SPLIT_RECOMMENDATION`; money-adjacent latentes; sem migration; não
  misturar com B1 (R5).

## Causa-raiz (READ-FIRST)

As 6 rotas (`settlement.routes.ts`: settle/region credit/region debit; `unifycard.routes.ts`:
authorize/capture/settle) liam `actionContext.actorId` cru e o passavam ao service. Os 3 services
(`settlement.service`, `region-account.service`, `unifycard.service`) expõem repositórios via
`new Proxy({}, { get: () => () => Promise.reject(new Error('… migrated to Bank')) })` — toda mutação
rejeita antes de tocar tabela. Logo **money-latent**: sem `STOP_MONEY_EXPOSED`, mas mina armada.
Registro: app.builder.ts:654 registra marketplace com prefix `/marketplace` dentro de protectedScope
(auth/tenant/action-context/rbac); nenhum preHandler/`requirePermission` por-rota nas 6.

Idioma de contenção canônico (recon): o projeto já contém rotas money/authority via 403 fail-closed
literal — payout (`PAYOUT_HTTP_EXECUTION_DISABLED`), dispute reversal (`DISPUTE_REVERSAL_HTTP_DISABLED`),
service-order (`SERVICE_ORDER_DIRECT_CREATE_DISABLED`): `reply.status(403).send({ ok:false, code, message })`
com o handler reduzido e o executor inalcançável. Norma: AUTHORITY_LAW Art.3/15/16/17 (sem money sem
ator humano + responsabilidade; role/flag não é autoridade; estrutura que viola não produz efeito) +
Lei 5 (Bank SSOT) + DECISION-0113 D2 / DECISION-0131 §B7 (actorId declarado é HINT; binding server-side;
fail-closed é o default).

## Correção (cirúrgica — só os 2 route files)

Os 6 handlers de mutação foram **reduzidos a 403 fail-closed** com `const` de contenção por sub-domínio:
```
const SETTLEMENT_HTTP_EXECUTION_DISABLED = { ok:false, code:'SETTLEMENT_HTTP_EXECUTION_DISABLED', message:'… until Bank migration provides authority binding …' } as const;
// … REGION_ACCOUNT_HTTP_EXECUTION_DISABLED, UNIFYCARD_HTTP_EXECUTION_DISABLED …
fastify.post('/settlements/:id/settle', async (_req, reply) => reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED));
```
- **A1** settle → `SETTLEMENT_HTTP_EXECUTION_DISABLED`. **A2/A3** region credit/debit →
  `REGION_ACCOUNT_HTTP_EXECUTION_DISABLED`. **A4/A5/A6** unifycard authorize/capture/settle →
  `UNIFYCARD_HTTP_EXECUTION_DISABLED`.
- **Sinks inalcançáveis:** nenhum `settlementService.settle`/`regionAccountService.credit|debit`/
  `unifyCardService.authorize|capture|settle` em código (só em comentário/banner). `actionContext.actorId`
  não é mais lido nas rotas. Imports `BadRequestError`/`ErrorCode` (só usados pelos handlers removidos)
  podados; `NotFoundService`/service imports dos **readers GET** preservados.
- **Readers GET preservados** (listSettlements/getSettlementById/getAccount/listTransactions/
  getTransactionById) — só os 6 POSTs de mutação foram contidos.
- **Baseline:** `settlement.routes.ts` (era `C1_MONEY`) e `unifycard.routes.ts` (era `C1`) removidos do
  baseline canal-1 de `audit-actor-authority-boundary.mjs` (o canal sumiu); remoção documentada no header.
- **Stubs Proxy intactos** — nenhum religado; Bank Core/ledger/splits intocados; nenhuma escrita em tabela.

## E2E

`run-marketplace-money-latent-containment-ephemeral.ps1` → **15/15 verdes** (DB efêmera dedicada; nunca
unificard_dev):
- **A (estrutural):** A1/A2 codes de contenção presentes · A3 nenhum sink de mutação nem `bank_*`
  alcançável (após strip de comentários).
- **C (HTTP real via `fastify.inject` sob prefix `/marketplace`):** C1–C6 A1–A6 → **403** com o code
  esperado e `ok:false` (mesmo com `actionContext.actorId` spoofado no preHandler — ignorado) · C7 nenhum
  body é Proxy cru (`migrated to Bank`) nem `INTERNAL_ERROR` → **service NÃO atingido** · C8
  `bank_ledger`/`bank_transactions`/`bank_splits` (+ money-adjacent) inalterados antes/depois.
- **D (não-regressão):** D1 R5 intent-execute mantém `canRepresentActor(tenantId, authUserId,
  buyerActorId)` · D2 R1 groups · D3 R3 reports (≥8) · D4 R2 dashboard.

## Guard + Negative-proof

Novo `scripts/audit-marketplace-money-latent-containment.mjs` em `validate:regression-guards`: exige os
3 codes de contenção + `reply.status(403).send(<code>)` por rota; **proíbe** `settlementService.settle(`/
`regionAccountService.credit|debit(`/`unifyCardService.authorize|capture|settle(` alcançável e
`bank_ledger|bank_transactions|bank_splits` nas rotas; exige `migrated to Bank` presente nos 3 services
(morde se o stub Proxy for removido = relink sem gate). **Negative-proof versionado**
`scripts/negative-proof-marketplace-money-latent-containment.ps1`: religa `settlementService.settle` no
handler de settle (backup byte-exato) → **GATE FAIL (exit 1)** → restaura byte-idêntico (`WriteAllBytes`)
→ **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente, nenhum nas minhas alterações) ·
check:migrations OK (**sem migration**) · tsc baseline **43** (default tsconfig) — **0 erro novo na frente**.

## Escopo negativo

Sem migration/tabela/schema; **nenhum stub Proxy religado**; nenhum papel institucional decidido; Bank
Core/`bank_ledger`/`bank_transactions`/`bank_splits`/payout/recovery, R1 groups/R2 dashboard/R3 reports/
R5 intent-execute, referral **intocados**. A reativação real de settlement/unifycard/regionAccount fica
para frente própria (decisão de authority + binding server-side + fluxo Bank canônico + E2E financeiro +
reseal Yala). O restante do cluster money-latent (AP/AR/payment-split/payout) NÃO foi tocado.

## Estado

**🟡 IMPLEMENTED / HOLD YALA.** `DT-AUTHORITY-Z2-MARKETPLACE-MONEY-LATENT-ACTORID-UNBOUND` →
**IMPLEMENTED_AS_CONTAINED / HOLD YALA** (sub-caso de `DT-MONEY-LATENT-REACTIVATION-TRAP`, raiz OPEN).
**Esta frente fechou somente a contenção localizada das rotas marketplace money-latent settlement/
unifycard/regionAccount. Não religa Bank, não implementa fluxo financeiro, não fecha Z2 inteiro, Z1, Z3,
authority global nem a DT-mãe 0113** — `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` permanece
**OPEN**. CLOSED só no seal pós-Yala PASS material.
