# Backfill débitos — `e2e_system_liquidity_mint`

**Modo:** EXECUTOR  
**Objetivo:** Restaurar dupla entrada no `bank_ledger` sem DELETE, sem reset, sem migrations, sem alterar o monitor.

## O que foi feito

1. Script `backend/src/scripts/backfill-e2e-mint-ledger-debits.ts`:
   - Seleciona `bank_transactions` com `reference_type = 'e2e_system_liquidity_mint'` que têm crédito no ledger e **não** têm débito.
   - Garante conta `bank_accounts` com `owner_type = 'system'`, `owner_id = system:liquidity_issuance:{tenant_id}` (criada se ausente).
   - Insere linha `bank_ledger` com `direction = 'debit'`, mesmo `amount_cents` e `transaction_id`, `purpose = 'execution'`, justificativa de auditoria.
   - Idempotente: transações que já têm débito são ignoradas.

2. Execução local: **2** transações corrigidas; totais globais `debit == credit == 101080000`.

3. `GET /internal/financial/health`: **HTTP 200**, `ledger.status: OK`.

4. Script npm: `pnpm backfill:e2e-mint-ledger-debits` (workspace `unificard-backend`).

## Arquivos tocados

- `backend/src/scripts/backfill-e2e-mint-ledger-debits.ts` (novo)
- `backend/package.json` (script de conveniência)

## Pendência (fora deste log)

- Ajustar `createSimpleTransaction` (ou o chamador do mint) para gravar débito + crédito em transação única e evitar novo drift em futuros E2E.
