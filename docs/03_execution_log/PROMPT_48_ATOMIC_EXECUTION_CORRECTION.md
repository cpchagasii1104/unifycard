# Execução — Correção Prompt 48 — Execução Atômica (Governance Funding Commitment Worker)

**Data:** 2026-03-17  
**Modo:** EXECUTOR  
**Status:** SUCESSO

## Objetivo

Eliminar race condition na validação de saldo e execução financeira: validação de saldo e transfer dentro da **mesma transação**, com lock na conta de origem (treasury).

## Alterações realizadas

### 1. `backend/src/modules/bank/bank-ledger.repository.ts`

- **calculateBalance(tenantId, accountId, client?: PoolClient)**: terceiro parâmetro opcional. Quando informado, usa a mesma conexão (mesma transação) e não faz `release`. Permite leitura consistente do saldo dentro de uma transação aberta.

### 2. `backend/src/modules/bank/bank-transaction.service.ts`

- **transfer(tenantId, input, existingClient?: PoolClient)**: terceiro parâmetro opcional. Quando informado:
  - Usa `existingClient` em vez de obter nova conexão.
  - Não executa `BEGIN` nem `COMMIT` (transação gerenciada pelo caller).
  - Não faz `client.release()` no `finally`.
  - Passa `client` para `bankLedgerRepository.calculateBalance(..., client)` em todos os pontos do fluxo de transfer, mantendo leitura de saldo na mesma transação.

### 3. `backend/src/workers/governance-funding-commitment-worker.ts`

- **Uma única transação por commitment:**
  1. `getClientWithTenant(tenantId)` — uma conexão por item.
  2. `BEGIN`.
  3. **Lock na conta treasury:** `SELECT id FROM bank_accounts WHERE tenant_id = $1 AND id = $2 FOR UPDATE`.
  4. **Saldo consistente:** `bankLedgerRepository.calculateBalance(tenantId, treasury.accountId, client)` dentro da transação.
  5. Se `balance < amountCents` → `ROLLBACK`, `markFailed`, `continue`.
  6. **Transfer na mesma transação:** `bankTransactionService.transfer(tenantId, input, client)` (sem novo BEGIN/COMMIT).
  7. `COMMIT`.
  8. `createPaymentIntent` e `markExecuted` após o commit (fora da transação financeira).
- **Rollback automático em erro:** em `catch`, `ROLLBACK` + `markFailed`; `client.release()` no `finally`.

## Garantias

- Sem race condition: lock (FOR UPDATE) + leitura de saldo + transfer na mesma transação.
- Sem double spend: conta de origem bloqueada até o fim da transfer.
- Execução determinística: validação e execução atômicas.
- Estrutura de tabelas, ledger e payment pipeline não alterados.

## Build

- `pnpm build` no backend: concluído com sucesso.
