# DECISION-0111 — Política fina de serviço: release, timeout, cancelamento, no-show, disputa, refund, KYB-no-release, split

**Data:** 2026-06-06
**Tipo:** Arquitetura / Financeiro / Serviços (Trilho B) — docs-only
**Status:** PROMULGADA (docs-only — não autoriza código/runtime/migration/Bank/release/refund/dispute; não reabre o flag)
**Frente:** `F-SERVICE-RELEASE-CANCEL-DISPUTE-REFUND-POLICY`
**HEAD de origem:** `10812621`
**Decisor:** Clayton (defaults do MVP cravados — "fechar o pacote de uma vez, sem descobrir a lei no stacktrace")

---

## 1. Título
Promulgar a **política fina** que faltava para a cadeia financeira canônica de serviço: **como** o release acontece
(confirmação do cliente; timeout de 7 dias), **quando** trava (disputa/KYB), **cancelamento** (pré-execução = refund;
pós = disputa), **no-show**, **refund** (pré-release = escrow; pós-release = recovery/DT-PE5), **KYB entre pagamento e
release** (custódia sem KYB; saída fail-closed), e **split** (imutável após ledger). Completa a `DECISION-0110`. Decide a
norma; **não toca código**; o firewall continua **OFF**.

## 2. Data
2026-06-06.

## 3. Tipo
Arquitetura / Financeiro / Serviços. Docs-only.

## 4. Status
PROMULGADA. Não autoriza implementar release/refund/dispute/no-show, tocar Bank/escrow/ledger, criar migration/worker,
alterar rotas/frontend, nem reabrir `SERVICE_FINANCIAL_RUNTIME_ENABLED`. Crava a política e atualiza DTs.

## 5. Contexto
A `DECISION-0110` cravou o esqueleto (pré-pago+escrow; direto proibido; booking≠obrigação; release por
confirmação/timeout; KYB na saída; ledger SSOT; rotas vivas fora-da-política) e deixou D4 (prazo de release) e D5
(cancel/no-show/disputa/refund) como frentes próprias. O firewall `10812621` está ativo (fail-closed por padrão). O
salão Bank-free está selado. Três auditorias forenses read-only confirmaram: runtime seguro (off), substrato com **0
linhas**, ledger SSOT sem bypass; falta a **política fina** antes de qualquer código. Esta DECISION fecha essa lacuna.

## 6. Decisões (D1–D11)

**D1 — Release por confirmação.** O release ao prestador acontece quando o **cliente confirma** a conclusão do serviço.
Confirmação do **prestador sozinha não libera** dinheiro. A confirmação do cliente precisa ocorrer sobre uma
`service_order`/payment execution **válida**. O release **sempre passa pelo Bank/ledger** (D-money → `actor_wallet`).

**D2 — Timeout de release.** Se o cliente não responder, o **MVP usa timeout de 7 dias corridos** após a marcação de
conclusão/entrega do serviço. Após 7 dias **sem disputa aberta**, o release fica **elegível**. O timeout **NÃO** libera
se houver: disputa aberta, bloqueio KYB, fraude, chargeback, inconsistência de ledger ou ordem inválida. O prazo de **7
dias é política MVP, ajustável** por decisão futura.

**D3 — Disputa trava release.** Qualquer disputa aberta **antes do release** bloqueia a saída ao prestador. A disputa
precisa registrar **motivo, actor que abriu, timestamp e estado**. No MVP, disputa é **resolução manual/governada** —
não automatizar julgamento.

**D4 — Cancelamento antes da execução.** Cancelamento **antes da execução do serviço** gera **refund integral do
escrow** ao pagador, desde que o dinheiro ainda **não** tenha sido liberado. Cancelamento **antes do pagamento** não
cria obrigação financeira. Cancelamento **depois da execução** não é cancelamento simples — **vira disputa**.

**D5 — No-show.** **Cliente** não comparece: **não** liberar automaticamente ao prestador no MVP — abrir caminho de
**disputa/manual**. **Prestador** não comparece: **refund integral ao cliente**, com **registro de falha do prestador**.
Multa/no-show fee ficam **fora do MVP** (decisão futura).

**D6 — Refund antes do release.** O refund antes do release **sai do escrow**, **passa pelo Bank/ledger**, **não** pode
alterar saldo fora do Bank, e **não** pode apagar payment/order — deve **registrar reversão/estado** (motor genérico:
`DECISION-0052`).

**D7 — Refund depois do release.** Refund pós-release **não** usa reversal simples do escrow. Depois que o dinheiro saiu
ao prestador, o refund exige **recovery/DT-PE5** (frente própria). **Não** drenar escrow de outros pagamentos. Base
genérica de estorno/recovery: `DECISION-0052` e `DECISION-0053`.

**D8 — KYB entre pagamento e release.** A **entrada em escrow pode existir sem KYB approved** (custódia). A
**saída/release** para prestador PJ **exige KYB approved**. Se o KYB cair para `pending/rejected/suspended/closed` entre
o pagamento e o release, o dinheiro **permanece bloqueado em escrow**. O sistema **falha fechado**: sem release, sem
saque, **sem saldo disponível**. Caminhos a seguir: regularização KYB, cancelamento/refund, ou disputa.

**D9 — Split.** O split de serviço precisa ser **definido antes** da execução financeira. Split só vira **verdade
financeira dentro da cadeia Bank/ledger**, e é **imutável após o ledger**. Percentuais/taxas da plataforma para serviços
ainda precisam de **configuração/decisão operacional** antes do runtime completo. **NÃO** usar metadata/status de
`service_order` como split financeiro.

**D10 — Booking, order e payment (camadas).** **Booking** = reserva temporal. **Payment request** = intenção/cobrança,
**não** liquidação. **Service_order** = estado operacional, **não** liquidação. **Payment execution + Bank/ledger** = o
**início da verdade financeira**. **Release** = outra etapa financeira, **separada** da captura/escrow.

**D11 — Firewall continua fechado.** `SERVICE_FINANCIAL_RUNTIME_ENABLED` permanece **OFF**. Esta DECISION **NÃO**
autoriza reabrir runtime. Reabrir o flag só depois de: **gate KYB no método de release** · **E2Es fail-first** ·
**idempotência** · **ledger double-entry** · **escrow hold** · **release por confirmação/timeout** · **cancel/refund
antes do release** · **bloqueio de refund pós-release sem recovery**.

## 7. O que esta DECISION ratifica
- Completa `DECISION-0110` (fecha D4/D5 que ficaram como frentes próprias).
- Ratifica Lei 5 (ledger SSOT) e `DECISION-0088` (KYB na saída) aterrando-os no caminho de release de serviço.
- Ratifica `DECISION-0052` (estorno split-aware pré-D-money) e `DECISION-0053` (recovery pós-D-money) como base do refund.
- Mantém a cerca corta-fogo (firewall OFF; política antes de runtime).

## 8. O que NÃO está autorizado
Implementar release/refund/dispute/no-show; tocar Bank/escrow/ledger/splits; criar migration/worker; alterar
rotas/frontend; reabrir o flag; fechar DT de runtime; "fazer o e2e passar".

## 9. Impacto em DTs (nenhuma de runtime fechada)
- `DT-SERVICE-PAYMENT-RELEASE-POLICY-MISSING` → **GOVERNED / DECISIONED** (política decidida — D1/D2/D3; **não CLOSED**, falta runtime).
- `DT-SERVICE-REFUND-DISPUTE-POLICY-MISSING` → **GOVERNED / DECISIONED** (política decidida — D3/D4/D5/D6/D7; **não CLOSED**, falta runtime).
- `DT-SERVICE-KYB-RELEASE-GATE-MISSING` → **OPEN** (política D8 clara; falta a implementação do gate no método de release).
- `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` → **PARTIALLY MITIGATED** (inalterada).
- `DT-SERVICE-DIRECT-PAYACCEPTEDREQUEST-LEGACY-BYPASS` → **PARTIALLY MITIGATED** (até aposentadoria/código).
- `DT-SERVICE-HIRE-AUTO-ACCEPT-POLICY-BREACH` → **PARTIALLY MITIGATED** (até refeito/código).
- `DT-SERVICE-PAYMENT-CURRENCY-FIC-vs-BRL` → **OPEN** (inalterada).
- **Abertas:** `DT-SERVICE-RELEASE-TIMEOUT-RUNTIME-MISSING` (política D2 decidida; rota/worker de timeout inexistente);
  `DT-SERVICE-NO-SHOW-RUNTIME-MISSING` (política D5 decidida; runtime de no-show inexistente).

## 10. Sequência autorizável (sem execução nesta DECISION)
1. **Esta DECISION** (docs-only).
2. **`F-SERVICE-KYB-RELEASE-GATE-METHOD-CODE`** (code) — gate KYB **fail-closed dentro do método** de saída/release
   (não só na rota), aterrando D8; e2e fail-closed nos 5 estados de KYB. **Não** reabre o flag.
3. E2Es fail-first da cadeia (ledger double-entry, escrow hold, idempotência, release por confirmação/timeout,
   cancel/refund pré-release, bloqueio de refund pós-release sem recovery) → cadeia canônica (execução+release na
   **mesma fatia**) → só então reabrir o flag, revalidando auth/authz (DECISION-0110 §8).

## 11. Referências
`DECISION-0110` (política financeira de serviço) · `DECISION-0088` (KYB na saída) · `DECISION-0052` (estorno split-aware)
· `DECISION-0053` (recovery/refund pós-D-money) · Lei 5 (ledger SSOT) · `DT-PE5` · firewall `service-financial-firewall.ts`
(`10812621`) · evidência: `service-order.service.ts:873` (`releaseFundsToActorWalletForOrder`, sem rota/worker),
`disputed_at` (trava release), `escrow_payments` (custódia).
