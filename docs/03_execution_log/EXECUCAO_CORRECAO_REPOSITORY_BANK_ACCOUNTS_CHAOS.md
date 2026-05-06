# Execução — Correção controlada: repository alinhado ao Genesis (fazer Chaos Suite rodar)

**MODO:** EXECUTOR  
**Data:** 2025-03-15  
**Objetivo:** Fazer os testes rodarem corrigindo o repository desalinhado do Genesis (sem novas migrations, sem observability).

---

## 1. Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `backend/src/modules/bank/bank-account.repository.ts` | Reescrito: queries e tipo alinhados ao Genesis 0003; mapeamento owner_type user/company→actor; fallback system; actor_id no INSERT; actor_id UUID para company (ownerId composto). |
| `backend/src/modules/bank/bank-account.service.ts` | try/catch em ensurePlatformAccounts para violação uq_bank_accounts_one_system_per_tenant. |
| `backend/tests/financial-chaos/helpers.ts` | INSERT em `actors` antes de ensurePlatformAccounts/ensureLifecycleAccountsForOwner (person/company); 7 parâmetros no INSERT. |

---

## 2. Diferença de código aplicada (resumo)

### bank-account.repository.ts
- **BankAccountRow:** passou a usar colunas do Genesis: `id`, `tenant_id`, `actor_id`, `owner_type`, `owner_id`, `account_type`, `credit_status`, `last_activity_at`, `inactive_since`, `expires_at`, `created_at`. Removidos `account_id`, `cached_balance`, `metadata`, `currency`, `createdAt`, `updatedAt`.
- **toBankAccount:** mapeia `row.id` → `accountId`; `row.owner_type === 'actor'` → `ownerType: 'user'`; defaults para currency BRL, cachedBalance 0, metadata null, updatedAt = created_at.
- **toDbOwnerType:** `'user'|'company'` → `'actor'`, `'system'` → `'system'` (Genesis: owner_type IN ('actor','system','escrow')).
- **getAccountById:** SELECT com `id`, WHERE `id = $2`.
- **getAccountByOwner / getAccountByOwnerAndType / searchAccounts:** SELECT apenas colunas existentes; filtro por owner_type via toDbOwnerType; sem currency no WHERE (Genesis não tem coluna currency).
- **getAccountByOwnerAndType:** fallback para owner_type system: se não houver linha exata, retorna a única conta system do tenant (compatível com uq_bank_accounts_one_system_per_tenant).
- **createAccount:** INSERT (tenant_id, owner_id, owner_type, account_type) e opcionalmente actor_id quando owner_type = 'actor'; actor_id para company = parte UUID de ownerId (ownerId composto `companyId:accountType`).
- **updateCachedBalance:** no-op (Genesis não tem cached_balance nem updatedAt).
- **getSystemAccount:** owner_id = $2 (TEXT), sem uuid_from_string; sem filtro por currency.

### bank-account.service.ts
- **ensurePlatformAccounts:** try/catch em createAccount; se erro contém `uq_bank_accounts_one_system_per_tenant` ou `duplicar valor da chave`, continue.

### helpers.ts (financial-chaos)
- INSERT em `actors` (id, tenant_id, actor_type, display_name) para userId1, userId2, companyId com actor_type `person`/`person`/`company` (Genesis 0002); ON CONFLICT (id) DO NOTHING; 7 parâmetros.

---

## 3. Output do Chaos Suite (pnpm run test:financial-chaos)

```
Test Suites: 5 failed, 5 total
Tests:       17 failed, 3 passed, 20 total
Time:        ~21 s
```

### Passaram (3)
- Reconciliation: testes 14, 15, 16 (gateway > ledger, ledger > gateway, payout ausente).

### Falhas restantes (17) — fora do escopo “só repository bank_accounts”

1. **idempotency (5) + race-conditions (4):** `Cannot transfer to the same account`.  
   Com uma única conta system por tenant (uq_bank_accounts_one_system_per_tenant), escrow/clearing/etc. resolvem para o mesmo `accountId`; transferências “escrow → clearing” viram fromAccountId === toAccountId. Exige múltiplas contas system (migration) ou testes que não usem transfer entre contas system.

2. **ledger-integrity (4) + security (3):** `coluna "transaction_id" não existe` em `bank_transactions`.  
   Genesis 0003 usa `id` (e `account_id`, `reference_type`, `reference_id`); o código usa `transaction_id`, `event_id`, `from_account_id`, `to_account_id`. Alinhamento do **bank-transaction.service** (e possivelmente bank_transactions) ao Genesis é escopo separado.

3. **reconciliation (1):** teste 17 — `reconciliation_discrepancies_adjustment_transaction_id_fkey`.  
   Ajuste de resolução usa um transaction_id que não existe ou FK com schema diferente; depende do modelo de reconciliation e de bank_transactions.

---

## 4. Status

- **Repository bank_accounts:** alinhado ao Genesis 0003 (e compatível com constraint uq_bank_accounts_one_system_per_tenant e bank_accounts_actor_consistency).
- **Chaos Suite:** setup (createChaosTestContext) passa; 3 testes passam; 17 falham por schema/design em outros módulos (bank_transactions, uma conta system por tenant, reconciliation FK).

Próximos passos sugeridos (fora desta execução): alinhar bank_transaction.service (e queries em bank_transactions) ao Genesis; ou ajustar testes/constraints para uma conta system por tenant; e corrigir FK/ajuste do reconciliation (teste 17).

---

**Arquivo gerado:** `docs/03_execution_log/EXECUCAO_CORRECAO_REPOSITORY_BANK_ACCOUNTS_CHAOS.md`  
**Fim do registro.**
