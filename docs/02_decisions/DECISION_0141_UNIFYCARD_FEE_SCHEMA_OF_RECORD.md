# DECISION-0141 — UnifyCard Fee BPS Schema-of-Record (economic_policy_engine)

**Status:** **PROMULGADA / DOCS-ONLY / SCHEMA-OF-RECORD RULING / NOT MATERIAL IMPLEMENTATION.** Espelho cartorial —
a DECISION-0141 já está promulgada no log central `REMEDIATION_DECISIONS_LOG.md`. Este arquivo NÃO cria decisão nova.

**Data:** 2026-06-19 · **Branch:** `rescue-structural` · **HEAD:** `4fe02008` · **dev:** 394/394 (sem migration) ·
**Tipo:** Financeiro / Produto / Arquitetura / SSOT (DOCS-ONLY) · **Frente:** F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD ·
**Decisão soberana:** Clayton adota **B + D**.

## Âncora

DECISION-0140 decidiu a **unidade** (fee_rate_bps INTEGER / feeRateBps). Esta DECISION decide o **endereço soberano**
(onde a configuração de fee/split mora).

## Decisão (B + D)

1. Unidade canônica permanece: banco `fee_rate_bps INTEGER`; backend/API `feeRateBps`.
2. **Fonte canônica / SSOT de configuração de fee/split = `economic_policy_engine` / `economic_policy_lines.bps`**
   (bps INTEGER) — ancorado em DECISION-0047 (Economic Policy Engine = camada canônica de decisão de split) e na
   tabela viva `economic_policy_lines` (migration 20260530561000, coluna `bps`) + `economic_policy_resolution_logs`.
3. `payment_methods` e `unifycard_payment_methods` **NÃO** são SSOT financeiro.
4. Se reativadas futuramente, podem atuar **apenas** como: adapter · snapshot · read-model · interface operacional ·
   override modelado via economic_policy_engine. **Nunca SSOT financeiro paralelo.**
5. Nenhum path novo resolve política de fee/split fora do economic_policy_engine.
6. `payment_intents.metadata` pode guardar **snapshot auditável** da policy resolvida — **NÃO** SSOT; deve usar bps
   (`fee_rate_bps` / `feeRateBps`).
7. `fee_percentage` / `feePercentage` = legado/deferred/proibidos como destino canônico.
8. Trilho **R8Q UnifyCard-method permanece contido/501** até frente material própria (D).
9. Execução material futura usa: **`gross_cents * fee_rate_bps / 10000`**.
10. **Proibido:** `/100` ambíguo · `*100` órfão · `fee_percentage` runtime canônico · SSOT paralelo de fee em tabela
    de método · tocar Bank/Core fora do boundary · reabrir payout · reativar settlement/fundo regional sem frente própria.

## Justificativa

DECISION-0140 fixou a unidade, não o endereço. `07_NOMENCLATURA_CANONICA §4.8` exige `_bps` INTEGER. DECISION-0047
estabelece o economic_policy_engine como resolvedor canônico de policy/split/fee (substrato vivo: economic_policy_lines.bps).
Paralelas READ-ONLY A/B/C: payment_methods/unifycard_payment_methods ghost no dev; sem fee_percentage vivo em schema
aplicado; bug 299¢→3¢ latente/dormente por divergência de unidade + ausência de schema-of-record; solução segura =
economic_policy_engine como home canônico. `bank_ledger` permanece SSOT único de dinheiro realizado.

## Consequências (estados preservados)

- `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` → **DEFERRED / REQUIRES EVIDENCE PACK FINANCEIRO** (now governed by
  this schema-of-record ruling).
- `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` → **OPEN / MATERIAL_REQUIRED**.
- **Payout → NOT AUTHORIZED / OUT OF SCOPE.** R8Q 501 contido.
- Futura executora material exige: Evidence Pack financeiro · schema before/after · consumer map · E2E 299¢ ·
  negative-proof contra `/100` · guard de nomenclatura · guard de consumer · Bank boundary proof · settlement
  non-reactivation proof · payout non-touch proof · gates · Yala reseal.

## NÃO decididos aqui (frente futura)

Backfill de produção · reativação de payment_methods/unifycard_payment_methods/settlement · payout · política
comercial de taxa final · execução material.

**Referências:** `REMEDIATION_DECISIONS_LOG.md` (DECISION-0141, fonte soberana) · `DECISION-0047` · `DECISION-0140` ·
`07_NOMENCLATURA_CANONICA §4.8` · `economic_policy_lines.bps` (20260530561000) · `SSOT_EXCLUSIVE_BANK_RULE` ·
`DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` · `docs/03_execution_log/F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD-DECISION-EXECUTION.md`.
