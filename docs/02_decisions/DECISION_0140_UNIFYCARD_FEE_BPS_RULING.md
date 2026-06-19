# DECISION-0140 — Unidade canônica de taxa de método financeiro UnifyCard: `fee_rate_bps` (basis points)

**Status:** **DECIDED / DOCS-ONLY RULING / NOT MATERIAL IMPLEMENTATION.** Espelho cartorial — a DECISION-0140 já está
promulgada no log central `REMEDIATION_DECISIONS_LOG.md`. Este arquivo NÃO cria decisão nova; reflete a régua.

**Data:** 2026-06-19 · **Branch:** `rescue-structural` · **HEAD:** `52df866c` · **dev:** 394/394 (sem migration) ·
**Tipo:** Financeiro / Produto / Nomenclatura (DOCS-ONLY — régua, não implementação) · **Frente:**
F-FINANCIAL-DECISION-FEE-BPS-UNIFYCARD-METHOD · **Decisão soberana:** Clayton escolhe **B** + parecer IA-DINHEIRO.

## Régua promulgada

- **Banco:** `fee_rate_bps INTEGER`.
- **Backend/API:** `feeRateBps`.
- **Legado/deferred:** `fee_percentage` / `feePercentage` — não expandir, não usar em novas implementações.
- **Proibido como destino canônico:** `fee_percentage`, `feePercentage`, `*_percent`, `*_percentage`.
- **Conversão:** basis points — 1% = 100 bps; 2.99% = 299 bps. Alinha a `07_NOMENCLATURA_CANONICA §4.8`.
- **Razão:** elimina na raiz a ambiguidade de unidade do bug **299¢ vs 3¢** (contrato decimal `0.0299` vs consumidor
  de settlement que faz `/100` e assume `2.99`).

## Implementação material: NOT DONE

- `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` → **OPEN / MATERIAL_REQUIRED**.
- `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` → **DEFERRED / REQUIRES EVIDENCE PACK FINANCEIRO**.
- Trilho unifycard-method segue **CONTIDO** (R8Q, 501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED; schema ghost).

## Qualquer execução material exige (tripé + provas)

Evidence Pack financeiro (schema vivo; migration se aplicável; mapa de consumers — `unifycard.service` 299¢ /
`payment-execution.service` `/100`→3¢; snapshot) · 3 paralelas READ-ONLY · gates · **E2E monetário provando 299¢** ·
**negative-proof contra `/100`** · **Yala reseal**.

## Escopo negativo (desta régua)

NÃO corrige fee · NÃO remove `/100` · NÃO troca `fee_percentage`→`fee_rate_bps` no código · NÃO cria migration ·
NÃO toca settlement/Bank/Core/bank_ledger/payout/runtime · NÃO reativa o trilho · NÃO autoriza fee material ·
NÃO autoriza payout · NÃO fecha a DT financeira por inferência.

**Referências:** `REMEDIATION_DECISIONS_LOG.md` (DECISION-0140, fonte soberana) · `07_NOMENCLATURA_CANONICA §4.8` ·
`DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` · `DT-AUTHORITY-Z2-UNIFYCARD-METHOD-M5-MONEY-CONTAINMENT` (R8Q) ·
`docs/03_execution_log/20260619_F_FINANCIAL_DECISION_FEE_BPS_UNIFYCARD_METHOD.md`.
