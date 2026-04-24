# PLANO_BANK_PAYMENTS_REFATOR_ARQUITETURAL.md

> **ESTADO OPERACIONAL DO §GLOBAL BLOCK:** ver `STATUS_EXECUCAO_GLOBAL.md`  
> **REGRA NORMATIVA:** definida em `PLANO_BASE_MODULO.md` (secção §GLOBAL BLOCK).  
> ⚠️ **Estado operacional pode variar por data.** Ver `STATUS_EXECUCAO_GLOBAL.md`.

Sistema: UnifiCard Backend - dominio bank/payments (TIER 1)
Molde normativo: PLANO_BASE_MODULO.md
Data: 2026-04-19
Modo: FASE S inicial read-only

## §A - Estado atual do plano

| Campo | Valor |
|---|---|
| Modulo | modules/bank + modules/payments + tabelas financeiras correlatas |
| Status global | PASS + ESCROW IMPLEMENTADO |
| Fase atual | ENCERRADO |
| Proxima acao | avançar para rides/social |
| Bloqueios ativos | Nenhum |
| Ultima execucao | 2026-04-19 23:13:03 UTC |
| Proposta | PROPOSTA-BANK-PAYMENTS-2026-04-19 — APROVADA |

## Dividas tecnicas

### DT-01 — ESCROW_BANK_BRIDGE — IMPLEMENTADO (2026-04-19)

**Status:** RESOLVIDO
**O que foi feito:**
- 3 migrations criadas: escrow_accounts, payment_milestones, escrow_transactions
- escrow.service.ts: bridge implementado com ordem correta
	(bankTransactionService.transfer PRIMEIRO, escrow_transaction DEPOIS)
- escrowRepository.createTransaction: aceita bankTransactionId
- Quando ESCROW_BANK_BRIDGE=1: bank executa antes de qualquer escrita em escrow
- Se bank falhar: nenhuma escrita em escrow (fluxo interrompe)
**Bloqueio:** resolvido.

### DT-02 — b2b_payment_intents escrito em bank-ledger.service.ts

**Severidade:** Baixa (aceito por design)
**Descricao:** bank-ledger.service.ts faz UPDATE em b2b_payment_intents
no fluxo de conclusao de pagamento B2B. E integracao intra-modulo bank
(bank-ledger orquestra bank_transaction_id no intent).
**Acao futura:** documentar explicitamente como excecao de design B2B.
**Bloqueio:** nao bloqueia.

### DT-03 — SELECT * em bank-reconciliation-history.repository.ts

**Severidade:** Baixa
**Arquivo:** backend/src/modules/bank/bank-reconciliation-history.repository.ts
**Descricao:** 2 ocorrencias de SELECT * em queries de reconciliacao.
Viola padrao de leitura explicita de colunas.
**Acao futura:** substituir por SELECT com colunas explicitas.
**Bloqueio:** nao bloqueia.

## 1. FASE S - Output inicial (read-only)

### 1.1 Tabelas do dominio bank/payments existentes no banco

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('bank_accounts','bank_transactions','bank_ledger','bank_splits','bank_settlements','escrow_accounts','escrow_transactions','payment_intents','payment_transactions','ledger_compensations','ledger_snapshots','reconciliation_runs','reconciliation_discrepancies') ORDER BY table_name;"

Resultado (11/13):
- bank_accounts
- bank_ledger
- bank_settlements
- bank_splits
- bank_transactions
- ledger_compensations
- ledger_snapshots
- payment_intents
- payment_transactions
- reconciliation_discrepancies
- reconciliation_runs

Nao encontradas:
- escrow_accounts
- escrow_transactions

### 1.2 Verificacao de tipos numeric/decimal/real/double precision em tabelas monetarias

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('bank_accounts','bank_transactions','bank_ledger','bank_splits','escrow_accounts','escrow_transactions','payment_intents','payment_transactions') AND data_type IN ('numeric','decimal','real','double precision') ORDER BY table_name, column_name;"

Resultado:
- bank_splits.percentage -> numeric

Leitura:
- Nao foram encontrados campos monetarios com tipo float/decimal no recorte; unico numeric encontrado foi percentual de split.

### 1.3 Inventario de arquivos do modulo bank

Arquivos .ts encontrados em modules/bank: 35
Observacao: modulo com cobertura ampla (accounts, ledger, transactions, split engine, limits, reconciliation, integrations).

### 1.4 Escrow bridge (escrow_transactions)

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'escrow_transactions' ORDER BY ordinal_position;"

Resultado:
- 0 linhas (tabela ausente no schema atual)

Impacto:
- Nao foi possivel validar no banco atual a presenca de bank_transaction_id em escrow_transactions.

## 2. Prova normativa inicial

Definicoes travadas pela proposta aprovada:
1) Fonte unica de saldo: bank_ledger (soma credit/debit em amount_cents)
2) Escritas permitidas em bank_ledger/bank_transactions apenas em modules/bank
3) Escrow via bridge conforme PROPOSTA_ESCROW_UNIFICATION.md (validacao depende da tabela escrow_transactions no ambiente)

Documentos base:
- PLANO_BASE_MODULO.md
- PROPOSTA_ESCROW_UNIFICATION.md

Justificativa:
- Fase inicial estritamente read-only, sem alteracao de codigo, schema ou dados.

## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-19 | FASE S | 11/13 tabelas existem. bank_splits.percentage é NUMERIC (percentual, não monetário — aceitável). escrow_accounts e escrow_transactions ausentes do banco. FASE S: OK. |
| 2026-04-19 | BLOCO 1 | Writers: todos dentro de modules/bank/ e modules/bank-settlement/ (allowlist). b2b_payment_intents escrito em bank-ledger.service.ts — design B2B aceito (DT-02). ESCROW_BANK_BRIDGE apenas em comentários — bridge não implementado (DT-01). Gate 2: OK. |
| 2026-04-19 | BLOCO 2 | Double-entry: 0 violações no banco. SELECT *: 2 ocorrências em bank-reconciliation-history.repository.ts (DT-03). event bus: zero. actor-writer: OK. price/amount sem _cents: zero. |
| 2026-04-19 | BLOCO 3 | Gates: actor-writer OK, bank-ledger OK, regression-guards OK. Double-entry invariant: 0 violações. |
| 2026-04-19 | PASS | Módulo bank/payments encerrado. 3 DTs documentadas. DT-01 (escrow) implementado. |
