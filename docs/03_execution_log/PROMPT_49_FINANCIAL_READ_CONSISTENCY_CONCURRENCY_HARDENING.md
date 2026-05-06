# Execução — Prompt 49 — Financial Read Consistency & Concurrency Hardening

**Data:** 2026-03-17  
**Modo:** EXECUTOR  
**Status:** SUCESSO

## Objetivo

Eliminar race conditions, leituras inconsistentes e execuções duplicadas em operações financeiras baseadas em ledger. Ledger permanece única fonte contábil. Nenhuma alteração em estrutura de bank_ledger, bank_accounts (balance), nem pipeline de PaymentIntent.

## Regras absolutas respeitadas

- NÃO criado balance em bank_accounts
- NÃO alterada estrutura de bank_ledger
- NÃO alterado fluxo financeiro existente
- Ledger continua única fonte contábil
- NÃO introduzida nova fonte de verdade
- Pipeline de PaymentIntent intacto

## Implementação

### 1. Padrão de transação e saldo consistente

- **getAccountBalanceConsistent(tenantId, accountId, client)** em `bank-ledger.repository.ts`: client obrigatório; delega para `calculateBalance(..., client)`; lança se client ausente. Não abre nova conexão.
- Fluxo padrão: BEGIN → SELECT bank_accounts FOR UPDATE → getAccountBalanceConsistent(..., client) → validar saldo → executar operação financeira → COMMIT.

### 2. Proteção anti-duplicação (FOR UPDATE SKIP LOCKED / claim atômico)

| Módulo | Função de claim | Worker |
|--------|------------------|--------|
| governance_funding_commitments | claimNextPendingCommitments(limit) | governance-funding-commitment-worker |
| governance_funding | claimNextPendingFundingRequests(limit) | governance-funding-worker |
| payout_requests | claimNextRequestedPayouts(limit) | payout-worker |
| payment_intents (escrowed) | claimEscrowedPaymentIntents(client, limit) | settlement-worker |
| payment_intents (settled) | claimSettledPaymentIntents(client, limit) | release-worker |
| treasury_distributions | claimNextPendingDistributions(client, limit) | treasury-distribution-worker |
| bank_settlements (pending split) | claimNextSettlementsPendingSplit(client, limit) | treasury-split-worker |

### 3. Execução atômica por worker

- **governance-funding-commitment-worker:** já em transação única (lock treasury, getAccountBalanceConsistent, transfer(client)); passou a usar claimNextPendingCommitments e getAccountBalanceConsistent.
- **governance-funding-worker:** claimNextPendingFundingRequests (UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *).
- **payout-worker:** claimNextRequestedPayouts; por item: BEGIN → lock conta origem → getAccountBalanceConsistent → se saldo < valor ROLLBACK e mark failed → senão transfer(client) → COMMIT.
- **settlement-worker:** pool.connect() → BEGIN → claimEscrowedPaymentIntents(client, BATCH) → para cada intent set_config tenant e settleEscrowedPaymentIntent(tenantId, intent, client) → COMMIT.
- **release-worker:** mesmo padrão com claimSettledPaymentIntents e releaseSettledPaymentIntent(..., client).
- **treasury-distribution-worker:** pool.connect() → BEGIN → claimNextPendingDistributions(client) → para cada distribuição createFinancialAction e UPDATE status na mesma transação → COMMIT.
- **treasury-split-worker:** pool.connect() → BEGIN → claimNextSettlementsPendingSplit(client) (FOR UPDATE OF s SKIP LOCKED) → para cada item executeSplit → COMMIT.

### 4. Resolver e repositórios

- **payment-event-resolver:** settleEscrowedPaymentIntent e releaseSettledPaymentIntent passam a aceitar `client?: PoolClient` e repassam para `bankTransactionService.transfer(..., client)`.
- **payment-intent-repository:** claimEscrowedPaymentIntents(client, limit) e claimSettledPaymentIntents(client, limit) com SELECT ... FOR UPDATE SKIP LOCKED.

### 5. Testes

- `tests/unit/financial-read-consistency-hardening.test.ts`: getAccountBalanceConsistent exige client; claimNextPendingCommitments — dois claims em paralelo retornam conjuntos disjuntos; rollback não persiste efeito (uso de getAccountBalanceConsistent dentro de transação com ROLLBACK).

## Auditoria final

- calculateBalance fora de transação: apenas em fluxos legados que não fazem operação financeira atômica no mesmo passo; fluxos de worker passaram a usar getAccountBalanceConsistent(client) ou calculateBalance(..., client) dentro de transação.
- Operação financeira sem lock: workers que movem dinheiro passaram a usar BEGIN + lock (FOR UPDATE) + saldo consistente + transfer(client) + COMMIT.
- Worker sem proteção de concorrência: todos os workers listados passaram a usar claim (FOR UPDATE SKIP LOCKED ou UPDATE atômico RETURNING *).

## Build

- `pnpm build` no backend: concluído com sucesso.
