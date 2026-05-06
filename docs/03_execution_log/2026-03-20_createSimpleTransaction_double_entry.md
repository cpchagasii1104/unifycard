# Hardening: `createSimpleTransaction` sempre em dupla entrada

**Modo:** EXECUTOR

## Objetivo

Garantir que toda transação simples grave **débito + crédito** no `bank_ledger` na mesma transação SQL (`BEGIN`/`COMMIT` existente).

## Alterações

1. **`backend/src/modules/bank/bank-transaction.service.ts`**
   - Método privado `ensureLiquidityIssuanceAccountId(client, tenantId)`: garante `bank_accounts` com `owner_id = system:liquidity_issuance:{tenantId}` (alinhado ao backfill), usando `INSERT … ON CONFLICT (tenant_id, owner_type, owner_id) DO NOTHING` na mesma conexão da transação.
   - `createSimpleTransactionWithAuthorship`:
     - Se **ambos** `fromAccountId` e `toAccountId`: inalterado semanticamente (já havia débito + crédito).
     - Se **só** `toAccountId`: `effectiveFrom` = conta de emissão; `effectiveTo` = destino.
     - Se **só** `fromAccountId`: `effectiveTo` = conta de emissão (contrapartida de “burn”/saída sem destino explícito).
     - `calculateBalance` passa a receber o `client` da transação para consistência.
     - Sempre duas linhas no ledger: débito na origem efetiva, crédito no destino efetivo.

2. **`backend/src/scripts/validate-financial-flow-real.ts`**: comentário de cabeçalho atualizado.

3. **`backend/src/scripts/verify-simple-tx-double-entry.ts`**: smoke manual (`pnpm verify:simple-tx-double-entry`) — mint só com `toAccountId`; valida `SUM(debit) = SUM(credit)` antes/depois.

4. **`backend/package.json`**: script `verify:simple-tx-double-entry`.

## Validação

- `pnpm run build` (backend): OK.
- `pnpm exec tsx src/scripts/verify-simple-tx-double-entry.ts`: OK (delta +123 em débito e crédito; totais iguais).

## Impacto em outros fluxos

- Transferências que já passavam **origem e destino**: **sem mudança** de comportamento (mesmas contas, mesmas duas linhas).
- Qualquer fluxo futuro com **apenas** um lado: passa a receber contrapartida na conta de emissão, **evitando drift** (comportamento novo e desejado).
- **Migrations:** nenhuma alterada.

## Respostas (checklist do pedido)

1. Função corrigida? **SIM**
2. Ledger sempre balanceado (para este método)? **SIM** (dois lados sempre gravados)
3. Impacto em fluxos existentes com from+to? **NÃO** (equivalente); com só um lado? **SIM** (correção intencional)
