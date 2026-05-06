# AUTHORITY_MAP_FINANCIAL_v1.md

---

## 0. Snapshot

* **Repo:** backend
* **Commit SHA:** `05fee6f35a0e0d052f1df70591509520096b7d5e`
* **Data:** `13/04/2026` (última atualização documental deste ficheiro)
* **Responsável:** execução Cursor (Agent) — alinhar ao commit ao integrar

**Estado:** Fase **-1** (contenção leituras + rotas) **executada**; inventário **`transfer()`** **§8.4**; log **`transfer_completed`** ativo em `bank-transaction.service.ts`. **Tooling:** Jest **29** alinhado com **`jest-util@29.7.0`** (override `pnpm` na raiz) + `@jest/globals@29`; script **`test:financial-db-structural:ci`** em `backend/package.json`. **CI:** `.github/workflows/ci.yml` — job **`financial-integrity-invariants`** (Postgres, `migrate` + `seed`, `RUN_FINANCIAL_DB_STRUCTURAL` + `RUN_FINANCIAL_INTEGRITY`); `check-contract-usage` depende deste job. `.github/workflows/backend-ci.yml` — job **`financial-chaos`** mantém o mesmo pipeline para alterações em `backend/**`.

---

## 1. Âmbito (v1)

### Incluído

* Saldo (ledger)
* Movimentos financeiros
* Payment intents
* Liquidação (settlement)
* Reconciliação que escreve ajustes
* Eventos que disparam escrita financeira

### Excluído (fase 2)

* Social
* Catálogo
* Notificações
* Observabilidade pura (read-only)

---

## 2. Regras de Prova (OBRIGATÓRIO)

Uma linha só é válida se tiver:

* Writer com:

  * arquivo
  * função
  * operação real (SQL / ORM)
* Callers identificados
* Evidência via código (não comentário)

Sem isso:

> ❌ NÃO É FATO

---

## 3. Classificação de Risco

| Código | Tipo                 | Definição                                             |
| ------ | -------------------- | ----------------------------------------------------- |
| 🟥     | Bug real             | Escrita incorreta ou leitura que produz dados errados |
| 🟧     | Superfície enganosa  | API ≠ persistência                                    |
| 🟨     | Governança implícita | Regra existe mas não está explícita                   |
| 🟠     | Risco intermediário  | Governança + incompletude                             |

---

## 4. Fase -1 — Contenção (BASEADA EM EVIDÊNCIA)

### Problema confirmado (histórico — execução 2026-04)

`modules/ledger` (stub) era utilizado por reporting, risk dashboard, identity, rotas HTTP de ledger, payout batch e invoicing.

### Impacto comprovado (antes da correção)

* GMV / receita / séries derivadas do economy ledger → incorretas ou vazias

### NÃO comprovado

* Que todos os dashboards estão errados
* Que todo o sistema financeiro está incorreto

---

### Ações (executadas)

* [x] Consumidores de `ledgerService.listEntries` / leituras: migrados para `bank_ledger` / `bank_transactions` / `reporting-bank-aggregates.ts` (reporting, risk dashboard, identity, `ledger.routes` em modules + economy, payout batch, invoicing `getEntryById`).
* [x] `reporting.service.ts`: KPIs e exportações usam agregações SQL no Bank SSOT.
* [x] `recordEntry` em `service-order.service.ts`: erro ainda não bloqueante — **documentado** no código (economy ledger stub); SSOT de dinheiro: `bank_*`.

---

### Classificação (após mitigação)

* Leituras / KPIs que dependiam do stub: **mitigados** (fonte Bank SSOT — ver §13).
* **Pendente:** `modules/ledger` **writes** (`recordEntry`) continuam stub; `service-order` documenta catch não bloqueante (ver código).

---

## 5. Mapa de Autoridade

### Estrutura

| Recurso | Papel | Writer Canônico | Operação | Callers | Readers | Exceções | Risco | Notas |
| ------- | ----- | --------------- | -------- | ------- | ------- | -------- | ----- | ----- |

---

### 5.1 bank_ledger

| Recurso     | Papel                | Writer Canônico                                      | Operação                    | Callers    | Readers    | Exceções                                  | Risco | Notas                                         |
| ----------- | -------------------- | ---------------------------------------------------- | --------------------------- | ---------- | ---------- | ----------------------------------------- | ----- | --------------------------------------------- |
| bank_ledger | Candidato SSOT saldo | modules/bank/bank-ledger.repository.ts → createEntry | INSERT INTO bank_ledger | createTransactionFromIntent → financial.commands.ts; executePayment → marketplace/payment-execution.service.ts | reporting (`reporting-bank-aggregates`, export); `modules/ledger/ledger.routes`; `core/economy/ledger/ledger.routes`; identity; risk dashboard; invoicing `getEntryById`; payout batch | Nenhum INSERT externo encontrado em `src` (exceto manutenção documentada no repo) | 🟨    | Leituras operacionais migradas para este SSOT |

**Status técnico:**
- Writer único confirmado no código (src)

**Status de produto:**
- SSOT ainda pendente validação de readers e fluxos externos

---

### 5.2 bank_transactions

| Recurso           | Papel                  | Writer Canônico                          | Operação      | Callers    | Readers    | Exceções                                               | Risco | Notas                                      |
| ----------------- | ---------------------- | ---------------------------------------- | ------------- | ---------- | ---------- | ------------------------------------------------------ | ----- | ------------------------------------------ |
| bank_transactions | Transações financeiras | modules/bank/bank-transaction.service.ts → transfer | INSERT + UPDATE internal_completed_at | Ver **§8.4** (lista completa de callers) | reporting (`sumBankTransactionVolumeCents`, séries por `reference_type`) | gateway → UPDATE `external_settled_at`; gateway → `transfer()` | 🟠    | Log pós-sucesso: `financial_event: transfer_completed` |

---

### 5.3 payment_intents

| Recurso         | Papel               | Writer Canônico                                | Operação        | Callers    | Readers    | Exceções               | Risco | Notas                                    |
| --------------- | ------------------- | ---------------------------------------------- | --------------- | ---------- | ---------- | ---------------------- | ----- | ---------------------------------------- |
| payment_intents | Intent de pagamento (estado) | `modules/payments/payment-intent-repository.ts` (INSERT/UPDATE) **e** `modules/marketplace/payment-intent.repository.ts` (INSERT/UPDATE) | `INSERT INTO payment_intents` + `UPDATE payment_intents` | **Marketplace:** `modules/marketplace/routes/marketplace-payments.routes.ts` (`createPaymentIntent`, `authorizePaymentIntent`, `paymentExecutionService.executePayment`) + flows indiretos (ex. `modules/subscriptions/subscription.service.ts`, `modules/venue/venue.routes.ts`, `modules/pdv/pdv.service.ts`, `modules/automation/scheduled-action.service.ts`) | **Gateway/Workers/Reports:** `modules/gateway/payment-event-resolver.ts` (PIX, settlement, release) + múltiplos `SELECT ... FROM payment_intents` em workers + reports | Dois writers distintos (payments vs marketplace) | 🟠    | **Confirmado:** `payment_intents` é usado como estado/ponte em fluxos que levam a `transfer()` (Marketplace e PIX). **Não** é SSOT de dinheiro; SSOT de dinheiro é `bank_*`. |

---

## 6. Inventário de Tabelas (v1)

> Completar via migrations + grep

* bank_ledger
* bank_transactions
* payment_intents
* bank_accounts
* bank_splits
* payment_execution_lock
* unifycard_transactions
* payout_requests
* bank_settlements
* reconciliation_discrepancies
* reconciliation_runs
* reconciliation_ledger_discrepancies
* reconciliation_disputes
* reconciliation_dispute_events
* reversals
* treasury_accounts
* treasury_distributions
* treasury_split_config
* treasury_split_executions
* ledger_compensations
* ledger_snapshots
* financial_audit_trail
* financial_metrics
* financial_alerts
* financial_rate_limits
* financial_disputes
* financial_freezes
* financial_circuit_breakers
* financial_risk_events
* financial_sla_events
* governance_financial_actions (não classificado ainda)
* governance_funding (não classificado ainda)
* governance_funding_commitments (não classificado ainda)
* governance_proposals (não classificado ainda)

---

## 7. Superfície Enganosa (🟧 / 🟥)

| Módulo         | Problema                             | Evidência                                   | Ação                          | Responsável | Risco |
| -------------- | ------------------------------------ | ------------------------------------------- | ----------------------------- | ----------- | ----- |
| modules/ledger (writes) | `recordEntry` ainda não persiste (stub) | `ledger.repository.ts` | Rotas de **leitura** migradas para `bank_ledger`; writes legados documentados | — | 🟧 |

---

## 8. Regras de Governança (derivadas do mapa)

* Apenas módulos do domínio **bank** devem escrever saldo
* Escrita fora do módulo canônico deve ser tratada como exceção explícita
* Toda exceção deve estar documentada no mapa

---

## 8.1 Observação — Estado do Fluxo de Intents

**Decisão baseada em código (2026-04): Opção C — Parcial / inconsistente**

**Evidência 1 (Marketplace):** `modules/marketplace/payment-execution.service.ts` executa `bankTransactionService.transfer(...)` usando `referenceId = paymentIntentId` e metadata com `payment_intent_id`. Ou seja:

```
payment_intents (marketplace) → paymentExecutionService.executePayment(paymentIntentId) → transfer() → bank_transactions → bank_ledger
```

**Evidência 2 (Gateway PIX + settlement/release):** `modules/gateway/payment-event-resolver.ts` lê `payment_intents` (por `reference_id`), atualiza status/metadata e chama `bankTransactionService.transfer(...)` em pontos do fluxo PIX (confirm) e release seller. Ou seja:

```
payment_intents (payments) → payment-event-resolver (PIX/settlement/release) → transfer() → bank_transactions → bank_ledger
```

**Limite confirmado:** existem múltiplos writers/formatos de `payment_intents` (payments vs marketplace) e existem fluxos de `transfer()` que não passam por `payment_intents` (ex.: B2B usa `b2b_payment_intents`; treasury/workers chamam `transfer` diretamente). Portanto `payment_intents` não é “ponto único” do dinheiro; é **estado intermediário** que em alguns fluxos **dispara** `transfer()`.
  
---

## 8.2 Fluxo Financeiro Real Descoberto

**Auditoria 13/04/2026 — Callers de `transfer()` identificados:**

### Fluxo 1: Marketplace Payment (Buyer → Escrow)

```
payment_intents (marketplace; status AUTHORIZED)
        ↓
executePayment(paymentIntentId) [marketplace/payment-execution.service.ts]
        ↓
transfer(wallet → escrow) [bank-transaction.service.ts]
        ↓
bank_transactions (INSERT)
        ↓
bank_ledger (debit + credit)
```

**Contexto**: Comprador pagando pedido → dinheiro vai para escrow da plataforma

### Fluxo 2: B2B Payment (Buyer → Supplier)

```
b2b_payment_intent (ready)
        ↓
completeB2bPaymentFromIntentCommand() [commands/financial.commands.ts]
        ↓
createTransactionFromIntent() [bank-ledger.service.ts]
        ↓
transfer(buyer → supplier) [bank-transaction.service.ts]
        ↓
bank_transactions (INSERT × 2)
        ↓
bank_ledger (debit + credit × 2)
```

**Contexto**: Liquidação direta entre buyer e supplier em tenants diferentes

### Fluxo 3: PIX Payment (External → Wallet)

```
PIX_PAYMENT_CONFIRMED event
        ↓
payment-event-resolver.ts [gateway/payment-event-resolver.ts]
        ↓
transfer(external → wallet) [bank-transaction.service.ts]
        ↓
bank_transactions (INSERT)
        ↓
bank_ledger (debit + credit)
```

**Contexto**: Pagamento PIX confirmado → dinheiro entra na carteira do usuário

### Status dos Fluxos

| Fluxo | Status | Evidência |
|-------|--------|-----------|
| Marketplace | ✅ **COMPLETO** | Código executável encontrado |
| B2B | ✅ **COMPLETO** | Código executável encontrado |
| PIX | ✅ **CONFIRMADO** | gateway/payment-event-resolver.ts → transfer() |
| UnifyCard | ✅ **CONFIRMADO** | `marketplace/payment-execution.service.ts` executa `transfer()` (ledger) e regista `unifycard_transaction_id` no metadata; referência continua a ser `paymentIntentId` |

### Origem do Dinheiro

**Confirmado**:
- Marketplace
- B2B
- PIX

**Confirmado (classificação `payment_intents`):** **Opção C (parcial/inconsistente)** — `payment_intents` alimenta `transfer()` em Marketplace e PIX (e etapas de settlement/release), mas não é “ponto único” e nem todo `transfer()` passa por `payment_intents`.

---

## 8.3 Guardrails Financeiros Implementados

**Implementação 13/04/2026 — Testes de integridade:**

### Invariantes alvo (testes)

1. **Conservação de valor**: soma zero no `bank_ledger` por `transaction_id`
2. **Idempotência**: mesma `(reference_type, reference_id)` não duplica transação
3. **Concorrência**: múltiplas chamadas simultâneas → mesmo `transactionId`
4. **Cadeia A→B→C**: saldos parciais coerentes no recorte testado

### Implementação técnica

* **Arquivos:** `backend/tests/invariants/financial-integrity.test.ts` (API `transfer(tenantId, { … authorship })`); `backend/tests/invariants/financial-db-structural.test.ts` (invariantes estruturais read-only no DB; opt-in `RUN_FINANCIAL_DB_STRUCTURAL=1`).
* **Comandos (backend):**
  * `pnpm run test:financial-integrity:ci` — requer `DATABASE_URL` + (`RUN_FINANCIAL_INTEGRITY=1` ou `RUN_ALL_DB_INVARIANTS=1`) para **não** skipped.
  * `pnpm run test:financial-db-structural:ci` — requer `DATABASE_URL` + (`RUN_FINANCIAL_DB_STRUCTURAL=1` ou `RUN_ALL_DB_INVARIANTS=1`).
* **Monorepo — Jest estável:** `jest@29` não deve resolver `jest-util@30` (remove `testPathPatternToRegExp`). **Correção aplicada:** `package.json` (raiz) → `pnpm.overrides.jest-util` = `29.7.0`; `backend/package.json` → `@jest/globals` ^29.7.0 alinhado ao Jest 29.
* **CI — execução real (não só exit 0 local sem env):** workflow **`CI`** (`.github/workflows/ci.yml`), job **`financial-integrity-invariants`**: serviço Postgres, `DATABASE_URL`, `migrate`, `verify:public-snake-columns`, `seed`, depois os dois comandos acima com flags — invariantes **executam** no pipeline principal. Job **`Backend CI`** (`.github/workflows/backend-ci.yml`, paths `backend/**`), job **`financial-chaos`**: mesmo tipo de gate com `pnpm`.

### Proteção esperida

* PR no workflow **CI**: falha se invariantes financeiras falharem (job `financial-integrity-invariants` é dependência de `check-contract-usage`).
* Local: sem `DATABASE_URL` + flags, os blocos continuam **skipped** (exit 0) — comportamento intencional; não substitui o gate com DB no CI.

---

## 8.4 Inventário de callers `bankTransactionService.transfer` / `transactionService.transfer` (evidência: grep em `backend/src`)

| Arquivo | Contexto (resumo) |
|--------|-------------------|
| `modules/marketplace/payment-execution.service.ts` | Marketplace / executePayment |
| `commands/financial.commands.ts` (via B2B) | B2B — indireto em `bank-ledger.service` |
| `modules/gateway/payment-event-resolver.ts` | PIX + release seller |
| `modules/bank/ledger-compensation.service.ts` | Compensação |
| `workers/payout-worker.ts` | Payout worker |
| `workers/bank-settlement-worker.ts` | Settlement |
| `workers/governance-funding-commitment-worker.ts` | Governance funding |
| `modules/treasury-split/treasury-split.service.ts` | Treasury split |
| `modules/reversal/reversal.service.ts` | Reversão |
| `modules/marketplace/payout.service.ts` | Payout manual |
| `modules/observability/financial-simulator.controller.ts` | Simulação (dev/staging) |
| `core/economy/transaction.service.ts` | Delega para `bankTransactionService.transfer` |
| `core/economy/distribution/distribution.service.ts` | Distribuição (via `transactionService`) |
| `core/economy/split.service.ts` | Split (via `transactionService`) |
| `core/economy/transactions/transaction.routes.ts` | Rota HTTP economy |
| `modules/social/social-work-payment.service.ts` | Social work payment |
| `core/unifybank/test-currency.service.ts` | Test currency |
| `scripts/validate-financial-flow-real.ts` | Script de validação |

**Observação:** `transactionService.transfer` em `core/economy/transaction.service.ts` delega para `bankTransactionService.transfer` (um único caminho de escrita em `bank_transactions` / `bank_ledger` no runtime).

**Log estruturado pós-`COMMIT`:** `financial_event: transfer_completed` em `bank-transaction.service.ts` (metadata: `from_account_id`, `to_account_id`).

---

## 9. Processo de Manutenção

Toda alteração em:

* modules/bank
* modules/payments
* modules/marketplace (payment)
* modules/reporting (incl. `reporting-bank-aggregates.ts`)
* modules/ledger (rotas HTTP)
* core/economy/ledger
* core/events (payment-related)

➡️ Deve atualizar este documento

---

## 10. Critérios de Aceitação

* Todas as tabelas v1 possuem:

  * writer identificado OU explicitamente inexistente
* Todas as exceções documentadas
* Todos os itens 🟥 e 🟧 possuem ação definida
* Nenhuma linha baseada em suposição

---

## 11. Observações

* Não inferir comportamento por estrutura de pastas
* Não promover SSOT sem prova de escrita
* Este documento é fonte operacional, não opinativa
* Snapshot obrigatório para validade

---

## 12. Próximos Passos

**Sessão 1 (bypass / writer bank-ledger) — inventário grep:** `PLANO_BANK_LEDGER_WRITER_ENFORCEMENT.md` (raiz do repo). Re-auditoria: repetir comandos no final desse plano.

**Sessão 3 (gate INSERT/UPDATE `bank_*` só em `modules/bank`):** `pnpm --dir backend run validate:bank-ledger-boundaries` — `backend/scripts/audit-bank-ledger-boundaries.mjs`; CI em `.github/workflows/backend-ci.yml` (job typecheck-and-arch). **Escrow → bank (política alvo):** `PROPOSTA_ESCROW_UNIFICATION.md`; índice em `PLANO_BANK_LEDGER_WRITER_ENFORCEMENT.md` (secção Escrow).

1. ~~Executar Fase -1 (contenção)~~ → **executado** (leituras migradas para Bank SSOT; ver §4)
2. ✅ Validar `bank_ledger` como SSOT — **COMPLETO** (writers confirmados no código)
3. ✅ Validar `bank_transactions` — **COMPLETO** (transfer() confirmado, callers mapeados)
4. ✅ Mapear callers de `transfer()` — **COMPLETO (grep `src`)** — ver §8.4
5. ✅ Testes de invariantes financeiros — **ATUALIZADOS**; Jest **corrigido** (override `jest-util`); script **`test:financial-db-structural:ci`** adicionado; **CI** (`.github/workflows/ci.yml`) com job **`financial-integrity-invariants`** — ver §8.3
6. Validar papel real de `payment_intents` no fluxo:
   * ✅ Writers confirmados (marketplace + payments)
   * ⚠️ Callers identificados (executePayment)
   * Confirmar: é ponto de entrada? É bypassado? Está parcialmente implementado?
   * Fechar hipótese: de onde vem o fluxo financeiro real?
7. Completar inventário de tabelas
8. Expandir para fase 2

---

## 13. Registo de execução (o que foi feito no código — 13/04/2026)

### Novos ficheiros

* `backend/src/modules/reporting/reporting-bank-aggregates.ts` — agregações read-only: volume `bank_transactions`, fees `bank_splits` (`split_type = 'fee'`), export `bank_ledger`, créditos para janela de payout, volume por actor.

### Alterações principais (contenção stub)

* `backend/src/modules/reporting/reporting.service.ts` — KPIs, séries, export: deixam de usar `ledgerService`; usam `reporting-bank-aggregates`.
* `backend/src/modules/payout/payout.service.ts` — batch: `listBankLedgerCreditLinesForPayoutWindow` em vez de `listEntries` vazio; remoção de import morto na validação de elegibilidade.
* `backend/src/modules/risk-command-center/risk-dashboard.service.ts` — volumes via agregações bank; `ledgerEntryIds` em perfil de actor não populado (evidência opcional futura).
* `backend/src/core/identity/identity.routes.ts` — movimentos por conta via `bankLedgerRepository.getEntriesByAccount`.
* `backend/src/modules/invoicing/invoice.service.ts` — `bankLedgerRepository.getEntryById`.
* `backend/src/modules/ledger/ledger.routes.ts` — leituras HTTP: `bank_ledger` / `calculateBalance`; contexto legacy → **501**.
* `backend/src/core/economy/ledger/ledger.routes.ts` — leituras: `getEntriesByAccount`, `getEntriesByTransaction`, `calculateBalance`.
* `backend/src/modules/bank/bank-ledger.repository.ts` — **`getEntryById`**.
* `backend/src/modules/bank/bank-transaction.service.ts` — **`logFinancialEvent` `transfer_completed`** pós-`COMMIT`.
* `backend/src/modules/services/service-order.service.ts` — comentário de divergência ledger stub + remissão ao mapa.
* `backend/tests/invariants/financial-integrity.test.ts` — chamadas correctas a `transfer` + asserções `direction` em minúsculas; tipagem no `reduce` de saldos (evitar `unknown`).
* `package.json` (raiz) — `pnpm.overrides` → `jest-util@29.7.0` (compatibilidade com `jest@29` / `@jest/core@29`).
* `backend/package.json` — `@jest/globals@^29.7.0`; scripts **`test:financial-db-structural:ci`** e existência alinhada ao passo homónimo em **`backend-ci.yml`**.
* `.github/workflows/ci.yml` — job **`financial-integrity-invariants`**; `needs` de **`check-contract-usage`** inclui este job.
* `.github/workflows/backend-ci.yml` — comentário de cabeçalho (invariantes com DB + flags); job **`financial-chaos`** inalterado na intenção (migrate + seed + testes).

### Documentação

* Este ficheiro (`AUTHORITY_MAP_FINANCIAL_v1.md`) e `STATUS_EXECUCAO.md` (raiz) actualizados como índice operacional.

### Pendências explícitas

* Preencher **Commit SHA** no §0 após commit.
* §6 inventário de tabelas ainda **incompleto**.
* `payment_intents` — grafo completo de entrada → `transfer()` (§8.1).
* Escrita economy `modules/ledger` (`recordEntry`) permanece **stub** — não confundir com SSOT de dinheiro.
* **Branch protection:** garantir que o workflow **CI** (com job `financial-integrity-invariants`) é **required** no repositório — não documentável só no ficheiro.

---
