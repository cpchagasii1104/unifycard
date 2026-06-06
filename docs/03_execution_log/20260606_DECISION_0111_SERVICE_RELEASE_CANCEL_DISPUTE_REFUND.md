# Execução — DECISION-0111 (política fina de serviço: release/cancel/dispute/refund) — docs-only

**Data:** 2026-06-06 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `10812621` · **Decisão:** Clayton — defaults do MVP cravados (D1–D11) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Promulgar a **política fina** que a `DECISION-0110` deixou como frentes próprias (D4 prazo de release; D5 cancel/no-show/disputa/refund) — para que o código financeiro futuro nasça com a lei já escrita, não "descoberta no stacktrace". Docs-only; firewall continua OFF.

## Decisões promulgadas (D1–D11 — íntegra em `DECISION_0111`)
- **D1** release por confirmação do cliente (prestador sozinho não libera; via Bank/ledger).
- **D2** timeout **7 dias corridos** (MVP ajustável); não libera com disputa/KYB-bloqueio/fraude/chargeback/ledger-inconsistente/ordem-inválida.
- **D3** disputa trava o release (motivo/actor/timestamp/estado; manual no MVP).
- **D4** cancelamento pré-execução = refund integral do escrow; pós-execução vira disputa.
- **D5** no-show: cliente→disputa/manual (sem release auto); prestador→refund integral + registro de falha (multa fora do MVP).
- **D6** refund pré-release sai do escrow via Bank/ledger (não apaga payment/order; motor `0052`).
- **D7** refund pós-release = recovery/DT-PE5 (não drena escrow alheio; base `0052`/`0053`).
- **D8** KYB: entrada escrow sem KYB (custódia); saída exige KYB approved; queda de KYB entre pagamento e release → escrow bloqueado, fail-closed (sem release/saque/saldo).
- **D9** split definido antes da execução; verdade só no ledger; imutável após; alíquotas = decisão operacional pendente; não usar metadata de `service_order` como split.
- **D10** camadas: booking=reserva, payment_request=intenção, service_order=estado, execution+ledger=início da verdade, release=etapa separada.
- **D11** firewall continua OFF; não reabre runtime; reabrir só após KYB-gate-method + E2Es fail-first + idempotência + double-entry + escrow hold + release governado + bloqueio refund pós-release sem recovery.

## Artefatos
- `docs/02_decisions/DECISION_0111_SERVICE_RELEASE_CANCEL_DISPUTE_REFUND_POLICY.md` (novo).
- `REMEDIATION_DT_LOG.md` — `DT-SERVICE-PAYMENT-RELEASE-POLICY-MISSING` e `DT-SERVICE-REFUND-DISPUTE-POLICY-MISSING` → **GOVERNED/DECISIONED**; **2 novas DTs OPEN** (`DT-SERVICE-RELEASE-TIMEOUT-RUNTIME-MISSING`, `DT-SERVICE-NO-SHOW-RUNTIME-MISSING`); demais inalteradas.
- `REMEDIATION_DECISIONS_LOG.md` — entrada DECISION-0111.
- `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, este log.

## Prova
Docs-only — runtime intocado. 4 gates: actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (365) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline). **Migrations 365→365** (zero migration). Flag `SERVICE_FINANCIAL_RUNTIME_ENABLED` permanece OFF.

## Não-toque confirmado
Nenhum `.ts`/`.sql`/`.mjs` de runtime · Bank/escrow/ledger/splits · release/refund/dispute/no-show · worker/rota · frontend · migration/schema (365) · flag (OFF) · nenhuma DT de runtime fechada · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-SERVICE-KYB-RELEASE-GATE-METHOD-CODE` (code) — gate KYB **fail-closed dentro do método** de saída/release (não só na rota; fecha o achado rota×método), aterrando D8, com e2e fail-closed nos 5 estados de KYB. **Não** reabre o flag. Depois: E2Es fail-first da cadeia → cadeia canônica (execução+release na mesma fatia) → reabertura do flag (revalidando auth/authz). Espera go do Clayton.
