# Execução — F-SERVICE-FINANCIAL-FIREWALL-CODE (DECISION-0110 D8) — code-only protetivo

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `034a13ef` · **Decisão:** Clayton — fechar as portas vivas antes da cadeia canônica · **Esteira:** eu (escritora); par verifica.

## Objetivo
Bloquear/flagar **fail-closed** as rotas financeiras vivas de serviço (que a auditoria achou abertas e sem KYB) **até** a cadeia canônica estar desenhada/implementada/testada. Erro honesto; **preservar o código** para auditoria/cadeia futura; **não mover dinheiro**, não apagar histórico, não corrigir por baixo.

## READ-FIRST (rotas alvo, confirmadas)
- `POST /services/request/pay` (`services-discovery.routes.ts:246` → `payAcceptedRequest`, direto sem escrow).
- `POST /services/:serviceId/hire` (`service-hire.routes.ts:37`, auto-aceita + pagamento).
- `POST /services/payments/:paymentRequestId/execute` (`service-payment-execution.routes.ts:34` → escrow+ledger+splits).
- Todas registradas (prefix `/services`); a execução em `/services/payments`.

## Implementação (code-only)
- **`service-financial-firewall.ts` (novo):** `SERVICE_FINANCIAL_RUNTIME_FLAG='SERVICE_FINANCIAL_RUNTIME_ENABLED'`; `isServiceFinancialRuntimeEnabled()` = **true só se o flag === 'true'** (ausente/qualquer-outro = OFF = fail-closed); `serviceFinancialDisabledBody(route)` = corpo honesto (`error/code='SERVICE_FINANCIAL_RUNTIME_DISABLED'`, `decision='DECISION-0110'`, mensagem "desabilitada até a cadeia canônica; nenhum dinheiro é movido").
- **3 rotas:** firewall como **1ª instrução** do handler (antes de auth/lógica): `if (!isServiceFinancialRuntimeEnabled()) return reply.status(403).send(serviceFinancialDisabledBody('<rota>'));`. Imports adicionados; nenhuma outra lógica tocada.
- **Preservação:** o código financeiro permanece intacto (não apagado) — reabrir é **trocar o flag**, não reescrever. Auth/authz de cada rota a **revalidar** quando o flag reabrir (achado material DECISION-0110 §8).
- **NÃO** move dinheiro; **NÃO** implementa booking/release/escrow; **NÃO** mexe em ledger/splits como feature; **NÃO** migration/seed/frontend; **NÃO** abre refund/dispute.

## Prova
- **e2e efêmero `validate-pipeline-e2e-service-financial-firewall.ts` 11/11 verde** (fastify mínimo espelhando `services.module` + `fastify.inject`):
  - flag **default OFF** → `isServiceFinancialRuntimeEnabled()` false; as 3 rotas retornam **403 `SERVICE_FINANCIAL_RUNTIME_DISABLED`** (`decision='DECISION-0110'`), antes de qualquer lógica.
  - flag **ON** → o firewall **abre**; cada rota cai no **próximo guard** (auth/tenant → 400/401), resposta **NÃO** é mais a disabled → prova que o firewall é o portão e o **código foi preservado** (não apagado), **sem mover dinheiro**.
  - **Bank intocado** (`bank_ledger`+`bank_transactions`=0); zero `service_orders`/`payment_intents`/`service_payment_executions`. Flag restaurado OFF (sem vazar).
- Backend tsc só baseline geo. 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 365→365** (zero migration).

## DT
- **PARTIALLY MITIGATED:** `DT-SERVICE-DIRECT-PAYACCEPTEDREQUEST-LEGACY-BYPASS` (rota fail-closed; destino do trilho — aposentar vs ratificar — pendente); `DT-SERVICE-HIRE-AUTO-ACCEPT-POLICY-BREACH` (rota fail-closed; refazer auto-aceite pendente); `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` (rotas vivas fechadas; cadeia canônica pendente).
- **OPEN (com nota):** `DT-SERVICE-KYB-RELEASE-GATE-MISSING` (exposição runtime neutralizada; gate KYB ainda a implementar). `DT-SERVICE-PAYMENT-RELEASE-POLICY-MISSING` / `DT-SERVICE-REFUND-DISPUTE-POLICY-MISSING` / `DT-SERVICE-PAYMENT-CURRENCY-FIC-vs-BRL` seguem OPEN. **Nenhuma DT fechada.**

## Não-toque confirmado
migração/seed · movimento de dinheiro · booking/release/escrow/settlement · ledger/splits como feature · frontend · `service-payment-execution.service.ts`/`services-discovery.service.ts`/`service-order.service.ts` (lógica intocada — só o guard de entrada nas rotas) · refund/dispute · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Desenho da **cadeia canônica de serviço financeiro** (request → execution → escrow → release governado com KYB + decisão de release/timeout + moeda BRL) — **só ela reabre** o flag `SERVICE_FINANCIAL_RUNTIME_ENABLED`, após implementada e testada, revalidando auth/authz de cada rota. Refund/disputa = frentes próprias (e a referência à `DECISION-0052` entra lá). Espera go do Clayton.
