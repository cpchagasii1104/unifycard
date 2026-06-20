# F-UNIFYCARD-FEE-BPS-MATERIAL-YALA-WARNINGS — RECONCILIATION (docs-only)

Reconciliação cartorial após o **Yala reseal material = PASS_WITH_WARNINGS** do commit `2d3065b8`. Registra W1/W2 com
precisão e, só então, fecha a DT material **no escopo do path vivo**. **DOCS-ONLY: sem código, sem migration, sem
runtime, sem banco, sem Bank/Core, sem payout; não reabre R8Q 501; não toca settlement/regional-fee runtime.**

- **HEAD before:** `2d3065b8` · **HEAD after:** (este commit docs-only) · **branch:** `rescue-structural`
- **working tree before:** limpo (material) · **working tree after:** só docs/cartório
- **migrations:** 394/394 PASS · **modo:** EXECUTOR · **natureza:** docs-only / Yala warning reconciliation

## Arquivos lidos

00_AGENT_PROTOCOL · 07_NOMENCLATURA_CANONICA · REMEDIATION_DECISIONS_LOG · REMEDIATION_DT_LOG · STATUS_EXECUCAO_GLOBAL ·
DECISION_0140/0141 mirrors · F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION-EXECUTION.md · regional-fee.repository.ts
(READ-ONLY, verificação de resíduo) · settlement.service.ts (READ-ONLY, verificação de resíduo).

## Yala verdict

Yala reseal material do commit `2d3065b8` = **PASS_WITH_WARNINGS** (path vivo corrigido e provado; 299 bps × 10000¢
= 299¢; regression-guards 73 OK/0 FAIL).

## W1 — registrado (correção de precisão da claim 8/9)

A claim anterior de que `*100 órfão`/`fee_percentage` foram removidos **globalmente** é **imprecisa**. O correto:
`*100`/`fee_percentage` foram removidos do **path VIVO** da frente UnifyCard fee bps (`payment-execution.service.ts`
+ `unifycard.service.ts` + snapshot bps). **Persistem resíduos dead-code, sem impacto em dinheiro vivo**, em (verificado
READ-ONLY):
- `regional-fee.repository.ts:34` — `feeBps: Math.round(Number(row.fee_percentage) * 100)` (mapper; lê fee_percentage + *100).
- `settlement.service.ts:154-166` — `feePercentage = (feeAmountCents/grossAmountCents)*100` → `feeBps: Math.round(feePercentage * 100)`.

Por que NÃO impactam dinheiro vivo: `regional_fees` é GHOST (to_regclass null); `settlement.service` é Proxy-dead
("Settlement migrated to Bank"); o path vivo UnifyCard fee bps **não passa** por esses sites. O guard
`audit-unifycard-fee-bps-consumer` cobre apenas os 3 arquivos do path vivo (escopo correto) — **não** cobre esses 2.
Esses resíduos **NÃO bloqueiam** o fechamento da DT do path vivo, mas **bloqueiam** qualquer reativação futura de
settlement/regional_fees sem frente própria.

## W2 — registrado (follow-up de bloqueio)

Criado follow-up canônico **`DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD`** → **OPEN / BLOCKER_BEFORE_SETTLEMENT_
REACTIVATION**. Antes de qualquer reativação de settlement/regional_fees, DECISION-0114 D5 ou frente de fundo regional:
(a) migrar esses sites para engine-bps **ou** tombstone explícito; **e** (b) estender o guard
`audit-unifycard-fee-bps-consumer` para cobrir `regional-fee.repository.ts` e `settlement.service.ts`.

## DT criada/atualizada

- **DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION** → **CLOSED / MATERIAL / YALA PASS_WITH_WARNINGS** (escopo: path vivo —
  payment-execution + unifycard service + snapshot bps + E2E 299¢ + guards + negative-proofs + Bank boundary + R8Q
  containment + payout non-touch). **NÃO cobre:** reativação de settlement, regional_fees, fundo regional, payout,
  DECISION-0114 D5, actor_wallet payout, availableBalanceCents como autorização.
- **DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD** → **OPEN / BLOCKER_BEFORE_SETTLEMENT_REACTIVATION** (follow-up W2).
- **F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION** → **CLOSED / MATERIAL / YALA PASS_WITH_WARNINGS**.

## DT material status / F-material status / payout / R8Q

DT material: **CLOSED / MATERIAL / YALA PASS_WITH_WARNINGS** (path vivo). F-material: **CLOSED / MATERIAL / YALA
PASS_WITH_WARNINGS**. Payout: **NOT AUTHORIZED** (inalterado). R8Q: **501 PRESERVED**.

## Escopo negativo

NÃO editou código/scripts/guards/tests/package.json · NÃO criou migration · NÃO tocou banco/runtime/Bank/Core/payout ·
NÃO tocou regional-fee.repository.ts nem settlement.service.ts (só leitura) · NÃO reabriu R8Q 501 · NÃO alterou norma.
Docs-only; HEAD material permanece `2d3065b8`.

## Gates

actor-writer-boundaries · bank-ledger-boundaries · regression-guards (73 OK/0 FAIL) · arch --strict (critical_new=0) ·
check:migrations 394/394 — ver bloco de saída no relatório.

## Veredito

Cartório corrigido (W1/W2). DT material fechada no escopo do path vivo (Yala PASS_WITH_WARNINGS). Follow-up
settlement/regional-fee aberto como bloqueador de reativação. **Payout NÃO autorizado. R8Q 501 contido.**
