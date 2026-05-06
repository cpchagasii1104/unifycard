# Runbook — Escrow ↔ Bank (Fase 3 hardening + reconciliação)

**Âmbito:** índices únicos parciais (`bank_transactions`, `escrow_transactions`), script de drift, remediação manual.

**Pré-requisitos:** `DATABASE_URL`; migrações aplicadas até `20260530140000_bank_escrow_hardening_unique_indexes.sql`.

---

## 1. Pré-voo (antes da migração única)

### 1.1 Duplicados em `bank_transactions`

```sql
SELECT tenant_id, reference_type, reference_id, COUNT(*) AS n
FROM bank_transactions
WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

- Se `n > 0`: **não** aplicar a migração até fundir ou anular duplicados (decisão de dados + PR dedicado).

### 1.2 Duplicados em `escrow_transactions.bank_transaction_id`

```sql
SELECT bank_transaction_id, COUNT(*) AS n
FROM escrow_transactions
WHERE bank_transaction_id IS NOT NULL
GROUP BY 1
HAVING COUNT(*) > 1;
```

- Se `n > 1` no mesmo `bank_transaction_id`: corrigir vínculos antes da migração.

---

## 2. Aplicar migração

```bash
pnpm --dir backend run migrate
```

Ficheiro: `backend/migrations/20260530140000_bank_escrow_hardening_unique_indexes.sql`

- Cria `uq_bank_transactions_tenant_reference` (parcial: só linhas com referência preenchida).
- Cria `uq_escrow_transactions_bank_transaction_id` (parcial: só `bank_transaction_id` NOT NULL).

---

## 3. Job / relatório de reconciliação

```bash
DATABASE_URL="postgresql://..." node backend/scripts/reconcile-escrow-bank-drift.mjs
```

- Lista escrows onde `held_amount_cents` ≠ soma `bank_ledger` na conta custody, ou `held > 0` sem conta custody.
- CI ou alerta: `RECONCILE_ESCROW_STRICT=1` → **exit 1** se houver linhas.

```bash
RECONCILE_ESCROW_STRICT=1 DATABASE_URL="..." node backend/scripts/reconcile-escrow-bank-drift.mjs
```

---

## 4. Remediação (orientação)

| Situação | Acção típica |
|----------|----------------|
| Custódia bank = 0, legacy held > 0, bridge ainda não usado | Esperado até `ESCROW_BANK_BRIDGE` + funding; não “igualar” legacy com ajuste manual sem decisão de produto. |
| Drift após bridge | Verificar `escrow_transactions.bank_transaction_id`, `bank_ledger` por `transaction_id`; usar compensação / estorno via `bankTransactionService` (não SQL directo em `bank_*`). |
| Duplicado bloqueou migração | Escolher linha canónica, arquivar ou corrigir `reference_id` duplicado com política de idempotência. |

**Proibido:** `INSERT`/`UPDATE` em `bank_ledger` / `bank_transactions` fora de `backend/src/modules/bank/` (gate `validate:bank-ledger-boundaries`).

---

## 5. Referências

- `PROPOSTA_ESCROW_UNIFICATION.md` — Fases 1–3.
- `ESCROW_BANK_BRIDGE` / `ESCROW_READ_FROM_BANK` — `backend/.env.example`.

---

*Append-only: novas lições de incidente → nova secção no fim deste ficheiro.*
