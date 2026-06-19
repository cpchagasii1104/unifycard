# F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD — DECISION EXECUTION (docs-only)

Promulgação docs-only da **DECISION-0141** definindo o schema-of-record da configuração de fee UnifyCard em bps.
**DOCS-ONLY: sem código, sem migration, sem runtime, sem money runtime.** Não implementa, não reativa rota, não
toca Bank/Core, não toca payout, não move dinheiro.

- **HEAD before:** `4fe02008` · **HEAD after:** (este commit docs-only) · **branch:** `rescue-structural`
- **working tree before:** limpo (material) · **working tree after:** só docs/cartório
- **migrations:** 394/394 PASS · **modo:** EXECUTOR · **natureza:** docs-only / DECISION

## Arquivos lidos

00_AGENT_PROTOCOL.md · 07_NOMENCLATURA_CANONICA.md (§4.8) · SSOT_EXCLUSIVE_BANK_RULE.md · SSOT_CONTRACT.md ·
SSOT_REGISTRY_UNIFICARD.md · PROHIBITED_STRUCTURES.md · LEIS_OPERACIONAIS_UNIFICARD.md · REMEDIATION_DECISIONS_LOG.md
(DECISION-0047@3599 "Economic Policy Engine camada canônica de split"; DECISION-0140@fim; próximo nº = 0141) ·
REMEDIATION_DT_LOG.md · STATUS_EXECUCAO_GLOBAL.md · DECISION_0140_UNIFYCARD_FEE_BPS_RULING.md ·
F-0131-BACKLOG-DOCS-RECONCILIATION-EXECUTION.md · DECISION_0110_SERVICE_FINANCIAL_POLICY.md.

## Evidência material (live repo)

- **DECISION-0047 EXISTE** (REMEDIATION_DECISIONS_LOG:3599) = Economic Policy Engine como camada canônica de DECISÃO
  de split → confirma a âncora de B.
- **`economic_policy_lines` é tabela canônica viva** (migration `20260530561000_create_economic_policy_lines.sql`)
  **com coluna `bps`** + `economic_policy_resolution_logs` (20260530564000) → o home canônico já usa bps INTEGER.
- `payment_methods`/`unifycard_payment_methods` = ghost no dev (confirmado em R8Q); sem `fee_percentage` vivo em
  schema aplicado.
- Arquivos normativos SSOT presentes (SSOT_EXCLUSIVE_BANK_RULE/CONTRACT/REGISTRY/PROHIBITED/LEIS).

## DECISION promulgada

**DECISION-0141 — UnifyCard Fee BPS Schema-of-Record** → PROMULGADA / DOCS-ONLY / SCHEMA-OF-RECORD RULING / NOT
MATERIAL IMPLEMENTATION (log central + mirror `docs/02_decisions/DECISION_0141_UNIFYCARD_FEE_SCHEMA_OF_RECORD.md`).

## Ruling escolhido / rejeitado

- **Escolhido (Clayton): B + D.** B = economic_policy_engine / economic_policy_lines.bps é o SSOT de fee/split. D =
  UnifyCard-method permanece contido/ghost/501 até frente material própria.
- **Rejeitado / não-decidido:** SSOT de fee em payment_methods/unifycard_payment_methods (proibido como SSOT
  paralelo); reativação dessas tabelas; reativação de settlement/fundo regional; payout; backfill de produção;
  política comercial de taxa final; execução material — todos frente futura.

## Estados (após esta DECISION)

- **CLOSED / DOCS-ONLY DECISION (B + D):** F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD.
- **PROMULGADA / DOCS-ONLY / NOT MATERIAL:** DECISION-0141.
- **DEFERRED:** F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION (now governed by schema-of-record ruling; REQUIRES
  EVIDENCE PACK FINANCEIRO).
- **OPEN / MATERIAL_REQUIRED:** DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION.
- **NOT AUTHORIZED / OUT OF SCOPE:** payout.
- R8Q 501 unifycard-method: contido (inalterado).

## o que continua DEFERRED

F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION (Evidence Pack financeiro + tripé + E2E 299¢ + negative-proof `/100`
+ guards nomenclatura/consumer + Bank boundary + settlement non-reactivation + payout non-touch + gates + Yala).

## o que continua OPEN / NOT AUTHORIZED

OPEN/MATERIAL_REQUIRED: DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION. NOT AUTHORIZED: payout (PORTA-1 + frente própria).
Demais (DECISION-0110/0114 D5, organizer billing, event_settlements, CRM AR, automation worker, human-mvp/G10):
inalterados, frentes/decisões próprias.

## Escopo negativo

NÃO editou código/scripts/runtime/rotas · NÃO criou migration · NÃO criou `fee_rate_bps` em tabela · NÃO reativou
payment_methods/unifycard_payment_methods/rotas 501 · NÃO tocou Bank/Core/bank_ledger/transactions/splits/settlement/
payout · NÃO alterou norma (07_NOMENCLATURA intocado; apenas citado) · NÃO fechou DT material · NÃO transformou em
implementação. DECISION-0140 permanece só régua de unidade. Docs-only; HEAD material permanece `4fe02008`.

## Gates executados

actor-writer-boundaries · bank-ledger-boundaries · regression-guards · arch --strict · check:migrations 394/394 —
ver bloco de saída no relatório.

## Veredito

DECISION docs-only promulgada (0141). Schema-of-record = economic_policy_engine / economic_policy_lines.bps.
UnifyCard-method continua contido. **Fee material NÃO autorizado.** **Payout NÃO autorizado.** Próximo passo: Yala reseal.
