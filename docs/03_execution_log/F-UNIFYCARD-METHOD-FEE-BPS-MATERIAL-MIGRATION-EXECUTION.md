# F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION — EXECUTION (MATERIAL / PENDING YALA)

Correção material da unidade+origem da taxa UnifyCard/marketplace: os consumers passam a resolver a taxa via
**economic_policy_engine** em **bps** (DECISION-0141 schema-of-record + DECISION-0140 unidade), eliminando o
`gross * (feePercentage / 100)` (bug 299¢ vs 3¢). **NÃO toca Bank/payout/settlement-reactivation; NÃO reabre R8Q
501; NÃO cria migration.** Materialmente seguro: ambos os sinks de fee são dead-at-code/db (provado abaixo).

- **HEAD before:** `0100fd17` · **HEAD after:** (este commit material) · **branch:** `rescue-structural`
- **working tree before:** limpo (material) · **working tree after:** material (8 arquivos) + docs
- **migrations before/after:** 394/394 (NENHUMA migration criada) · **modo:** EXECUTOR (ultracode) · **natureza:** material/fee bps

## READ-FIRST (3 paralelas READ-ONLY)

**Engine API:** `economicPolicyEngineService.resolveEconomicPolicy(input)` → `{status, policy, lines}`;
`calculatePolicySplits(amountCents, lines)` faz **`Math.floor((amountCents*line.bps)/10000)`** (linha 246) e exige
uma linha `revenue_share` para absorver drift. Referência correta = `services/service-payment-execution.service.ts`
(resolve→fail-closed→splits→snapshot bps). **Consumers/reachability:** `payment-execution.service.ts:714` fazia
`Math.round(gross*(feePercentage/100))` → **3¢**; `unifycard.service.ts:52` fazia `Math.round(gross*feePercentage)`
(sem /100) → **299¢** — divergência de unidade = o bug. `unifyCardMethodService.resolveFee` retorna feePercentage
DECIMAL (0.0299) de `unifycard_payment_methods` (GHOST). **Boundary:** `settlementService.createFromPayment` é
**Proxy-dead** ("Settlement migrated to Bank") **e** `settlements` GHOST; `unifyCardRepository` é **Proxy-dead**
("UnifyCard migrated to Bank"). → ambos os cálculos de fee alimentam paths mortos ⇒ mudança materialmente segura.
Bank só via facades (bankAccountService/bankTransactionService/unifyCardService.authorize); payout downstream/isolado.

## Re-verificação no-production / schema (READ-ONLY)

Confirmado em dev: `economic_policy_lines` LIVE rows=0; `payment_methods`/`unifycard_payment_methods`/`regional_fees`/
`settlements`/`event_settlements` GHOST; única coluna fee/bps viva = `economic_policy_lines.bps`. Sem produção/dado
real legado (Clayton GO + Paralela A) ⇒ sem backfill. R8Q 501 contido; payout fail-closed.

## Arquivos alterados (material)

- **NEW** `src/modules/marketplace/marketplace-fee-policy.ts` — resolvedor ÚNICO `resolveMarketplaceFeeViaPolicy(tenantId, grossAmountCents)`: resolve policy via engine (moduleContext `marketplace_payment`, vertical `marketplace`); fee = soma dos splits **não-`revenue_share`** (floor/bps); fail-closed (status≠resolved ⇒ fee=0, sem fallback em percentage); retorna feeRateBps/splits/policyId para snapshot.
- **M** `payment-execution.service.ts` — removido `resolvedFeePercentage`/`resolveFee` como origem; `feeResolution = resolveMarketplaceFeeViaPolicy(...)`; snapshot `unifycard_fee_snapshot` em bps (fee_rate_bps/fee_amount_cents/policy_*); settlement calc usa `feeResolution.feeAmountCents` (sem `/100`); metadata do settlement com bps. Bank/payout intocados.
- **M** `unifycard.service.ts` — removido `gross*feePercentage`; `feeResolution = resolveMarketplaceFeeViaPolicy(...)`; metadata da transação em bps. Repo segue Proxy-dead (não reativado).
- **NEW** `scripts/audit-unifycard-fee-bps-consumer.mjs` (wired em validate:regression-guards) — guard de consumer/nomenclatura.
- **NEW** `scripts/negative-proof-unifycard-fee-bps-consumer.ps1` — NP1–NP6 (pwsh 7 + WPS 5.1).
- **NEW** `src/scripts/validate-pipeline-e2e-unifycard-fee-bps.ts` — E2E 299 bps.
- **M** `package.json` — wire do guard.

## schema / policy / seed / consumer / snapshot

- **schema changes:** NENHUM (sem migration; `economic_policy_lines.bps` já existe).
- **policy/seed:** apenas FIXTURE EFÊMERA no E2E (`policy_code` `unifycard_fee_bps_e2e*`, moduleContext `marketplace_payment`), criada+limpa no próprio teste. NENHUM seed de produção/comercial.
- **consumer cutover:** payment-execution.service + unifycard.service resolvem via engine (resolveMarketplaceFeeViaPolicy).
- **snapshot bps:** `payment_intents`/transação metadata gravam fee_rate_bps/fee_amount_cents/policy_* (read-model, NÃO SSOT). Sem fee_percentage.

## Prova material — E2E 299¢ + negative-proofs

- **E2E** `validate-pipeline-e2e-unifycard-fee-bps` → **14/14**: A) 299 bps × 10000¢ = **299¢** via engine (resolved=true, feeAmountCents=299, net=9701, feeRateBps=299, policyId presente, sem chave percentage); B) fail-closed sem policy ⇒ fee=0/net=gross; C) resolvedor não importa Bank/settlement/payout, não lê payment_methods/unifycard_payment_methods, usa calculatePolicySplits; D) guard fee-bps verde + R8Q containment verde.
- **Negative-proofs** `negative-proof-unifycard-fee-bps-consumer.ps1` (pwsh 7 + WPS 5.1, restauração byte-idêntica): **NP1** /100 → FAIL · **NP2** *100 órfão → FAIL · **NP3** feePercentage contrato → FAIL · **NP4** fee fora do engine → FAIL · **NP5** payment_methods como SSOT → FAIL · **NP6** reabrir R8Q 501 → guard de containment FAIL.

## Proofs de boundary

- **Bank boundary:** payment-execution só interage com Bank via facades (inalteradas); zero bank_ledger/transactions/splits diretos no diff. **PASS.**
- **settlement non-reactivation:** settlementService permanece Proxy-dead + `settlements` GHOST; a mudança só corrige o valor de fee que alimenta o path morto; nenhuma tabela/rota de settlement criada/reaberta. **PASS.**
- **payout non-touch:** nenhuma alteração em payout/recovery/actor_wallet-payout; imports payout intactos. **PASS.**
- **R8Q 501 proof:** `audit-unifycard-method-money-containment` verde; rotas unifycard-method seguem 501. **PASS.**

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards **73 GATE OK / 0 FAIL** (+ guard novo) ·
arch `--strict` critical_new=0 (warning_new=4 pré-existente) · check:migrations **394/394** · actor-authority-boundary
flagged 0/baseline 0/new 0/stale 0 (inalterado) · tsc **43** (baseline, zero novos).

## DT status

- `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` → **EXECUTED / PENDING_YALA** (NÃO CLOSED — fecha só com Yala PASS material).
- `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` → **EXECUTED / MATERIAL / PENDING YALA**.
- Payout → **NOT AUTHORIZED** (inalterado). R8Q 501 → contido.

## Veredito

Fee UnifyCard/marketplace resolvida via economic_policy_engine em bps; `gross*(feePercentage/100)` eliminado; 299 bps
× 10000¢ = 299¢ provado; snapshot bps; fail-closed; Bank/payout/settlement/R8Q preservados; gates verdes; tsc baseline.
**Fee material EXECUTADO. Payout NÃO autorizado. DT PENDING_YALA.** Próxima ação: Yala reseal material.
