# Execução — DECISION-0110 (política financeira de serviços) — docs-only

**Data:** 2026-06-06 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `2431e375` · **Decisão:** Clayton — política financeira antes de runtime (aprovação + 3 ajustes) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Promulgar a política financeira de serviço **antes** de qualquer booking/order/payment runtime, fechando o blocker de governança: rotas de dinheiro já vivas + código opinando uma política nunca promulgada. Docs-only — não toca código/Bank/escrow/booking/payment/frontend.

## Antecedente (auditoria forense read-only, 3 paralelas; verificada por mim contra DB/código vivos)
- **Banco (dev):** todas as tabelas financeiras/booking de serviço = **0 linhas** (`bank_ledger`/`bank_transactions`/`bank_splits`/`payment_intents`/`service_payment_*`/`service_orders`/`bookings`/`service_booking_decisions`).
- **Rotas vivas sem KYB:** `POST /services/request/pay` (`services-discovery.service.ts:256`, direto sem escrow/split); `POST /services/payments/:id/execute` (`service-payment-execution.service.ts:641`, escrow+ledger+splits); `POST /services/:serviceId/hire` (`service-hire.routes.ts:37`, auto-aceita :75-79 + pagamento). `releaseFundsToActorWalletForOrder` (`service-order.service.ts:873`) sem rota/worker (custódia presa). KYB só em ações sociais (`pj-kyb-gate.ts`). Moeda: default `FIC` (`service-payment-request.service.ts:150`) × exige `BRL` (`service-payment-execution.service.ts:462`).
- **Stale NÃO importado:** 0109 promulgada; company-canonical aposentada; KYB-revocation fechada; checkout-mock = outra frente.

## Decisão promulgada (resumo — íntegra em `DECISION_0110`)
- **D1** pré-pago com escrow · **D2** direto proibido (payAcceptedRequest bloqueado/flagado/aposentado) · **D3** booking≠obrigação financeira · **D4** release só com confirmação/timeout promulgado (D-money via Bank) · **D5** cancel/dispute/refund precisam política (refund pós-release = frente própria/DT-PE5) · **D6** KYB approved obrigatório p/ saída; entrada escrow = custódia (não vira release/saque/saldo/aprovação); saída sem KYB = fail-closed · **D7** `bank_ledger` SSOT absoluto · **D8** rotas vivas declaradas FORA da política até o firewall (**não fecha runtime**).
- **Achado a revalidar (não-conclusão):** auth/authz fraca → revalidar no firewall.

## Ajustes de Clayton aplicados
1. A DECISION **declara** as rotas fora da política; **não fecha** runtime — quem fecha é `F-SERVICE-FINANCIAL-FIREWALL-CODE` (D8/§12).
2. Entrada em escrow sem KYB **cercada como custódia**: não autoriza release/saque/saldo-disponível/sinal-de-aprovação; saída PJ sem KYB = fail-closed (D6).
3. "Auth fraca" registrada como **achado material a revalidar no firewall** (§8), não conclusão ampla.

## Artefatos
- `docs/02_decisions/DECISION_0110_SERVICE_FINANCIAL_POLICY.md` (novo).
- `REMEDIATION_DT_LOG.md` — **6 DTs OPEN** (direct-payaccepted-bypass, hire-auto-accept, payment-release-policy-missing, kyb-release-gate-missing, refund-dispute-policy-missing, payment-currency-FIC-vs-BRL); `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` segue OPEN.
- `REMEDIATION_DECISIONS_LOG.md` — entrada DECISION-0110.
- `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, este log.

## Prova
Docs-only — runtime intocado. 4 gates: actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (365) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline). **Migrations 365→365** (zero migration).

## Não-toque confirmado
Nenhum `.ts`/`.sql`/`.mjs` de runtime · Bank/escrow · booking/payment/order · frontend · migration/schema (365) · nenhuma DT financeira fechada · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-SERVICE-FINANCIAL-FIREWALL-CODE` (code, protetivo) — bloquear/flagar **fail-closed** as rotas financeiras vivas, revalidando auth/authz de cada uma, até a cadeia canônica (request→execution→escrow→release+KYB) estar desenhada/implementada/testada. Restringe, não move dinheiro. Espera go do Clayton.
