# F-UNIFYCARD-FEE-BPS-MATERIAL-GO — EXECUTION (docs-only / Clayton GO / backfill NOT APPLICABLE)

Registro cartorial do GO de Clayton: **não há produção real nem dado financeiro real legado** relacionado a UnifyCard
fee → **backfill financeiro real = NOT APPLICABLE** no estado atual. **DOCS-ONLY: sem código, sem migration, sem
runtime, sem banco, sem dinheiro, sem payout, sem reativar R8Q 501, sem fechar DT material.** Apenas registra o GO/
cartório para que a próxima frente material possa ser PLANEJADA sob Evidence Pack. Tratado como execution log + STATUS/
DT (não DECISION nova — é fato operacional/status; as DECISIONs normativas são 0140 unidade + 0141 schema-of-record).

- **HEAD before:** `38bb8ebb` · **HEAD after:** (este commit docs-only) · **branch:** `rescue-structural`
- **working tree before:** limpo (material) · **working tree after:** só docs/cartório
- **migrations:** 394/394 PASS · **modo:** EXECUTOR · **natureza:** docs-only / GO Clayton / backfill ruling

## Arquivos lidos

00_AGENT_PROTOCOL · 07_NOMENCLATURA_CANONICA §4.8 · SSOT_EXCLUSIVE_BANK_RULE · SSOT_CONTRACT · SSOT_REGISTRY_UNIFICARD ·
PROHIBITED_STRUCTURES · LEIS_OPERACIONAIS_UNIFICARD · REMEDIATION_DECISIONS_LOG (DECISION-0140/0141) · REMEDIATION_DT_LOG ·
STATUS_EXECUCAO_GLOBAL · DECISION_0140_UNIFYCARD_FEE_BPS_RULING · DECISION_0141_UNIFYCARD_FEE_SCHEMA_OF_RECORD ·
F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD-DECISION-EXECUTION.

## Declaração Clayton (registrada)

Clayton confirma que o Unificard permanece **sem produção real** e **sem dado financeiro real legado** relacionado a
UnifyCard fee: não há usuários reais, empresas reais, transações reais, payouts reais, settlements reais, splits reais
ou dados financeiros reais que exijam reconciliação de `fee_percentage`→`fee_rate_bps`. Logo, **backfill financeiro real
= NOT APPLICABLE** para esta frente no estado atual.

## Evidência material (Paralela A, READ-ONLY em dev — confirma a declaração)

- `economic_policy_lines` = **LIVE, rows=0** (home canônico existe, íntegro, porém vazio).
- `payment_methods` = GHOST · `unifycard_payment_methods` = GHOST · `regional_fees` = GHOST · `settlements` = GHOST ·
  `event_settlements` = GHOST (to_regclass=null em dev).
- Colunas fee/bps no schema vivo: **somente `economic_policy_lines.bps`** — **zero `fee_percentage`/`feePercentage`/
  `fee_rate_bps`/`feeRateBps` em tabela aplicada**. → Não há dado legado fee a reconciliar.

## Consequência

A futura execução material poderá ser tratada como **materialização controlada local/dev**, com seed/configuração
canônica via `economic_policy_engine` / `economic_policy_lines.bps`, **sem reconciliação financeira histórica**. Isto
NÃO é a execução; é a remoção do bloqueador "backfill de produção".

## Limites (esta decisão NÃO faz)

NÃO autoriza payout · NÃO reativa R8Q 501 · NÃO fecha DT material · NÃO toca Bank/Core/bank_ledger/transactions/splits ·
NÃO substitui Evidence Pack financeiro · NÃO remove necessidade de Yala material · NÃO cria seed/policy/migration ·
NÃO executa E2E monetário · NÃO marca fee material como feito.

## Estados

- **F-UNIFYCARD-FEE-BPS-MATERIAL-GO** → **CLOSED / DOCS-ONLY / CLAYTON GO / BACKFILL NOT APPLICABLE**.
- **F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION** → **READY_FOR_MATERIAL_EXECUTION_PLANNING / NOT EXECUTED** (deixa de
  ter o bloqueador de backfill de produção; o restante do Evidence Pack permanece obrigatório).
- **DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION** → **OPEN / MATERIAL_REQUIRED** (NÃO fechada — só fecha com execução
  material + gates + Yala PASS).
- **Payout** → **NOT AUTHORIZED / OUT OF SCOPE.** **R8Q** → **501 CONTAINMENT PRESERVED.**

## o que fica autorizado / o que NÃO fica autorizado

- **Autorizado:** PLANEJAR a próxima frente material como materialização controlada local/dev (sem backfill histórico).
- **NÃO autorizado:** fee material executado · payout · reativação R8Q/payment_methods/unifycard_payment_methods/
  settlement · seed/policy/migration nesta frente · fechar DT material · pular Evidence Pack/Yala.

## Pré-condições preservadas para a execução material (Evidence Pack financeiro)

schema before/after · consumer map (`unifycard.service` 299¢ / `payment-execution` `/100`→3¢) · E2E monetário 299¢ ·
negative-proof contra `/100` · guard de nomenclatura (`_bps`/`fee_rate_bps`; `fee_percentage` proibido) · guard de
consumer · Bank boundary proof · settlement non-reactivation proof · payout non-touch proof · 3 paralelas READ-ONLY
(money-adjacent) · gates · Yala reseal. Fórmula material canônica (DECISION-0141): `gross_cents * fee_rate_bps / 10000`.

## Gates executados

actor-writer-boundaries · bank-ledger-boundaries · regression-guards · arch --strict · check:migrations 394/394 —
ver bloco de saída no relatório.

## Veredito

GO/backfill docs-only registrado. **Backfill real = NOT APPLICABLE** (Clayton + Paralela A). **Fee material ainda NÃO
executado. Payout NÃO autorizado. R8Q 501 preservado. DT material OPEN.** Próximo passo: prompt executor material único
para `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` (com Evidence Pack + 3 paralelas + Yala).
