# REBASE-04.3 — Backfill `payment_splits` → `bank_splits` (versão segura)

**Data:** 2026-03-18  
**Modo:** EXECUTOR  

---

## Artefato

| Item | Caminho |
|------|---------|
| Script | `backend/src/scripts/backfill-payment-splits-to-bank.ts` |

---

## Execução

```bash
cd backend
# Simulação (default)
DRY_RUN=true  pnpm exec tsx src/scripts/backfill-payment-splits-to-bank.ts
# Aplicar (requer DB, variáveis de ambiente, saldo suficiente nos pagadores)
DRY_RUN=false pnpm exec tsx src/scripts/backfill-payment-splits-to-bank.ts
```

---

## Lógica

1. **Base:** `DISTINCT execution_id` a partir de `payment_splits`, cruzado com `service_payment_executions`.
2. **Pula** execuções com `metadata.bankTransactionId` (já no fluxo canónico `service_payment_request`).
3. **Transação canónica:** `bank_transactions.reference_type = 'service_payment_execution'`, `reference_id = execution_id`.  
   - Se **já existe:** valida `SUM(bank_splits.amount) == SUM(payment_splits)` (tolerância 1); em caso de sucesso, apenas garante `bankTransactionId` no metadata da execução.  
   - Se **não existe** e moeda **BRL** e pagador **user** com `user_id`: chama `createTransactionWithExplicitSplitLines` (débito pagador + créditos + linhas em `bank_splits`). **Uma transação por `execution_id`** (índice único `(tenant_id, reference_type, reference_id)`).
4. **Validação:** aborta registro a registro se soma dos splits ≠ `execution.amount` (mesma unidade numérica que o domínio de serviços — valores tratados como **centavos inteiros**).
5. **Idempotência:** reexecução não cria segunda transação para o mesmo `execution_id`; alinhamento por soma evita duplicar movimento.
6. **Legado:** **não** apaga `payment_splits`; **não** altera leituras existentes.

---

## Unidade monetária

O script usa `Math.round(Number(amount))` para `payment_splits.amount` e `execution.amount`, alinhado ao uso atual do repositório de execução (valores em centavos). Se houver dados legados em **reais decimais**, ajustar o script antes de `DRY_RUN=false`.

---

## Build

- `pnpm exec tsc -p tsconfig.build.json --noEmit` — **OK** (inclui o script).  
- `pnpm build` pode falhar por ambiente (ex.: escrita em `dist/` bloqueada); não é erro do backfill em si.

---

## Resultado típico (exemplo)

- **DRY_RUN=true:** `migrated` = contagem de execuções que **seriam** migradas; `skipped` = já com bank / não-BRL / pagador não-user; `inconsistencies` = somas divergentes ou erros.  
- **DRY_RUN=false:** mesmo formato; `migrated` = execuções com transação criada (ou já alinhadas na segunda passagem).

---

## O que o script **não** faz

- Não insere só `bank_splits` sem ledger (caminho novo sempre cria transação + ledger + splits).  
- Não cobre `FIC` / pagador não-usuário (registado em `skipped` / exemplos).  
- Não remove `payment_splits`.
