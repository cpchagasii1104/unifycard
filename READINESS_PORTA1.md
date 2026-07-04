# READINESS PORTA-1 — read-first do cluster de dinheiro (read-only, verificado no disco 2026-07-04)

> **Propósito:** pré-mapear, SEM tocar código nem dinheiro, tudo que precisa ser decidido/fechado
> ANTES de semear saldo (PORTA-1). Assim, quando Clayton decidir abrir a porta, a execução é rápida
> e ele decide com o tabuleiro inteiro à vista. **Zero código alterado por este doc.**
> **HEAD `a81dd67cf` · branch `rescue-structural` · verificado em 1ª pessoa.**
>
> **Por que agora:** a campanha de autoridade está esgotada (ver `MAPA_DE_FECHAMENTO`). O dinheiro é
> a última fronteira — e é 100% decisão soberana de Clayton. Este é o dever de casa read-only.

---

## A TESE (a corda e as facas)

Hoje **NADA de dinheiro se move** — o cofre (`bank_ledger`) está vazio e vários caminhos estão
contidos por stubs bloqueados ou tabelas schema-ghost. Cada item abaixo é inofensivo enquanto o
ledger está vazio. **Semear saldo descongela TODOS de uma vez.** Por isso PORTA-1 não é "ligar o
dinheiro" — é *fechar as facas antes de cortar a corda*. A doutrina do próprio sistema proíbe usar
"tabela vazia" como prova de segurança (`financial-worker-gate.ts:24`).

---

## O CLUSTER (5 itens, cada um com estado VERIFICADO no disco)

### 1. V3 — sink `executePayment` sem firewall interno · 🔴 ALTA
- **Disco:** `payment-execution.service.ts:96` — `executePayment` NÃO tem assert de firewall no corpo
  (verificado: linhas 96-130 sem `assert*/firewall/RUNTIME`). Escreve `bank_ledger` real.
- **5 callers:** `event.routes.ts`, `automation/scheduled-action.service.ts`,
  `pdv/pdv.service.ts`, `subscriptions/subscription.service.ts`, `venue/venue.routes.ts`.
  **PDV** tem firewall no CALLER (`pdv.service.ts:228`, verificado em sessão anterior). Os outros 4
  (event, automation, subscription, **venue** — este é rota PÚBLICA por QR token, sem `req.user`)
  compartilham o sink SEM contenção.
- **Contido hoje por:** ledger vazio (transfer falharia por INSUFFICIENT_FUNDS).
- **Fix estrutural (quando decidir):** mover o assert de firewall para DENTRO de `executePayment`
  (o SINK), como o trilho **rides** já fez (`DT-RIDES-MONEY-NO-FIREWALL...` CLOSED) — para novos
  entrypoints herdarem a contenção. **Decisão:** firewall no sink default-OFF antes de semear.

### 2. Core de Aprovação Financeira — MODEL vivo, EXECUTION HOLD · 🔴 ALTA (norma-fantasma)
- **Disco:** `financial_approval_authorities`, `financial_approval_policies`,
  `financial_approval_policy_events` = **LIVE**; `financial_approval_requests` /
  `financial_approval_approvals` = **live=0** (o runtime request→aprovação→execução NÃO existe).
- **Norma:** DECISION-0128 exige o Core p/ TODO movimento de dinheiro. Hoje bank-http/payout movem
  (moveriam) sem se vincular a ele → norma existe, runtime não (`DT-CORE-FINANCIAL-APPROVAL-MOTOR`:
  MODEL materializado, EXECUTION HOLD).
- **Decisão:** materializar o motor request→aprovação (4-olhos por principais já existe no payout) e
  vincular os sinks a ele, OU ratificar explicitamente um caminho mínimo para o MVP.

### 3. Split-engine — stub · 🟠 ALTA
- Motor de split (treasury) não materializado; `bank_splits` append-only já tem guard. Sem runtime
  de split, o rateio de recebíveis não acontece. **Decisão:** materializar split ou definir MVP
  sem-split (pagamento direto ao provider).

### 4. Resíduos move-money 0113 (bank-http / payout) · 🟡 CONTIDOS (re-verificar)
- **bank-http:** os writers viraram REQUEST-ONLY (`createFinancialApprovalRequest`, sem
  bank_transaction/ledger) — `F-BANK-HTTP-AUTHORITY-BINDING`. GET /balance = leitura (Forma E).
- **payout:** writers FAIL-CLOSED (403 `PAYOUT_HTTP_EXECUTION_DISABLED`, sem executor); readers 4-olhos
  por principais (`req.user.id`, não atores). Baseline 0113 = 0.
- **Estado:** contidos por design (não por vazio). Re-verificar que seguem contidos ao ligar o Core.

### 5. `/cta/:cta_id/confirm` — social ledger · 🟢 CONTIDO (refina o OBS da YALA #2)
- **Disco:** `social-2.0.routes.ts:826+` computa `amountCents` de `cta.price` e chama
  `socialLedgerService.recordEntry(... amount_type:'revenue'/'profit_share')`. A YALA sinalizou como
  "handler vivo grava ledger sob auth simples".
- **REFINAMENTO (verificado):** `social-ledger.service.ts:58` — `recordEntry` lança
  **`DERIVA_FINANCEIRA_BLOQUEADA` INCONDICIONALMENTE**; `social_ledger`/`social_ledger_entries` =
  schema-ghost (live=0). O `owner_actor_id` = actor do próprio caller (server-side, NÃO impersonação).
  → **A escrita de dinheiro está HARD-BLOCKED.** O caminho de cálculo existe, mas nada grava.
- **Decisão (PORTA-1):** ao materializar `social_ledger`, revisar o binding de aprovação financeira
  do /cta (o owner já é server-side; falta o vínculo ao Core de Aprovação). Hoje = inócuo.

---

## MAPA DA CONVERGÊNCIA (o que descongela junto ao semear saldo)

```
   SEMEAR SALDO (PORTA-1)
          │
          ├─→ V3 sink sem firewall  ── venue-público/automation/subscription escrevem ledger
          ├─→ Core Aprovação fantasma ── movimento sem 4-olhos/policy (DECISION-0128)
          ├─→ split-stub            ── rateio não acontece / acontece errado
          ├─→ /cta social_ledger    ── se materializar junto, grava revenue sob o caminho atual
          └─→ resíduos 0113         ── re-verificar contenção sob Core ligado
```

**Regra:** fechar V3 + Core (mín.) ANTES de semear. Split e /cta podem ser MVP-sem ou materializados
conforme a decisão de produto. Resíduos 0113 = re-verificação.

---

## SEQUÊNCIA SUGERIDA PARA O DECISION PACK (quando Clayton der GO)

1. **DECIDIR o modelo de aprovação** (Core mínimo vivo vs. ratificar caminho MVP) — é a raiz; tudo
   pendura nela.
2. **Firewall no sink** `executePayment` (default-OFF) — contenção estrutural, herda para os 4 callers.
3. **Decidir split** (materializar vs. MVP-direto).
4. **Semear saldo** só depois de 1-2 fechados; validar com E2E de dinheiro real (ephemeral).
5. **/cta + social_ledger** e **resíduos 0113** = re-verificação pós-Core.

**Nada disto é executável sem a decisão soberana de Clayton** (é dinheiro). Este doc é o dever de
casa read-only para que a decisão seja rápida e informada.

---

*Read-first montado pela executora, read-only, verificado no disco. Nenhum código alterado, Δbank=0.
A ordem e o "se" são decisão de Clayton — este mapa só ilumina.*
