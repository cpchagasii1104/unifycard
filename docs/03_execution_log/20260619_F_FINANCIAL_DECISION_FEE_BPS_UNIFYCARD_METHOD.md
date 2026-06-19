# 2026-06-19 — DECISÃO FINANCEIRA: fee bps para UnifyCard method (DECISION-0140, docs-only)

Promulgação normativa **docs-only** da unidade canônica de taxa do trilho UnifyCard method. **NÃO é implementação
material**: não toca código/runtime/settlement/Bank/migration. Régua, não correção de fee.

## Anchor

HEAD `a258973c` · branch `rescue-structural` · dev 394 · migrations 394/394 · working tree material limpo.

## Arquivos lidos (READ-FIRST)

STATUS_EXECUCAO_GLOBAL.md · REMEDIATION_DT_LOG.md · REMEDIATION_DECISIONS_LOG.md (formato + última DECISION-0139 →
nova = 0140) · `07_NOMENCLATURA_CANONICA §4.8` (bps/`_bps` INTEGER; `fee_percentage` ❌ proibido) · exec logs R8Q /
FINAL_SWEEP_0113 / Z3.

## Decisão promulgada — DECISION-0140 (Clayton escolhe B)

**Taxas percentuais de método financeiro UnifyCard DEVEM usar `fee_rate_bps INTEGER` no banco e `feeRateBps` no
runtime/API.** `fee_percentage`/`feePercentage` é **legado/deferred** — não expandir, não usar em novas
implementações. `fee_rate_bps` INTEGER elimina na raiz a ambiguidade de unidade que produziu o bug **299¢ vs 3¢**
(contrato decimal `0.0299` vs consumidor de settlement que faz `/100` e assume `2.99`). Alinha o trilho à régua já
existente `07_NOMENCLATURA_CANONICA §4.8`.

**Por que B:** A = legado divergente por omissão; C = exige Evidence Pack + mapa de consumers + Yala + 3 paralelas;
D = radical antes de provar reuso por cartão/acquiring; **B** promulga a régua sem tocar dinheiro/runtime (trilho já
contido em R8Q).

## Parecer IA-DINHEIRO (registrado)

Concorda com **B**: a régua bps mata a ambiguidade de unidade na raiz; B não move dinheiro nem muda runtime porque o
trilho unifycard-method já está contido (R8Q, 501); C não deve ser feito agora sem mapa de consumers + Evidence Pack
financeiro + Yala + 3 paralelas; A deixa o legado divergente por omissão; D é radical antes de provar que cartão/
acquiring não reaproveita o trilho.

## Ressalva material OBRIGATÓRIA

**B é promulgação de RÉGUA, NÃO fechamento da DT financeira.** A DT de fee-unit/settlement permanece **OPEN**. A
frente material futura só fecha com **Evidence Pack financeiro**: schema vivo, migration (se aplicável), mapa de
consumers, snapshot, **E2E provando 299¢**, guard, negative-proof, gates e Yala.

## Estados registrados

- `F-FINANCIAL-DECISION-FEE-BPS-UNIFYCARD-METHOD` → **DECIDED / B / DOCS-ONLY** (DECISION-0140).
- `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` → **OPEN / DECISION MATERIAL REQUIRED** (régua promulgada;
  implementação pendente).
- `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` → **DEFERRED / REQUIRES EVIDENCE PACK FINANCEIRO**.

## Escopo negativo

NÃO editou código/scripts/runtime/rotas · NÃO criou migration · NÃO tocou settlement/Bank/Core/bank_ledger/payout/
fee calculation · NÃO removeu `/100` · NÃO trocou `fee_percentage`→`fee_rate_bps` no código · NÃO criou snapshot ·
NÃO reativou o trilho UnifyCard/acquiring · NÃO fechou a DT financeira por inferência · NÃO reabriu 0113 (que segue
CLOSED/baseline zero). Docs-only; HEAD material permanece `a258973c`.

## Estados OPEN preservados (inalterados)

`DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` CLOSED/BASELINE ZERO · `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-
UNVALIDATED` CLOSED_WITH_CONTAINED_RESIDUALS · `DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` CLOSED ·
**OPEN:** DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION (agora com régua bps) · DECISION-0110 · DECISION-0114 D5 ·
organizer billing SaaS-vs-split · event_settlements ghost · CRM AR read · automation worker · human-mvp/G10.

## Próxima frente recomendada

`F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` quando priorizada: começa por READ-FIRST/Evidence Pack financeiro
(mapa de consumers de `fee_percentage` — unifycard.service 299¢ / payment-execution `/100`→3¢; schema vivo vs
archive 0142; snapshot) ANTES de qualquer código, com 3 paralelas READ-ONLY e Yala. NÃO executável autonomamente
sem decisão de sequenciamento de Clayton/IA-DINHEIRO.
