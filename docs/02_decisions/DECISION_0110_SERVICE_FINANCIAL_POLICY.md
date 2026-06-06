# DECISION-0110 — Política financeira de serviços (pré-pago + escrow; KYB segura a saída; ledger é verdade)

**Data:** 2026-06-06
**Tipo:** Arquitetura / Financeiro / Serviços (Trilho B) — docs-only
**Status:** PROMULGADA (docs-only — não autoriza código/runtime/migration/Bank/escrow/booking/payment)
**Frente:** `F-SERVICE-FINANCIAL-POLICY`
**HEAD de origem:** `2431e375`
**Decisor:** Clayton (política financeira antes de runtime; "rota viva demais para decisão de menos")

---

## 1. Título
Antes de qualquer booking/order/payment de serviço em runtime, cravar a **política financeira**: serviço pago é
**pré-pago com escrow**; pagamento direto cliente→prestador é **proibido** no fluxo canônico; **release** só com
confirmação do cliente ou timeout promulgado; **KYB approved obrigatório para a saída** ao prestador PJ;
`bank_ledger` é **SSOT financeiro absoluto**; e as **rotas financeiras já vivas ficam declaradas FORA da política**
(a serem bloqueadas/flagadas pela frente seguinte). Decide a norma; **não toca código** — quem fecha runtime é
`F-SERVICE-FINANCIAL-FIREWALL-CODE`.

## 2. Data
2026-06-06.

## 3. Tipo
Arquitetura / Financeiro / Serviços. Docs-only.

## 4. Status
PROMULGADA. Não autoriza implementar pagamento/booking financeiro, criar worker de release, tocar Bank/escrow/
frontend, nem fechar DT financeira. Só promulga a política e abre DTs. **NÃO fecha rota em runtime** — declara as
rotas financeiras vivas fora da política até a frente de firewall.

## 5. Contexto (estado verificado contra DB/código vivos; HEAD `2431e375`, dev 365)
- O serviço Bank-free está selado (`SELO-SERVICE-SALON-BANK-FREE`): criação governada por categoria/ramo +
  availability sobre o core real; sem booking/payment; sem Bank. `DECISION-0109` bloqueou booking/order/payment/Bank
  até decisão explícita.
- **Banco:** todas as tabelas financeiras/booking de serviço = **0 linhas** (`bank_ledger`/`bank_transactions`/
  `bank_splits`/`payment_intents`/`service_payment_requests`/`service_payment_executions`/`service_orders`/`bookings`/
  `service_booking_decisions`). Scaffold nunca exercido. `bank_ledger` (Lei 5) intacto, sem bypass nos caminhos.
- **Rotas financeiras VIVAS e SEM KYB (registradas, prefix `/services`):** `POST /services/request/pay`
  (`services-discovery.service.ts:256`, `createSimpleTransaction` **direto** — sem escrow/split/intent);
  `POST /services/payments/:paymentRequestId/execute` (`service-payment-execution.service.ts:641`, escrow+ledger+splits);
  `POST /services/:serviceId/hire` (`service-hire.routes.ts:37`, **auto-aceita** a decisão :75-79 e atinge pagamento).
- **Saída/D-money** `releaseFundsToActorWalletForOrder` (`service-order.service.ts:873`): **sem rota, sem worker**,
  só e2e → fundos entrariam no escrow e ficariam presos (risco de custódia).
- **KYB** (`pj-kyb-gate.ts:isPageActorKybApproved`) existe só em ações **sociais**; **ausente** no caminho de pagamento.
- **Moeda (confirmado):** payment-request default `currency='FIC'` (`service-payment-request.service.ts:150`) ×
  execução exige `BRL` (`service-payment-execution.service.ts:462`) → request default seria rejeitado.

**Itens stale do relatório (NÃO importados):** "DECISION-0109 não localizada" (FALSO — promulgada `8efd82c0`);
"company-canonical sem auth" (cadeia aposentada); "KYB revocation faltando" (writer/cascade/reader-defense fechados);
"checkout mock marketplace" (outra frente). Não contaminam esta decisão de serviço.

## 6. Problema
O código já **opina** uma política (pré-pago + escrow + release pós-confirmação) que nunca foi promulgada, e três rotas
de dinheiro estão vivas **sem KYB** e sem política — blocker de **governança**. Liberar runtime sem cravar a política
seria "vamos ver no que dá" em substrato financeiro.

## 7. Decisões (D1–D8)

**D1 — Timing: MVP de serviço pago = PRÉ-PAGO COM ESCROW.** O dinheiro entra **antes** da execução, fica em **escrow
(custódia)**, e libera **só** após conclusão/aceite/regra de release. Não há prestação paga sem dinheiro previamente
em custódia.

**D2 — Escrow, não direto.** Pagamento **direto** cliente→prestador é **proibido** no fluxo canônico de serviço. O
caminho legado `payAcceptedRequest` (transfer direto, sem escrow/split/intent) deve ser **bloqueado, flagado ou
aposentado** (execução na frente de firewall). Fluxo canônico = **payment request → execution → Bank → escrow → release**.

**D3 — Booking ≠ obrigação financeira.** Booking sozinho é **reserva temporal** (core `availability`/`bookings`), não
obrigação financeira. Contratação **paga** exige decision/acceptance + payment request. Booking pago **não** vira
contrato financeiro sem o trilho canônico (D2). _(O auto-aceite do `hire` viola "decisão é humana explícita" — DT própria.)_

**D4 — Confirmação e release.** O release ao prestador exige **confirmação do cliente OU timeout promulgado**. Release
automático **sem política é proibido**. O **prazo de release** deve ser decidido/parametrizado (hoje `now()+7d` em
código não é norma). D-money/release **passa pelo Bank/ledger** (sem mover saldo fora do Bank).

**D5 — Cancelamento/disputa/refund precisam de política.** Definir (frentes próprias): cancelamento pré-execução,
no-show, disputa interna, refund. **Refund pós-release = frente própria** (vínculo `DT-PE5`/recovery: estornar serviço
já liberado drena escrow alheio + deixa wallet indevido — não resolver aqui).

**D6 — KYB segura a SAÍDA.** KYB **approved obrigatório para release/saída** ao prestador **PJ**. A **entrada em escrow
pode existir sem KYB**, mas estritamente como **custódia** — e **NÃO** autoriza release, **NÃO** autoriza saque, **NÃO**
vira **saldo disponível**, **NÃO** é **sinal de aprovação** de KYB. **Saída para prestador PJ sem KYB approved =
fail-closed.** (Aterra DECISION-0088 no caminho de serviço.)

**D7 — SSOT financeiro: `bank_ledger` é absoluto.** `payment_intent`/`payment_request`/`service_order`/`booking`
**não são liquidação** (são índice/estado/custódia). Saldo **não** pode ser inferido fora do Bank. Split só é válido
**dentro** da cadeia Bank/ledger (double-entry, append-only).

**D8 — Rotas financeiras vivas ficam FORA da política até o firewall.** Esta DECISION **declara** (não fecha em
runtime): nenhuma rota financeira de serviço pode ser exposta/operada antes de (a) bloqueio/flag fail-closed e (b)
conformidade com D1–D7. Especificamente, antes de liberar runtime: `/services/request/pay` (legado direto) e o
auto-aceite de `/services/:serviceId/hire` ficam **fora da política**; `/services/payments/:id/execute` só pode rodar
com pré-condições normativas + KYB gate; booking/order/payment **não** expostos por endpoint fantasma. **Quem fecha
runtime é `F-SERVICE-FINANCIAL-FIREWALL-CODE`.**

## 8. Achado material a revalidar no firewall (NÃO é conclusão desta DECISION)
A auditoria observou **autenticação/autorização possivelmente fraca** em rotas financeiras vivas (ex.: `/services/request/pay`
por actionContext sem `req.user`; `/hire` com `providerActorId` do body não verificado). Esta DECISION **não** crava
conclusão ampla sobre auth — registra como **achado material**: `F-SERVICE-FINANCIAL-FIREWALL-CODE` deve **revalidar
autenticação/autorização de cada rota** antes de bloquear/flagar. A norma cravada aqui é apenas: **rota financeira sem
KYB gate e sem política financeira promulgada fica bloqueada**.

## 9. O que esta DECISION ratifica
- Lei 5 (Bank SSOT) e `DECISION-0109` (Bank fora até decisão explícita) — esta é a decisão que faltava.
- A disciplina `project_norma_assintotica` (código que opina política = drift a normatizar, não destino).
- A cerca corta-fogo do Bank: política antes de runtime financeiro.

## 10. O que NÃO está autorizado
Implementar pagamento/booking financeiro; criar worker de release; tocar Bank/escrow/frontend; expor rota financeira;
fechar DT financeira; "fazer o e2e passar"; importar achados stale (§5).

## 11. DTs abertas/atualizadas (nenhuma financeira fechada)
- `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` → permanece **OPEN** (até runtime seguro).
- **Abertas (OPEN):**
  - `DT-SERVICE-DIRECT-PAYACCEPTEDREQUEST-LEGACY-BYPASS` — `payAcceptedRequest` move dinheiro direto sem escrow/split/intent.
  - `DT-SERVICE-HIRE-AUTO-ACCEPT-POLICY-BREACH` — `hire` auto-aceita a decisão (viola "decisão humana").
  - `DT-SERVICE-PAYMENT-RELEASE-POLICY-MISSING` — release sem confirmação/timeout promulgado; D-money sem gatilho (sem rota/worker).
  - `DT-SERVICE-KYB-RELEASE-GATE-MISSING` — KYB ausente no caminho de pagamento; saída PJ sem KYB approved.
  - `DT-SERVICE-REFUND-DISPUTE-POLICY-MISSING` — cancelamento/disputa/refund sem política; refund pós-release = frente própria (DT-PE5).
  - `DT-SERVICE-PAYMENT-CURRENCY-FIC-vs-BRL` — payment-request default `FIC` × execução exige `BRL` (rejeição).

## 12. Sequência autorizável (sem execução nesta DECISION)
1. **Esta DECISION** (docs-only).
2. **`F-SERVICE-FINANCIAL-FIREWALL-CODE`** (code, protetivo) — bloquear/flagar **fail-closed** as rotas financeiras vivas
   (`/services/request/pay`, `/hire` auto-accept, `/execute` sem KYB), revalidando auth/authz de cada rota, **até** a
   cadeia canônica de serviço financeiro estar desenhada, implementada e testada. Restringe, não move dinheiro.
3. Cadeia canônica de serviço financeiro (frentes próprias, pós-firewall + D1–D7): payment request → execution → escrow
   → confirmação/timeout → release com KYB gate. **Nada** disso antes do firewall.

## 13. Referências
`DECISION-0109` (fundação Bank-free do Trilho B) · `DECISION-0088` (KYB gate, aterrada no serviço por D6) · Lei 5
(Bank SSOT) · `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` · `DT-PE5` (refund pós-D-money) · evidência:
`services-discovery.service.ts:256`, `service-payment-execution.service.ts:462/641`, `service-hire.routes.ts:37/75`,
`service-order.service.ts:873`, `service-payment-request.service.ts:150`, `pj-kyb-gate.ts`.
